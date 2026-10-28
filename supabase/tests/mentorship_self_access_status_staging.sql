-- STAGING ONLY. Self-only mentorship access API must not expose private
-- learner DOB, guardian identity, or authorization state of arbitrary users.
do $verify$
declare v_public text;
declare v_private text;
begin
  if has_function_privilege('anon','public.my_mentorship_access_status()','EXECUTE') then
    raise exception 'anonymous users can inspect mentorship eligibility';
  end if;
  if not has_function_privilege('authenticated','public.my_mentorship_access_status()','EXECUTE') then
    raise exception 'authenticated users cannot inspect own mentorship eligibility';
  end if;
  select pg_get_functiondef('private.my_mentorship_access_status()'::regprocedure)
    into v_private;
  select pg_get_functiondef('public.my_mentorship_access_status()'::regprocedure)
    into v_public;
  if v_private not like '%auth.uid()%'
    or v_private not like '%private.user_has_guardian_or_adult_clearance(v_user)%'
    or v_private not like '%education_profile_required%'
    or v_public not like '%private.my_mentorship_access_status()%'
    then raise exception 'self-only verified mentorship clearance not wired';
  end if;
  if v_private like '%guardian_email%' or v_private like '%date_of_birth%' then
    raise exception 'eligibility API exposes sensitive guardian or age fields';
  end if;
end $verify$;

begin;
set local role authenticated;
do $negative$
declare denied boolean:=false;
begin
  begin
    perform public.my_mentorship_access_status();
  exception when others then
    if sqlerrm like '%authentication required%' then denied:=true;
    else raise exception 'unexpected self-only access response: %',sqlerrm; end if;
  end;
  if not denied then raise exception 'missing identity bypassed access check'; end if;
end $negative$;
rollback;
select 'mentorship_self_clearance_api_smoke_passed' as result;