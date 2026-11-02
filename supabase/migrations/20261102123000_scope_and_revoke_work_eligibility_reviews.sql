-- Narrow work-eligibility decisions to properly scoped MFA-authorized admins.
-- Permit revocation of an existing approval when evidence is withdrawn or invalidated.
-- No payout, fee, flag, or active contract data is modified.
create or replace function public.mela_review_work_eligibility_v1(p_user_id uuid, p_approve boolean, p_note text)
returns jsonb language plpgsql security definer set search_path to ''
as $fn$
declare
  v_admin uuid := (select auth.uid());
  v_profile public.profiles%rowtype;
  v_status text;
  v_note text := trim(coalesce(p_note,''));
begin
  if v_admin is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
     or (auth.jwt()->>'aal') is distinct from 'aal2'
     or not exists (
       select 1 from admin.admin_users au
       join admin.roles ar on ar.id=au.role_id
       where au.user_id=v_admin and au.active
         and (ar.key='super_admin'
           or exists(select 1 from admin.role_permissions rp
             join admin.permissions ap on ap.id=rp.permission_id
             where rp.role_id=au.role_id and ap.key='users.manage'))
     )
     or not exists(select 1 from auth.sessions where user_id=v_admin
       and id::text=auth.jwt()->>'session_id' and (not_after is null or not_after>now()))
    then raise exception 'Active admin session with MFA required' using errcode='42501'; end if;
  if p_user_id is null or p_approve is null or length(v_note) not between 20 and 500
    then raise exception 'Explicit decision and 20–500 character evidence-free verification note are required'; end if;
  select * into v_profile from public.profiles where id=p_user_id;
  if not found or v_profile.role is distinct from 'student'::public.user_role
    or v_profile.account_status is distinct from 'active'
    or v_profile.education_stage_key is null or v_profile.education_stage_key like 'school_%'
    then raise exception 'This user cannot be approved for adult paid work'; end if;
  if p_approve and not private.user_has_adult_work_attestation(p_user_id)
    then raise exception 'Current adult work policy acknowledgement is required'; end if;
  select status into v_status from public.earn_work_eligibility_reviews where user_id=p_user_id for update;
  if v_status is distinct from 'pending'
     and not (v_status='approved' and p_approve=false) then
    raise exception 'Only pending reviews can be decided, or existing approval revoked';
  end if;
  update public.earn_work_eligibility_reviews
    set status=case when p_approve then 'approved' else 'rejected' end,
        adult_verified=p_approve, reviewed_at=now(), reviewed_by=v_admin,
        review_note=v_note where user_id=p_user_id;
  insert into public.admin_audit_logs(actor_id,action,entity_type,entity_id,details)
  values(v_admin,'earn_work_adult_eligibility_review','earn_work_eligibility',p_user_id,
    jsonb_build_object('approved',p_approve,'verification_note',v_note));
  return jsonb_build_object('status',case when p_approve then 'approved' else 'rejected' end);
end
$fn$;
