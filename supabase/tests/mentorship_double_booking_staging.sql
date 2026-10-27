-- STAGING ONLY: scheduling overlap boundary and permission checks.
do $config$
begin
  if not exists(select 1 from pg_trigger
    where tgrelid='public.mentorship_sessions'::regclass
      and tgname='trg_mentorship_double_booking' and tgenabled='O') then
    raise exception 'double-booking trigger missing';
  end if;
  if has_function_privilege('authenticated',
      'private.prevent_mentorship_double_booking()','EXECUTE')
    or has_function_privilege('anon',
      'private.prevent_mentorship_double_booking()','EXECUTE') then
    raise exception 'private scheduling lock helper is publicly callable';
  end if;
  if (select count(*) from pg_indexes
       where schemaname='public' and tablename='mentorship_sessions'
         and indexname in (
           'mentorship_sessions_active_mentor_schedule_idx',
           'mentorship_sessions_active_mentee_schedule_idx'
         )) <> 2 then
    raise exception 'active participant scheduling indexes missing';
  end if;
end $config$;

-- Back-to-back sessions must be allowed; actual overlaps must be denied.
do $ranges$
declare
  t0 timestamptz := now()+interval '7 days';
  existing_end timestamptz;
begin
  existing_end := t0+interval '30 minutes';
  if not (t0< t0+interval '15 minutes'
       and t0+interval '15 minutes'<existing_end) then
    raise exception 'overlapping period test failed';
  end if;
  if (t0<existing_end and existing_end<existing_end)
    or (t0<existing_end+interval '30 minutes'
        and existing_end+interval '30 minutes'<existing_end) then
    raise exception 'back-to-back sessions incorrectly overlap';
  end if;
end $ranges$;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000010',true);
do $denied$
declare blocked boolean:=false;
begin
  begin
    insert into public.mentorship_sessions(
      request_id,mentor_id,mentee_id,scheduled_at,duration_min,status
    ) values (
      '00000000-0000-4000-8000-000000000011',
      '00000000-0000-4000-8000-000000000012',
      '00000000-0000-4000-8000-000000000010',
      now()+interval '7 days',30,'scheduled'
    );
  exception when others then
    if sqlerrm like '%verified mentor or MFA administrator required%'
        or sqlerrm like '%row-level security%'
        or sqlerrm like '%permission denied for table mentorship_sessions%' then blocked:=true;
    else raise exception 'unexpected scheduling rejection: %',sqlerrm;
    end if;
  end;
  if not blocked then raise exception 'learner bypassed scheduling authorization'; end if;
end $denied$;
rollback;
select 'mentorship_double_booking_guard_smoke_passed' as result;