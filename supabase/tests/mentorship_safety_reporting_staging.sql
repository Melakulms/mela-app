-- STAGING ONLY: check current RPC grants and report-case RLS before live accounts.
do $inspect$
declare
  v_def text;
  v_pol text;
begin
  if has_function_privilege('anon',
    'public.report_mentorship_concern(text,uuid,text,text)','EXECUTE')
    or has_function_privilege('anon',
    'public.review_mentorship_concern(uuid,text,text)','EXECUTE') then
    raise exception 'anonymous mentorship safety RPC permission detected';
  end if;
  if not has_function_privilege('authenticated',
    'public.report_mentorship_concern(text,uuid,text,text)','EXECUTE') then
    raise exception 'signed-in student cannot submit concern';
  end if;
  if has_table_privilege('authenticated','public.reports','INSERT')
    or has_table_privilege('authenticated','public.reports','UPDATE') then
    raise exception 'generic safety table write grant unexpectedly opened';
  end if;
  select qual into v_pol from pg_policies
    where schemaname='public' and tablename='reports'
      and policyname='Reports readable by reporter or admin';
  if v_pol not like '%aal2%' then
    raise exception 'sensitive mentorship case reader MFA protection missing';
  end if;
  select pg_get_functiondef(
    'private.report_mentorship_concern(text,uuid,text,text)'::regprocedure
  ) into v_def;
  if v_def not like '%r.mentor_id,r.mentee_id%'
     or v_def not like '%r.reporter_id=v_actor%' then
    raise exception 'target-participant/submitter rate check missing';
  end if;
end $inspect$;
begin;
set local role authenticated;
do $unauthorized$
declare blocked boolean:=false;
begin
  begin
    perform public.report_mentorship_concern(
      'mentorship_session','00000000-0000-4000-8000-000000000011'::uuid,
      'Unsafe contact','Test identity without a trusted signed-in user');
  exception when others then
    if sqlerrm like '%sign in to submit%' then blocked:=true;
    else raise exception 'unexpected case-report result: %',sqlerrm; end if;
  end;
  if not blocked then raise exception 'missing identity could submit a case'; end if;
  blocked:=false;
  begin
    perform public.review_mentorship_concern(
      '00000000-0000-4000-8000-000000000011'::uuid,
      'resolved','This caller did not sign in with the required MFA token');
  exception when others then
    if sqlerrm like '%MFA-verified safety administrator required%' then blocked:=true;
    else raise exception 'unexpected admin case result: %',sqlerrm; end if;
  end;
  if not blocked then raise exception 'missing MFA identity could resolve a case'; end if;
end $unauthorized$;
rollback;
select 'mentorship_case_report_auth_smoke_passed' result;