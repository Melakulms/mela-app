-- Do not expose private payment orders to the learner's invoker-role context RPC.
-- The membership record is issued/reversed by a separate trusted payment trigger
-- and protected by user-owned SELECT RLS.
-- Keep the existing RPC contract while reading receipt-linked live subscriptions first.
create or replace function public.get_my_access_context_v35()
returns jsonb language sql stable set search_path=''
as $$
select jsonb_build_object(
 'user_id',p.id,'role',p.role,'role_selected_at',p.role_selected_at,
 'account_status',p.account_status,
 'verified',(p.email_verified or p.phone_verified),
 'email_verified',p.email_verified,'phone_verified',p.phone_verified,
 'profile_completion',p.profile_completion,'onboarding_step',p.onboarding_step,
 'subscription',coalesce(
  (
    select jsonb_build_object(
      'status',case when sp.tier='premium' then 'premium_active' else 'pro_active' end,
      'tier',sp.tier,'plan_key',sp.plan_key,
      'expires_at',m.expires_at,'verified_payment',true)
    from public.mela_paid_memberships m
    join public.subscription_plans sp on sp.id=m.plan_id
    where m.user_id=p.id and m.status='active' and m.starts_at<=now()
      and m.expires_at>now()
    order by m.expires_at desc limit 1
  ),
  (
    select jsonb_build_object(
      'status',us.status,'tier',sp.tier,'plan_key',sp.plan_key,'expires_at',us.expires_at)
    from public.user_subscriptions us
    join public.subscription_plans sp on sp.id=us.plan_id
    where us.user_id=p.id
      and us.status in ('free','premium_pending','premium_active')
      and (us.status<>'premium_active' or us.expires_at>now())
    order by us.created_at desc limit 1
  ),
  jsonb_build_object('status','free','tier','free')
 )
) from public.profiles p where p.id=(select auth.uid());
$$;
