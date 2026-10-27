-- STAGING ONLY. Private mentor safeguarding review notes regression.
do $assert$
declare v_review text;
begin
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='private' and c.relname='mentorship_case_internal_notes'
      and c.relrowsecurity) then
    raise exception 'private review notes are not RLS-protected';
  end if;
  if has_table_privilege('authenticated','private.mentorship_case_internal_notes','SELECT')
    or has_table_privilege('anon','private.mentorship_case_internal_notes','SELECT') then
    raise exception 'safeguarding internal notes accessible without MFA';
  end if;
  if has_function_privilege('anon',
    'public.get_mentorship_case_review_history(uuid)','EXECUTE') then
    raise exception 'anonymous user may fetch private safeguarding history';
  end if;
  select pg_get_functiondef('private.review_mentorship_concern(uuid,text,text)'::regprocedure)
    into v_review;
  if v_review not like '%insert into private.mentorship_case_internal_notes%'
    or v_review not like '%Your report is under confidential review.%'
    or v_review like '%resolution_notes=v_notes%' then
    raise exception 'review evidence is not segregated from reporter-visible status';
  end if;
end $assert$;
begin;
set local role authenticated;
do $deny$
declare denied boolean:=false;
begin
  begin
    perform public.get_mentorship_case_review_history(
      '00000000-0000-4000-8000-000000000011'::uuid);
  exception when others then
    if sqlerrm like '%MFA-verified safety administrator required%' then denied:=true;
    else raise exception 'unexpected private case read denial: %',sqlerrm; end if;
  end;
  if not denied then raise exception 'missing MFA read confidential mentor report'; end if;
end $deny$;
rollback;
select 'private_mentorship_case_notes_safeguarding_smoke_passed' result;