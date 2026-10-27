-- STAGING ONLY. Outcome evidence cannot be fabricated or automatically certified.
do $schema$
declare body text;
begin
  if has_table_privilege('anon','public.mentorship_outcome_claims','SELECT')
    or has_table_privilege('anon','public.mentorship_outcome_claims','INSERT') then
    raise exception 'anonymous evidence access must be denied';
  end if;
  if not (select relrowsecurity from pg_class
      where oid='public.mentorship_outcome_claims'::regclass) then
    raise exception 'outcome claims require RLS';
  end if;
  if has_column_privilege('authenticated','public.mentorship_outcome_claims','status','INSERT')
    or has_column_privilege('authenticated','public.mentorship_outcome_claims','outcome_text','UPDATE')
    or has_column_privilege('authenticated','public.mentorship_outcome_claims','created_at','INSERT') then
    raise exception 'claimant can forge review status, modify proof or timestamps';
  end if;
  if not exists(select 1 from pg_trigger
       where tgrelid='public.mentorship_outcome_claims'::regclass
         and tgname='trg_guard_mentorship_outcome_claim'
         and tgenabled='O') then
    raise exception 'outcome identity and completed-session guard missing';
  end if;
  select pg_get_functiondef('private.guard_mentorship_outcome_claim()'::regprocedure)
    into body;
  if body not like '%private.user_has_guardian_or_adult_clearance(new.learner_id)%'
    or body not like '%s.status=''completed''%'
    or body not like '%m.verified and m.active%' then
    raise exception 'outcome claim must require real completed mentor relation and verified safety';
  end if;
end $schema$;
begin;
set local role authenticated;
do $negative$
declare blocked boolean:=false;
begin
  begin
    insert into public.mentorship_outcome_claims(
      session_id,learner_id,mentor_id,category,outcome_text)
    values(
      '00000000-0000-4000-8000-000000000011',
      '00000000-0000-4000-8000-000000000012',
      '00000000-0000-4000-8000-000000000013',
      'academic',
      'This fake learning claim must be blocked without a signed-in learner.');
  exception when others then
    if sqlerrm like '%signed-in mentorship participant required%'
      or sqlerrm like '%row-level security%' then blocked:=true;
    else raise exception 'unexpected claim denial: %',sqlerrm;end if;
  end;
  if not blocked then raise exception 'unsigned caller forged an outcome';end if;
end $negative$;
rollback;
select 'mentorship_outcome_evidence_security_smoke_passed' as result;