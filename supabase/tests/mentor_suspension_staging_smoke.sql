-- Staging-only MFA suspension denial test. Never mutates actual profiles.
do $grant_guard$
begin
 if has_function_privilege('anon','public.suspend_mentorship_mentor(uuid,text)','EXECUTE') then
   raise exception 'anonymous users must not access mentor suspension';
 end if;
 if not has_function_privilege('authenticated','public.suspend_mentorship_mentor(uuid,text)','EXECUTE') then
   raise exception 'mentor suspension RPC missing for authenticated MFA admin';
 end if;
 if has_column_privilege('authenticated','public.mentor_profiles','active','UPDATE') then
   raise exception 'ordinary authenticated users should not directly change mentor status';
 end if;
end $grant_guard$;
begin;
set local role authenticated;
do $deny$
declare denied boolean:=false;
begin
 begin
  perform public.suspend_mentorship_mentor(
    '00000000-0000-0000-0000-000000000022'::uuid,
    'Valid case reference but no MFA administrator session');
 exception when others then
  if sqlerrm like '%MFA administrator required%' then denied:=true;
  else raise; end if;
 end;
 if not denied then raise exception 'mentor suspension bypassed MFA auth'; end if;
end $deny$;
rollback;
select 'mentor_suspension_negative_test_passed' as status;
