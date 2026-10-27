-- STAGING ONLY: private preparation/reflection ACL and actor checks.
do $assert$
begin
 if has_table_privilege('anon','public.mentorship_session_preparations','SELECT')
    or has_table_privilege('anon','public.mentorship_session_reflections','SELECT')
    or has_table_privilege('authenticated','public.mentorship_session_preparations','UPDATE')
       and has_column_privilege('authenticated','public.mentorship_session_preparations','learner_id','UPDATE')
    or has_column_privilege('authenticated','public.mentorship_session_reflections','created_at','INSERT') then
   raise exception 'session journey leaked private notes or permits forged ownership/timestamps';
 end if;
 if not (select relrowsecurity from pg_class
   where oid='public.mentorship_session_preparations'::regclass)
    or not (select relrowsecurity from pg_class
   where oid='public.mentorship_session_reflections'::regclass) then
   raise exception 'session journey RLS missing';
 end if;
 if (select count(*) from pg_trigger
      where (tgrelid='public.mentorship_session_preparations'::regclass
          and tgname='trg_guard_mentorship_preparation' and tgenabled='O')
      or (tgrelid='public.mentorship_session_reflections'::regclass
          and tgname='trg_guard_mentorship_reflection' and tgenabled='O'))<>2 then
   raise exception 'session journal RLS guard missing';
 end if;
end $assert$;
begin;
set local role authenticated;
do $negative$
declare denied boolean:=false;
begin
  begin
    insert into public.mentorship_session_preparations(session_id,learner_id,goal,questions)
    values('00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
      'My goal','Discuss what actions I should take next to succeed.');
  exception when others then
    if sqlerrm like '%only the signed-in learner can prepare this session%'
      or sqlerrm like '%row-level security%' then denied:=true;
    else raise exception 'unexpected prep outcome: %',sqlerrm;end if;
  end;
  if not denied then raise exception 'unsigned account inserted a session preparation';end if;
  denied:=false;
  begin
    insert into public.mentorship_session_reflections(session_id,learner_id,learning_summary,next_step)
    values('00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
      'I learned a useful skill that will help me improve my future choices.',
      'Review notes');
  exception when others then
    if sqlerrm like '%only the signed-in learner may reflect%'
      or sqlerrm like '%row-level security%' then denied:=true;
    else raise exception 'unexpected reflection outcome: %',sqlerrm;end if;
  end;
  if not denied then raise exception 'unsigned account inserted reflection';end if;
end $negative$;
rollback;
select 'mentorship_session_journey_private_smoke_passed' result;