-- Verified MELA Pro/Premium benefits require a matched paid order and unexpired entitlement.
-- Legacy school subscriptions and one-time grants keep their previous semantics.
create or replace function private.mela_user_has_question_access(p_uid uuid,p_tier text)
returns boolean language sql stable security definer set search_path=''
as $$
 select case
 when p_tier='free' then true
 when p_uid is null then false
 when p_tier='subscription' then exists(
  select 1 from public.mela_user_learning_entitlements e
  where e.user_id=p_uid and e.status='active'
   and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())
   and (
    e.product_key in ('school_plus_monthly','school_plus_annual','family_plus_monthly','institution_learning_license')
    or (
     e.product_key in ('mela_pro_monthly','mela_premium_monthly')
     and exists (
      select 1 from public.mela_paid_memberships m
      join mela_payments.orders o on o.id=m.order_id
      join mela_payments.receipts r on r.verified_order_id=o.id
      where m.user_id=p_uid and m.status='active'
        and m.starts_at<=now() and m.expires_at>now()
        and m.order_id::text=e.source_reference and e.source='payment'
        and o.status='approved' and o.user_id=p_uid
        and r.amount_minor=o.amount_minor and r.currency=o.currency
        and r.recipient=o.recipient
        and ((e.product_key='mela_pro_monthly' and o.amount_minor=5000) or
             (e.product_key='mela_premium_monthly' and o.amount_minor=10000))
     )
    )
   )
 )
 when p_tier='one_time' then exists(
  select 1 from public.mela_user_learning_entitlements e
  where e.user_id=p_uid and e.status='active'
    and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())
    and e.product_key in ('grade12_exam_master','institution_learning_license')
 )
 else false end;
$$;

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
    join mela_payments.orders o on o.id=m.order_id
    where m.user_id=p.id and m.status='active' and m.starts_at<=now()
      and m.expires_at>now() and o.status='approved' and o.user_id=p.id
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
