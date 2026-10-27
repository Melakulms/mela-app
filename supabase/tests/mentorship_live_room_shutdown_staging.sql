-- STAGING ONLY: unapproved live room and recording references are denied.
-- The whole probe is enclosed in a rollback transaction.
do $schema$
begin
  if not exists(select 1 from pg_trigger
      where tgrelid='public.mentorship_sessions'::regclass
        and tgname='trg_block_unapproved_live_mentorship'
        and tgenabled='O') then
    raise exception 'mentorship live room blocker missing';
  end if;
  if has_function_privilege('authenticated',
    'private.block_unapproved_live_mentorship()','EXECUTE') then
    raise exception 'private live room guard unexpectedly public';
  end if;
end $schema$;
begin;
do $probe$
declare blocked boolean:=false;
begin
  begin
    insert into public.mentorship_sessions (
      mentor_id,mentee_id,request_id,scheduled_at,duration_min,status,call_room_id
    ) values (
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000003',
      now()+interval '2 days',30,'scheduled',
      'https://unverified.example.invalid/unsafe-meeting'
    );
  exception when others then
    if sqlerrm like '%live mentorship calls and recordings are not enabled%' then
      blocked:=true;
    else raise exception 'unexpected unapproved live room outcome: %',sqlerrm; end if;
  end;
  if not blocked then raise exception 'unapproved mentoring meeting URL bypassed shutdown'; end if;
end $probe$;
rollback;
select 'unapproved_mentorship_live_room_rejected' as result;