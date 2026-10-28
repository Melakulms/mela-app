-- STAGING ONLY: published availability is mandatory for confirmed sessions.
-- Match the complete session window in the slot's own IANA time zone.
create or replace function private.require_mentorship_published_availability()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
  if new.status <> 'scheduled' then return new; end if;
  if new.mentor_id is null or new.scheduled_at is null
      or coalesce(new.duration_min,0) not between 15 and 180 then
    raise exception 'valid mentorship session time required';
  end if;

  if not exists (
    select 1 from public.mentor_availability a
    where a.mentor_id=new.mentor_id and a.active
      and a.weekday=extract(dow from (new.scheduled_at at time zone a.timezone))::integer
      and (new.scheduled_at at time zone a.timezone)::date =
        ((new.scheduled_at + make_interval(mins=>new.duration_min)) at time zone a.timezone)::date
      and (new.scheduled_at at time zone a.timezone)::time >= a.start_time
      and ((new.scheduled_at + make_interval(mins=>new.duration_min))
        at time zone a.timezone)::time <= a.end_time
  ) then
    raise exception 'the mentor must publish availability covering the entire session';
  end if;
  return new;
end;
$fn$;
revoke all on function private.require_mentorship_published_availability()
  from public,anon,authenticated;
drop trigger if exists trg_mentorship_require_availability on public.mentorship_sessions;
create trigger trg_mentorship_require_availability
before insert or update of scheduled_at,duration_min,status,mentor_id
on public.mentorship_sessions
for each row when (new.status='scheduled')
execute function private.require_mentorship_published_availability();

create index if not exists mentor_availability_active_weekday_idx
on public.mentor_availability(mentor_id,weekday) where active;
