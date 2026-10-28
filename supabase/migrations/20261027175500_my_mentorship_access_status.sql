-- STAGING ONLY: learner sees their own current mentorship eligibility.
-- This returns no guardian names, birth dates or personal documentation.
create or replace function private.my_mentorship_access_status()
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
declare
  v_user uuid := (select auth.uid());
  v_role text;
  v_stage text;
  v_account_status text;
  v_deleted timestamptz;
  v_reason text;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  select p.role::text,p.education_stage_key,p.account_status,p.deleted_at
    into v_role,v_stage,v_account_status,v_deleted
    from public.profiles p where p.id=v_user;
  if not found or v_role is distinct from 'student'
    or v_account_status is distinct from 'active' or v_deleted is not null then
    v_reason:='inactive_or_ineligible_account';
  elsif v_stage is null then
    v_reason:='education_profile_required';
  elsif v_stage not in ('school_11_12','college_tvet','university') then
    v_reason:='education_stage_not_available';
  elsif private.user_has_guardian_or_adult_clearance(v_user) then
    v_reason:='eligible';
  elsif v_stage='school_11_12' then
    v_reason:='verified_guardian_required';
  else
    v_reason:='approved_adult_review_required';
  end if;
  return jsonb_build_object('allowed',v_reason='eligible','reason',v_reason);
end;
$fn$;
revoke all on function private.my_mentorship_access_status()
  from public,anon,authenticated;
grant execute on function private.my_mentorship_access_status()
  to authenticated;

create or replace function public.my_mentorship_access_status()
returns jsonb language sql security invoker set search_path=''
as $fn$
  select private.my_mentorship_access_status();
$fn$;
revoke all on function public.my_mentorship_access_status()
 from public,anon;
grant execute on function public.my_mentorship_access_status()
 to authenticated;
