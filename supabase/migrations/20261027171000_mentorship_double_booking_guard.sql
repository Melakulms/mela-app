-- STAGING ONLY: serialize mentor/learner scheduling and reject overlapping sessions.
-- Neither UI hints nor simple pre-insert SELECTs prevent concurrent bookings.
create or replace function private.prevent_mentorship_double_booking()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_admin boolean := private.is_admin_user()
    and coalesce((auth.jwt()->>'aal'),'')='aal2';
begin
  if new.status <> 'scheduled' then return new; end if;
  if v_actor is null or
     (v_actor is distinct from new.mentor_id and not v_admin) then
    raise exception 'verified mentor or MFA administrator required to schedule';
  end if;
  if new.mentor_id is null or new.mentee_id is null
     or new.mentor_id=new.mentee_id then
    raise exception 'distinct mentor and learner required for scheduling';
  end if;
  if not exists (
    select 1 from public.mentor_profiles m
    join public.profiles p on p.id=m.user_id
    where m.user_id=new.mentor_id and m.verified and m.active
      and p.account_status='active' and p.deleted_at is null
  ) then
    raise exception 'active verified mentor account required';
  end if;
  if new.scheduled_at is null or new.scheduled_at<=now()
     or new.scheduled_at>now()+interval '365 days'
     or new.duration_min is null or new.duration_min not between 15 and 180 then
    raise exception 'book a future mentorship session within 365 days, for 15-180 minutes';
  end if;

  -- Lock both participants in a stable UUID order. Concurrent bookings
  -- involving either user serialize before checking existing sessions.
  perform 1 from public.profiles p
    where p.id in (new.mentor_id,new.mentee_id)
    order by p.id for update;

  if exists (
    select 1 from public.mentorship_sessions s
    where s.status='scheduled'
      and s.id is distinct from new.id
      and (s.mentor_id in (new.mentor_id,new.mentee_id)
        or s.mentee_id in (new.mentor_id,new.mentee_id))
      and s.scheduled_at < new.scheduled_at
        + make_interval(mins=>new.duration_min)
      and new.scheduled_at < s.scheduled_at
        + make_interval(mins=>coalesce(s.duration_min,30))
  ) then
    raise exception 'mentor or learner already has an overlapping scheduled session';
  end if;
  return new;
end;
$fn$;
revoke all on function private.prevent_mentorship_double_booking()
 from public,anon,authenticated;

drop trigger if exists trg_mentorship_double_booking on public.mentorship_sessions;
create trigger trg_mentorship_double_booking
before insert or update of scheduled_at,duration_min,status,mentor_id,mentee_id
on public.mentorship_sessions
for each row when (new.status='scheduled')
execute function private.prevent_mentorship_double_booking();

create index if not exists mentorship_sessions_active_mentor_schedule_idx
on public.mentorship_sessions(mentor_id,scheduled_at)
where status='scheduled';
create index if not exists mentorship_sessions_active_mentee_schedule_idx
on public.mentorship_sessions(mentee_id,scheduled_at)
where status='scheduled';
