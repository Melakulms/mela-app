-- STAGING ONLY: check weekly slot guard without creating account/mentor records.
do $config$
begin
 if not exists(select 1 from pg_trigger where
   tgrelid='public.mentor_availability'::regclass
   and tgname='trg_validate_mentor_weekly_availability' and tgenabled='O') then
   raise exception 'availability integrity trigger not installed';
 end if;
 if has_function_privilege('authenticated',
    'private.validate_mentor_weekly_availability()','EXECUTE') then
   raise exception 'private weekly availability helper is directly callable';
 end if;
end $config$;

begin;
create temporary table pg_temp.mentor_weekly_slot_probe(
 id uuid default extensions.gen_random_uuid(),
 mentor_id uuid, created_at timestamptz default now(),
 weekday smallint, start_time time, end_time time,
 timezone text, active boolean default true
) on commit drop;
grant insert on pg_temp.mentor_weekly_slot_probe to authenticated;
create trigger temp_weekly_slot_guard before insert
 on pg_temp.mentor_weekly_slot_probe
 for each row execute function private.validate_mentor_weekly_availability();
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000070',true);
do $test$
declare denied boolean:=false;
begin
 begin
 insert into pg_temp.mentor_weekly_slot_probe(
   mentor_id,weekday,start_time,end_time,timezone)
 values('00000000-0000-4000-8000-000000000070',1,'09:00','10:00','Invalid/TimeZone');
 exception when others then
   if sqlerrm like '%valid weekday, hours, and IANA time zone required%'
   then denied:=true; else raise; end if;
 end;
 if not denied then raise exception 'malformed zone accepted'; end if;

 denied:=false;
 begin
 insert into pg_temp.mentor_weekly_slot_probe(
   mentor_id,weekday,start_time,end_time,timezone)
 values('00000000-0000-4000-8000-000000000070',1,'09:00','10:00','Africa/Addis_Ababa');
 exception when others then
   if sqlerrm like '%active verified mentor required%'
   then denied:=true; else raise; end if;
 end;
 if not denied then raise exception 'unverified mentor published hours'; end if;

 denied:=false;
 begin
 insert into pg_temp.mentor_weekly_slot_probe(
   mentor_id,weekday,start_time,end_time,timezone)
 values('00000000-0000-4000-8000-000000000071',1,'09:00','10:00','Africa/Addis_Ababa');
 exception when others then
   if sqlerrm like '%only the verified mentor or MFA administrator%'
   then denied:=true; else raise; end if;
 end;
 if not denied then raise exception 'different mentor could forge a weekly slot'; end if;
end $test$;
rollback;
select 'mentor_weekly_slot_integrity_smoke_passed' as result;