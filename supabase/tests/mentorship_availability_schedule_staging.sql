-- STAGING ONLY: no persistent profiles, bookings or availability created.
do $guard$
begin
 if not exists (select 1 from pg_trigger
   where tgrelid='public.mentorship_sessions'::regclass
     and tgname='trg_mentorship_require_availability' and tgenabled='O') then
   raise exception 'published availability booking trigger is missing';
 end if;
 if has_function_privilege('authenticated',
   'private.require_mentorship_published_availability()','EXECUTE') then
   raise exception 'private availability validator must not be exposed';
 end if;
end $guard$;

-- The exact SQL timezone formula must recognize valid and invalid windows.
do $windows$
declare
  monday_utc timestamptz := '2026-11-02 06:15:00+00'::timestamptz;
  sunday_utc timestamptz := '2026-11-01 06:15:00+00'::timestamptz;
  v_zone text := 'Africa/Addis_Ababa';
  v_start time := '09:00';
  v_end time := '10:00';
begin
  if not (
    extract(dow from monday_utc at time zone v_zone)=1
    and (monday_utc at time zone v_zone)::time>=v_start
    and ((monday_utc+interval '30 minutes') at time zone v_zone)::time<=v_end
  ) then raise exception 'valid local Monday window not recognized'; end if;
  if (
    extract(dow from sunday_utc at time zone v_zone)=1
    and (sunday_utc at time zone v_zone)::time>=v_start
  ) then raise exception 'wrong weekday was accepted'; end if;
  if ((monday_utc+interval '60 minutes') at time zone v_zone)::time<=v_end then
    raise exception 'session extending beyond mentor hours was accepted';
  end if;
end $windows$;

-- Exercise actual private trigger on an ephemeral temp table.
begin;
create temporary table pg_temp.mentorship_availability_smoke (
  status text,
  mentor_id uuid,
  scheduled_at timestamptz,
  duration_min integer
) on commit drop;
create trigger temp_availability_smoke
before insert on pg_temp.mentorship_availability_smoke
for each row execute function private.require_mentorship_published_availability();
do $reject$
declare denied boolean:=false;
begin
 begin
  insert into pg_temp.mentorship_availability_smoke (
    status,mentor_id,scheduled_at,duration_min
  ) values (
    'scheduled','00000000-0000-4000-8000-000000000099',
    now()+interval '7 days',30
  );
 exception when others then
  if sqlerrm like '%mentor must publish availability%' then denied:=true;
  else raise exception 'unexpected availability validator behavior: %',sqlerrm; end if;
 end;
 if not denied then raise exception 'missing mentor hours failed to block booking'; end if;
end $reject$;
rollback;
select 'mentorship_availability_time_zone_and_guard_smoke_passed' as result;
