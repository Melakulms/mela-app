-- STAGING ONLY. Acceptance is not a booking. Legacy trigger previously inserted
-- a session with an unapproved call_room_id when preferred_at was present.
-- That conflicted with verified availability, overlap prevention and media safety.
create or replace function private.process_mentorship_request_status()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if new.status='accepted' then
    perform private.create_notification(
      new.mentee_id,'Mentorship request accepted',
      'Your mentor accepted your request. Your preferred time is not confirmed; the mentor must separately schedule an available session.',
      'mentorship_requests',new.id
    );
    perform private.create_notification(
      new.mentor_id,'Mentorship request accepted',
      'Review your published weekly availability and separately schedule a session for this accepted request.',
      'mentorship_requests',new.id
    );
  elsif new.status='declined' then
    perform private.create_notification(
      new.mentee_id,'Mentorship request declined',
      'The mentor declined your request. You can find another verified mentor.',
      'mentorship_requests',new.id
    );
  elsif new.status='cancelled' then
    perform private.create_notification(
      new.mentor_id,'Mentorship request cancelled',
      'The learner cancelled this pending request.',
      'mentorship_requests',new.id
    );
  end if;
  return new;
end;
$fn$;
revoke all on function private.process_mentorship_request_status()
  from public,anon,authenticated;

-- Avoid duplicate notifications. AFTER UPDATE trigger owns all request
-- status notifications, including updates made by administrators.
create or replace function private.respond_mentorship_request(
  p_request_id uuid,p_decision text)
returns public.mentorship_requests language plpgsql
security definer set search_path=''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_record public.mentorship_requests%rowtype;
  v_existing public.mentorship_requests%rowtype;
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  if p_decision not in ('accepted','declined') then
    raise exception 'decision must be accepted or declined';
  end if;
  update public.mentorship_requests
    set status=p_decision,responded_at=now()
    where id=p_request_id and status='pending'
      and (mentor_id=v_actor or
        (private.is_admin_user() and coalesce((auth.jwt()->>'aal'),'')='aal2'))
    returning * into v_record;
  if found then return v_record; end if;

  select * into v_existing from public.mentorship_requests
    where id=p_request_id;
  if not found then raise exception 'request not found'; end if;
  if v_existing.mentor_id<>v_actor and not
    (private.is_admin_user() and coalesce((auth.jwt()->>'aal'),'')='aal2') then
    raise exception 'only the mentor or MFA-verified administrator can respond';
  end if;
  raise exception 'request is no longer pending';
end;
$fn$;
revoke all on function private.respond_mentorship_request(uuid,text)
  from public,anon;
grant execute on function private.respond_mentorship_request(uuid,text) to authenticated;

create or replace function private.cancel_mentorship_request(p_request_id uuid)
returns public.mentorship_requests language plpgsql
security definer set search_path=''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_record public.mentorship_requests%rowtype;
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  select * into v_record from public.mentorship_requests
    where id=p_request_id for update;
  if not found then raise exception 'request not found'; end if;
  if v_record.mentee_id<>v_actor and not
    (private.is_admin_user() and coalesce((auth.jwt()->>'aal'),'')='aal2') then
    raise exception 'only the learner or MFA-verified administrator can cancel';
  end if;
  if v_record.status<>'pending' then
    raise exception 'only pending requests can be cancelled';
  end if;
  update public.mentorship_requests
    set status='cancelled',responded_at=now()
    where id=p_request_id returning * into v_record;
  return v_record;
end;
$fn$;
revoke all on function private.cancel_mentorship_request(uuid) from public,anon;
grant execute on function private.cancel_mentorship_request(uuid) to authenticated;
