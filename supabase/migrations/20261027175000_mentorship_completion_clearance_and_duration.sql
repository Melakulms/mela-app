-- STAGING ONLY: never mark a mentorship session completed before
-- its full allotted time or after the mentor/learner loses clearance.
create or replace function private.complete_mentorship_session(
  p_session_id uuid,p_notes text default null)
returns public.mentorship_sessions language plpgsql
security definer set search_path=''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_admin boolean := private.is_admin_user() and
    coalesce((auth.jwt()->>'aal'),'')='aal2';
  v_session public.mentorship_sessions%rowtype;
  v_notes text := nullif(btrim(coalesce(p_notes,'')),'');
begin
  if v_actor is null then raise exception 'authentication required'; end if;

  select * into v_session from public.mentorship_sessions
    where id=p_session_id for update;
  if not found then raise exception 'session not found'; end if;
  if v_session.mentor_id is distinct from v_actor and not v_admin then
    raise exception 'only active verified mentor or MFA administrator can complete a session';
  end if;
  if v_session.status<>'scheduled' then
    raise exception 'only scheduled sessions can be completed';
  end if;
  if v_session.scheduled_at is null or v_session.duration_min is null
    or v_session.duration_min not between 15 and 180 then
    raise exception 'valid scheduled session required for completion';
  end if;
  if v_session.scheduled_at+make_interval(mins=>v_session.duration_min)>now() then
    raise exception 'session cannot be completed before the full scheduled duration';
  end if;
  if v_notes is not null and char_length(v_notes)>2000 then
    raise exception 'mentorship completion notes must be 2000 characters or fewer';
  end if;
  if not exists(
    select 1 from public.mentorship_requests r
      join public.mentor_profiles m on m.user_id=r.mentor_id
      join public.profiles p on p.id=r.mentee_id
    where r.id=v_session.request_id and r.status='accepted'
      and r.mentor_id=v_session.mentor_id
      and r.mentee_id=v_session.mentee_id
      and m.verified and m.active
      and p.role='student' and p.account_status='active' and p.deleted_at is null
  ) then
    raise exception 'active verified mentor and accepted eligible mentorship required';
  end if;
  if not private.user_has_guardian_or_adult_clearance(v_session.mentee_id) then
    raise exception 'current verified guardian or adult clearance required for completion';
  end if;

  update public.mentorship_sessions
    set status='completed',completed_at=now(),updated_at=now(),
      notes=coalesce(v_notes,notes)
    where id=p_session_id returning * into v_session;
  return v_session;
end;
$fn$;
revoke all on function private.complete_mentorship_session(uuid,text)
  from public,anon;
grant execute on function private.complete_mentorship_session(uuid,text)
  to authenticated;
