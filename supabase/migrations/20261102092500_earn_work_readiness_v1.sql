-- Safe read-only Earn & Work feature readiness for signed-in accounts.
-- No payment collection, payout, escrow or feature flag is enabled here.
-- Read access to private platform flags is limited to three booleans;
-- callers may only receive their own account's stage/access status.
create or replace function public.mela_earn_work_readiness_v1()
 returns jsonb
 language plpgsql stable security definer
 set search_path = ''
as $$
declare
 v_uid uuid := (select auth.uid());
 v_stage text;
 v_status text;
 v_live boolean;
 v_work boolean;
 v_payout boolean;
begin
 if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
 then raise exception 'Verified MELA account required' using errcode='42501'; end if;
 select p.education_stage_key,p.account_status
 into v_stage,v_status
 from public.profiles p where p.id=v_uid;
 if not found or v_status is distinct from 'active'
 then raise exception 'Active MELA account required' using errcode='42501'; end if;
 select coalesce((select f.enabled from public.platform_feature_flags f where f.feature_key='platform_live'),false),
        coalesce((select f.enabled from public.platform_feature_flags f where f.feature_key='earn_work'),false),
        coalesce((select f.enabled from public.platform_feature_flags f where f.feature_key='payouts'),false)
 into v_live,v_work,v_payout;
 return jsonb_build_object(
   'enabled',v_live and v_work,
   'payouts_enabled',v_live and v_work and v_payout,
   'school_learner',coalesce(v_stage like 'school_%',false)
 );
end $$;
revoke all on function public.mela_earn_work_readiness_v1() from public,anon,authenticated;
grant execute on function public.mela_earn_work_readiness_v1() to authenticated;
