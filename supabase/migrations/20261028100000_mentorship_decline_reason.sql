-- STAGING ONLY. Secure, structured decline reasons for mentorship requests.
-- Mentors choose a fixed reason code and may add a short note. Learners can
-- read the result on their own request. Only the server-side RPC writes these
-- fields; direct client writes remain impossible.

alter table public.mentorship_requests
  add column if not exists decline_reason_code text,
  add column if not exists decline_note text;

alter table public.mentorship_requests
  drop constraint if exists mentorship_requests_decline_reason_code_check;
alter table public.mentorship_requests
  add constraint mentorship_requests_decline_reason_code_check
  check (decline_reason_code is null or decline_reason_code in (
    'schedule_unavailable','outside_expertise','capacity_full','different_timing','other'));

alter table public.mentorship_requests
  drop constraint if exists mentorship_requests_decline_note_check;
alter table public.mentorship_requests
  add constraint mentorship_requests_decline_note_check
  check (decline_note is null or char_length(decline_note) between 1 and 300);

alter table public.mentorship_requests
  drop constraint if exists mentorship_requests_decline_fields_check;
alter table public.mentorship_requests
  add constraint mentorship_requests_decline_fields_check
  check (status = 'declined' or (decline_reason_code is null and decline_note is null));

-- Learners and mentors may read these fields through the existing row policy.
-- Direct writes stay blocked: the RPC below is the only writer.
revoke update (decline_reason_code, decline_note) on public.mentorship_requests from authenticated, anon;
grant select (decline_reason_code, decline_note) on public.mentorship_requests to authenticated;

create or replace function private.respond_mentorship_request_with_reason(
  p_request_id uuid, p_decision text, p_reason_code text default null, p_note text default null)
returns public.mentorship_requests language plpgsql
security definer set search_path=''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_record public.mentorship_requests%rowtype;
  v_existing public.mentorship_requests%rowtype;
  v_code text := nullif(btrim(coalesce(p_reason_code,'')), '');
  v_note text := nullif(btrim(coalesce(p_note,'')), '');
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  if p_decision not in ('accepted','declined') then
    raise exception 'decision must be accepted or declined';
  end if;
  if p_decision = 'accepted' and (v_code is not null or v_note is not null) then
    raise exception 'reasons can only be given when declining';
  end if;
  if p_decision = 'declined' then
    if v_code is null or v_code not in (
      'schedule_unavailable','outside_expertise','capacity_full','different_timing','other') then
      raise exception 'choose a valid decline reason';
    end if;
    if v_note is not null and char_length(v_note) > 300 then
      raise exception 'keep the decline note to 300 characters or fewer';
    end if;
  end if;

  update public.mentorship_requests
    set status=p_decision, responded_at=now(),
        decline_reason_code = case when p_decision='declined' then v_code else null end,
        decline_note = case when p_decision='declined' then v_note else null end
    where id=p_request_id and status='pending'
      and (mentor_id=v_actor or
        (private.is_admin_user() and coalesce((auth.jwt()->>'aal'),'')='aal2'))
    returning * into v_record;
  if found then return v_record; end if;

  select * into v_existing from public.mentorship_requests where id=p_request_id;
  if not found then raise exception 'request not found'; end if;
  if v_existing.mentor_id<>v_actor and not
    (private.is_admin_user() and coalesce((auth.jwt()->>'aal'),'')='aal2') then
    raise exception 'only the mentor or MFA-verified administrator can respond';
  end if;
  raise exception 'request is no longer pending';
end;
$fn$;

revoke all on function private.respond_mentorship_request_with_reason(uuid,text,text,text)
  from public, anon;
grant execute on function private.respond_mentorship_request_with_reason(uuid,text,text,text)
  to authenticated;

create or replace function public.respond_mentorship_request_with_reason(
  p_request_id uuid, p_decision text, p_reason_code text default null, p_note text default null)
returns public.mentorship_requests language sql
set search_path=''
as $fn$
  select * from private.respond_mentorship_request_with_reason(p_request_id,p_decision,p_reason_code,p_note);
$fn$;

revoke all on function public.respond_mentorship_request_with_reason(uuid,text,text,text)
  from public, anon;
grant execute on function public.respond_mentorship_request_with_reason(uuid,text,text,text)
  to authenticated;
