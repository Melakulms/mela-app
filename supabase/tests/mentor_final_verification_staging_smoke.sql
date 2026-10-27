-- Staging-only mentor final credential verification smoke, no rows persist.
do $permissions$
begin
  if has_function_privilege('anon','public.finalize_mentorship_verification(uuid,boolean,boolean,text)','EXECUTE') then
    raise exception 'anonymous credential verification API must be denied';
  end if;
  if not has_function_privilege('authenticated','public.finalize_mentorship_verification(uuid,boolean,boolean,text)','EXECUTE') then
    raise exception 'authenticated MFA administrator cannot access credential verification';
  end if;
  if has_table_privilege('authenticated','public.mentor_profiles','INSERT') then
    raise exception 'generic authenticated role can create verified mentor profile';
  end if;
  if has_column_privilege('authenticated','public.mentor_profiles','verified','UPDATE') then
    raise exception 'ordinary users can update mentor verified flag';
  end if;
  if has_function_privilege('authenticated','private.guard_verified_mentor_public_fields()','EXECUTE') then
    raise exception 'private profile field guard must not be callable by normal users';
  end if;
end $permissions$;
begin;
set local role authenticated;
do $unauthorized$
declare v_denied boolean:=false;
begin
  begin
    perform public.finalize_mentorship_verification(
      '00000000-0000-0000-0000-000000000001'::uuid,
      true,true,'This review must not be accepted without an authenticated MFA administrator');
  exception when others then
    if sqlerrm like '%MFA-verified administrator required%' then v_denied:=true;
    else raise; end if;
  end;
  if not v_denied then
    raise exception 'missing authenticated MFA admin identity bypassed verification';
  end if;
end $unauthorized$;
rollback;
select 'mentor_final_verification_negative_test_passed' as status;