-- Link rewards to the exact verified first order; preserve referral attribution
-- independently of whether financial rewards are enabled.
alter table public.invitation_commissions add column if not exists source_order_id uuid
   references mela_payments.orders(id) on delete restrict;
create unique index if not exists invitation_commissions_unique_source_order
   on public.invitation_commissions(source_order_id) where source_order_id is not null;
CREATE OR REPLACE FUNCTION public.process_registration_invitation(p_registered_user_id uuid, p_invitation_code text)
 RETURNS invitation_commissions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_code public.referral_codes%rowtype;
begin
  if p_registered_user_id is null or nullif(trim(p_invitation_code),'') is null then return null; end if;
  select * into v_code from public.referral_codes where upper(code)=upper(trim(p_invitation_code)) and active limit 1;
  if v_code.id is null or v_code.owner_user_id=p_registered_user_id then return null; end if;
  insert into public.registration_referrals(registered_user_id,inviter_user_id,referral_code_id,invitation_code)
  values(p_registered_user_id,v_code.owner_user_id,v_code.id,v_code.code)
  on conflict(registered_user_id) do nothing;
  return null;
end $function$
;
revoke all on function public.process_registration_invitation(uuid,text) from public,anon,authenticated;
grant execute on function public.process_registration_invitation(uuid,text) to service_role;
CREATE OR REPLACE FUNCTION private.mela_verified_membership_bridge()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_key text; v_plan public.subscription_plans%rowtype;
        v_member_id uuid; v_ref public.registration_referrals%rowtype;
        v_amount numeric; v_tier text;
begin
  if new.status=old.status then return new; end if;
  select product_key into v_key from mela_payments.products where id=new.product_id;
  if v_key not in ('mela_pro_monthly','mela_premium_monthly') then return new; end if;
  if new.status='reversed' then
    update public.mela_paid_memberships set status='reversed' where order_id=new.id and status='active';
    update public.invitation_commissions set status='cancelled', cancelled_at=now(),cancellation_reason='Verified paid subscription reversed'
      where source_order_id=new.id and registered_user_id=new.user_id and status='pending'
        and exists(select 1 from public.mela_paid_memberships m where m.order_id=new.id and m.status='reversed');
    return new;
  end if;
  if new.status<>'approved' then return new; end if;
  if not exists (
      select 1 from mela_payments.receipts r join mela_payments.entitlements e on e.receipt_id=r.id
      where r.verified_order_id=new.id and e.order_id=new.id and e.user_id=new.user_id
        and r.amount_minor=new.amount_minor and r.currency=new.currency and r.recipient=new.recipient
  ) then
    raise exception 'Verified receipt and entitlement are required for MELA membership';
  end if;
  if (v_key='mela_pro_monthly' and new.amount_minor<>5000)
     or (v_key='mela_premium_monthly' and new.amount_minor<>10000)
     or new.currency<>'ETB' then raise exception 'Subscription amount does not match plan'; end if;
  select * into v_plan from public.subscription_plans
   where active and currency='ETB' and price_minor=new.amount_minor and
     tier=(case when v_key='mela_pro_monthly' then 'normal' else 'premium' end)
     and billing_period_days=30 limit 1;
  if v_plan.id is null then raise exception 'MELA subscription plan is not configured'; end if;
  insert into public.mela_paid_memberships(user_id,plan_id,order_id,starts_at,expires_at)
    values(new.user_id,v_plan.id,new.id,now(),now()+interval '30 days')
    on conflict(order_id) do nothing returning id into v_member_id;
  if v_member_id is null then return new; end if;
  -- Learning entitlements must expire with the paid 30-day membership.
  update public.mela_user_learning_entitlements
    set ends_at=now()+interval '30 days',updated_at=now()
    where user_id=new.user_id and source='payment' and source_reference=new.id::text
       and product_key=v_key and status='active';
  if not found then raise exception 'Paid learning entitlement was not recorded'; end if;

  -- A returning buyer never generates a second first-purchase award.
  if exists(select 1 from public.mela_paid_memberships where user_id=new.user_id and id<>v_member_id)
    or exists(select 1 from public.user_subscriptions where user_id=new.user_id and status='premium_active') then return new; end if;
  select * into v_ref from public.registration_referrals where registered_user_id=new.user_id;
  if v_ref.id is null or v_ref.inviter_user_id=new.user_id then return new; end if;
  if not exists(select 1 from public.referral_program_config where id=true and enabled) then return new; end if;
  v_tier := case when v_key='mela_premium_monthly' then 'premium' else 'free' end;
  select case when v_tier='premium' then premium_commission_amount else free_commission_amount end
   into v_amount from public.referral_program_config where id=true;
  if v_amount is null or (new.amount_minor=5000 and v_amount<>20) or (new.amount_minor=10000 and v_amount<>40)
  then raise exception 'Commission configuration must match 20/40 ETB'; end if;
  insert into public.invitation_commissions
     (inviter_user_id,registered_user_id,invitation_code,registration_id,amount,currency,status,transaction_reference,eligibility_reason,invitee_tier,source_order_id)
  values(v_ref.inviter_user_id,new.user_id,v_ref.invitation_code,v_ref.id,v_amount,'ETB','pending',
     'INV-'||upper(replace(gen_random_uuid()::text,'-','')),
     'First verified paid MELA subscription; payout pending compliance review',v_tier,new.id)
  on conflict(registered_user_id) where status<>'cancelled' do nothing;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.mela_record_referral_payout_v1(p_commission_id uuid, p_provider text, p_reference text, p_evidence_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user uuid:=auth.uid(); v_comm public.invitation_commissions%rowtype;
begin
  if v_user is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
     or (auth.jwt()->>'aal') is distinct from 'aal2'
     or not exists(select 1 from admin.admin_users where user_id=v_user and active)
     or not exists(select 1 from auth.sessions where user_id=v_user and id::text=auth.jwt()->>'session_id' and (not_after is null or not_after>now()))
  then raise exception 'Active MELA admin with MFA is required' using errcode='42501'; end if;
  if not exists(select 1 from public.platform_feature_flags where feature_key='payouts' and enabled)
    then raise exception 'Commission payouts remain disabled'; end if;
  if p_provider not in ('telebirr','dashen','bank')
    or p_reference !~ '^[A-Za-z0-9][A-Za-z0-9-]{5,63}$'
    or length(coalesce(trim(p_evidence_note),'')) not between 20 and 500
  then raise exception 'Bank method, transfer reference, and verification evidence are required'; end if;
  select * into v_comm from public.invitation_commissions where id=p_commission_id for update;
  if v_comm.id is null or v_comm.status<>'pending' then raise exception 'Pending commission required'; end if;
  if not exists (
      select 1 from public.mela_paid_memberships m where m.user_id=v_comm.registered_user_id
         and m.status='active' and m.expires_at>now()
  ) then raise exception 'Verified active paid membership required'; end if;
  if exists (
      select 1 from public.mela_paid_memberships m join mela_payments.orders o on o.id=m.order_id
       where m.user_id=v_comm.registered_user_id and o.status='reversed'
  ) then raise exception 'Refunded membership cannot earn a payout'; end if;
  if not exists (select 1 from public.payout_accounts p
      where p.user_id=v_comm.inviter_user_id and p.active and p.currency='ETB') then
    raise exception 'Verified, active inviter payout account is required';
  end if;
  if exists (select 1 from public.profiles p
      where p.id=v_comm.inviter_user_id and p.role='student'::public.user_role) then
    raise exception 'Student payouts require a separate verified guardian flow';
  end if;
  -- Confirm this commission matches the exact plan and first verified order.
  if not exists (
    select 1
    from public.mela_paid_memberships m
    join public.subscription_plans sp on sp.id=m.plan_id
    join mela_payments.orders o on o.id=m.order_id
    join mela_payments.receipts r on r.verified_order_id=o.id
    where m.user_id=v_comm.registered_user_id and m.order_id=v_comm.source_order_id
      and m.status='active' and m.expires_at>now()
      and o.status='approved' and r.amount_minor=o.amount_minor
      and (
        (sp.price_minor=5000 and o.amount_minor=5000 and sp.tier='normal'
            and v_comm.amount=20 and v_comm.invitee_tier='free')
        or
        (sp.price_minor=10000 and o.amount_minor=10000 and sp.tier='premium'
            and v_comm.amount=40 and v_comm.invitee_tier='premium')
      )
  ) then raise exception 'First verified Pro/Premium purchase and exact commission value required';
  end if;
  insert into private.mela_referral_payout_records(commission_id,provider,reference,evidence_note,actor_id)
   values(v_comm.id,p_provider,upper(p_reference),trim(p_evidence_note),v_user);
  update public.invitation_commissions set status='paid',paid_at=now()
   where id=v_comm.id and status='pending';
  insert into public.admin_audit_logs(actor_id,action,entity_type,entity_id,details)
   values(v_user,'mela_referral_payout_recorded','invitation_commission',v_comm.id,
     jsonb_build_object('provider',p_provider,'reference',upper(p_reference),'amount',v_comm.amount,'currency',v_comm.currency));
  return jsonb_build_object('status','paid','commission_id',v_comm.id);
end $function$
;
