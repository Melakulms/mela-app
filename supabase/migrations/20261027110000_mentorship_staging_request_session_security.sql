-- Staging-only MELA mentorship request/session grant repair.
-- Guards are enforced in PostgreSQL; client-side stage checks are not authorization.
-- No production operations, payment activation, provider rooms or learner data copied.

create or replace function private.enforce_mentorship_audience_access()
returns trigger language plpgsql security definer set search_path = ''
as $fn$
declare
  v_stage text;
  v_active boolean;
begin
  select p.education_stage_key, (p.role='student' and p.account_status='active' and p.deleted_at is null)
    into v_stage, v_active
  from public.profiles p where p.id=new.mentee_id;
  if coalesce(v_active,false) is not true then
    raise exception 'active student account required for mentorship';
  end if;
  if v_stage is null or v_stage in ('school_1_6','school_7_8','school_9_10') or
     v_stage not in ('school_11_12','college_tvet','university') then
    raise exception 'direct mentorship is unavailable for this education stage';
  end if;
  if not private.user_has_guardian_or_adult_clearance(new.mentee_id) then
    raise exception 'verified guardian clearance or adult eligibility is required';
  end if;
  if not exists (select 1 from public.mentor_profiles m
    where m.user_id=new.mentor_id and m.verified=true and m.active=true) then
    raise exception 'verified active mentor required';
  end if;
  return new;
end;
$fn$;
revoke all on function private.enforce_mentorship_audience_access() from public, anon, authenticated;
-- Existing INSERT trigger calls it; check clearance again when mentor accepts.
drop trigger if exists trg_enforce_mentorship_acceptance_clearance on public.mentorship_requests;
create trigger trg_enforce_mentorship_acceptance_clearance
before update of status on public.mentorship_requests
for each row when (new.status = 'accepted' and new.status is distinct from old.status)
execute function private.enforce_mentorship_audience_access();

drop policy if exists "Mentees create mentorship requests" on public.mentorship_requests;
create policy "Mentees create mentorship requests"
on public.mentorship_requests for insert to authenticated
with check (
  mentee_id=(select auth.uid())
  and mentor_id<>mentee_id
  and status='pending' and responded_at is null
  and (preferred_at is null or preferred_at>now())
  and char_length(btrim(coalesce(topic,''))) between 2 and 120
  and char_length(coalesce(message,'')) <= 1000
  and exists (select 1 from public.profiles p where p.id=mentee_id
    and p.role='student' and p.account_status='active' and p.deleted_at is null
    and p.education_stage_key in ('school_11_12','college_tvet','university'))
  and private.user_has_guardian_or_adult_clearance(mentee_id)
  and exists (select 1 from public.mentor_profiles m where m.user_id=mentor_id
    and m.active=true and m.verified=true)
);
-- Only fields entered on the request form; other state and identity columns remain server-controlled.
grant insert (mentee_id,mentor_id,topic,message,preferred_at,status)
  on public.mentorship_requests to authenticated;

-- Enforce valid participants and current safeguarding clearance at the point of scheduling.
create or replace function private.enforce_mentorship_session_audience()
returns trigger language plpgsql security definer set search_path = ''
as $fn$
begin
  if new.status='scheduled' then
    if new.request_id is null or new.mentor_id is null or new.mentee_id is null then
      raise exception 'accepted mentorship request and participants required';
    end if;
    if not exists (
      select 1 from public.mentorship_requests r
        join public.mentor_profiles m on m.user_id=r.mentor_id
      where r.id=new.request_id and r.status='accepted'
        and r.mentor_id=new.mentor_id and r.mentee_id=new.mentee_id
        and m.active and m.verified
    ) then
      raise exception 'active verified mentor and accepted request required';
    end if;
    if not private.user_has_guardian_or_adult_clearance(new.mentee_id) then
      raise exception 'mentorship audience eligibility requires re-verification';
    end if;
    if new.scheduled_at is null or new.scheduled_at<=now() or
       coalesce(new.duration_min,0) not between 15 and 180 then
      raise exception 'future session of 15 to 180 minutes required';
    end if;
  end if;
  return new;
end;
$fn$;
revoke all on function private.enforce_mentorship_session_audience() from public, anon, authenticated;
drop trigger if exists trg_mentorship_schedule_clearance_insert on public.mentorship_sessions;
create trigger trg_mentorship_schedule_clearance_insert
before insert on public.mentorship_sessions
for each row execute function private.enforce_mentorship_session_audience();
drop trigger if exists trg_mentorship_schedule_clearance_update on public.mentorship_sessions;
create trigger trg_mentorship_schedule_clearance_update
before update of scheduled_at,duration_min,status on public.mentorship_sessions
for each row
when (new.status='scheduled' and (
 new.scheduled_at is distinct from old.scheduled_at or
 new.duration_min is distinct from old.duration_min or
 new.status is distinct from old.status
))
execute function private.enforce_mentorship_session_audience();

-- Use the existing participant/transition-checking RPCs, not unrestricted direct table UPDATE.
-- The private implementation functions already validate the authenticated actor and row state.
alter function public.cancel_mentorship_request(uuid) security invoker;
revoke execute on function public.cancel_mentorship_request(uuid) from public, anon;
revoke execute on function public.respond_mentorship_request(uuid,text) from public, anon;
revoke execute on function public.schedule_mentorship_session(uuid,timestamptz,integer,text) from public, anon;
revoke execute on function public.cancel_mentorship_session(uuid,text) from public, anon;
revoke execute on function public.complete_mentorship_session(uuid,text) from public, anon;
revoke execute on function public.rate_mentorship_session(uuid,smallint,text) from public, anon;
grant execute on function public.cancel_mentorship_request(uuid) to authenticated;
grant execute on function public.respond_mentorship_request(uuid,text) to authenticated;
grant execute on function public.schedule_mentorship_session(uuid,timestamptz,integer,text) to authenticated;
grant execute on function public.cancel_mentorship_session(uuid,text) to authenticated;
grant execute on function public.complete_mentorship_session(uuid,text) to authenticated;
grant execute on function public.rate_mentorship_session(uuid,smallint,text) to authenticated;
grant execute on function private.cancel_mentorship_request(uuid) to authenticated;
grant execute on function private.respond_mentorship_request(uuid,text) to authenticated;
grant execute on function private.schedule_mentorship_session(uuid,timestamptz,integer,text) to authenticated;
grant execute on function private.cancel_mentorship_session(uuid,text) to authenticated;
grant execute on function private.complete_mentorship_session(uuid,text) to authenticated;
grant execute on function private.rate_mentorship_session(uuid,smallint,text) to authenticated;
