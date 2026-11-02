-- Adult eligibility is independently reviewed. A checkbox or school-stage selection
-- must never authorize real-money freelance work by itself.
-- Do not enable Earn & Work or payouts in this migration.
create table if not exists public.earn_work_eligibility_reviews (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  adult_verified boolean not null default false,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  review_note text
);
alter table public.earn_work_eligibility_reviews enable row level security;
revoke all on public.earn_work_eligibility_reviews from public, anon, authenticated;
grant select on public.earn_work_eligibility_reviews to authenticated;
drop policy if exists mela_work_eligibility_own_read on public.earn_work_eligibility_reviews;
create policy mela_work_eligibility_own_read on public.earn_work_eligibility_reviews
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin_user());

create or replace function private.mela_verified_adult_worker(p_user_id uuid)
returns boolean language sql stable security definer set search_path to ''
as $fn$
  select exists (
    select 1 from public.profiles p
    join public.earn_work_eligibility_reviews r on r.user_id = p.id
    where p.id = p_user_id and p.role = 'student'::public.user_role
      and p.account_status = 'active'
      and p.education_stage_key is not null
      and p.education_stage_key not like 'school_%'
      and r.status = 'approved' and r.adult_verified
      and private.user_has_adult_work_attestation(p_user_id)
  )
$fn$;
revoke all on function private.mela_verified_adult_worker(uuid) from public,anon,authenticated;

create or replace function public.mela_work_eligibility_status_v1()
returns jsonb language plpgsql stable security definer set search_path to ''
as $fn$
declare
  v_uid uuid := (select auth.uid());
  v_stage text;
  v_account text;
  v_status text;
  v_work boolean;
begin
  if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
    then raise exception 'Authenticated MELA account required' using errcode='42501'; end if;
  select education_stage_key, account_status into v_stage, v_account
    from public.profiles where id=v_uid;
  select status into v_status from public.earn_work_eligibility_reviews where user_id=v_uid;
  v_work := coalesce(public.platform_feature_available('earn_work'),false);
  return jsonb_build_object(
    'status', coalesce(v_status,'not_requested'),
    'school_learner',coalesce(v_stage like 'school_%',false),
    'policy_accepted',public.has_current_policy_acknowledgement('adult_work_eligibility'),
    'can_request',v_account='active' and v_stage is not null and v_stage not like 'school_%',
    'can_apply',v_work and private.mela_verified_adult_worker(v_uid),
    'work_enabled',v_work
  );
end
$fn$;

create or replace function public.mela_request_work_eligibility_v1()
returns jsonb language plpgsql security definer set search_path to ''
as $fn$
declare
  v_uid uuid := (select auth.uid());
  v_profile public.profiles%rowtype;
  v_existing text;
begin
  if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
    then raise exception 'Authenticated MELA account required' using errcode='42501'; end if;
  select * into v_profile from public.profiles where id=v_uid;
  if not found or v_profile.account_status is distinct from 'active'
    or v_profile.role is distinct from 'student'::public.user_role
    or v_profile.education_stage_key is null
    or v_profile.education_stage_key like 'school_%'
    then raise exception 'Only eligible non-school learner accounts can request adult work review' using errcode='42501'; end if;
  if not public.has_current_policy_acknowledgement('adult_work_eligibility')
    then raise exception 'Read and accept the current adult work policy before requesting review' using errcode='42501'; end if;
  select status into v_existing from public.earn_work_eligibility_reviews where user_id=v_uid for update;
  if v_existing='rejected' then
    raise exception 'A previous request was rejected; contact MELA support for a further review';
  end if;
  if v_existing is null then
    insert into public.earn_work_eligibility_reviews(user_id) values(v_uid);
    v_existing := 'pending';
  end if;
  return jsonb_build_object('status',v_existing,'message','MELA staff must independently verify adult identity. This request does not authorize paid work.');
end
$fn$;

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
     or not exists(select 1 from admin.admin_users where user_id=v_admin and active)
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
  if v_status is distinct from 'pending' then raise exception 'A pending review is required'; end if;
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

revoke all on function public.mela_work_eligibility_status_v1() from public,anon;
revoke all on function public.mela_request_work_eligibility_v1() from public,anon;
revoke all on function public.mela_review_work_eligibility_v1(uuid,boolean,text) from public,anon;
grant execute on function public.mela_work_eligibility_status_v1() to authenticated;
grant execute on function public.mela_request_work_eligibility_v1() to authenticated;
grant execute on function public.mela_review_work_eligibility_v1(uuid,boolean,text) to authenticated;

-- RESTRICTIVE combines with the existing task/role permissive INSERT policy.
-- This protects direct REST writes even when a client hides an action incorrectly.
drop policy if exists mela_work_verified_adult_proposals on public.marketplace_submissions;
create policy mela_work_verified_adult_proposals
  on public.marketplace_submissions as restrictive for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.earn_work_eligibility_reviews r
      join public.profiles p on p.id=r.user_id
      where r.user_id=user_id and r.status='approved' and r.adult_verified
        and p.role='student'::public.user_role and p.account_status='active'
        and p.education_stage_key is not null
        and p.education_stage_key not like 'school_%'
    )
    and public.has_current_policy_acknowledgement('adult_work_eligibility')
    and public.platform_feature_available('earn_work')
  );

-- Trigger also protects privileged award/accept RPC paths, which can bypass RLS.
create or replace function private.mela_guard_freelance_contract_activation()
returns trigger language plpgsql security definer set search_path to ''
as $fn$
begin
  if (tg_op='INSERT' and new.status in ('proposed','active'))
     or (tg_op='UPDATE' and new.status in ('proposed','active')
         and new.status is distinct from old.status) then
    if not public.platform_feature_available('earn_work')
       or not private.mela_verified_adult_worker(new.freelancer_id)
      then raise exception 'Verified adult worker and active Earn & Work are required'; end if;
  end if;
  return new;
end
$fn$;
drop trigger if exists trg_mela_guard_freelance_contract_activation on public.freelance_contracts;
create trigger trg_mela_guard_freelance_contract_activation
  before insert or update on public.freelance_contracts
  for each row execute function private.mela_guard_freelance_contract_activation();

-- No finance flag or financial record is modified.
