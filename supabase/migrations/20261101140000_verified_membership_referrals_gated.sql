
-- MELA subscriptions and verified referral accounting.
-- Safe deployment: no checkout or payout switches are enabled by this migration.
create table if not exists public.mela_paid_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id),
  order_id uuid not null unique references mela_payments.orders(id),
  status text not null default 'active' check (status in ('active','reversed','expired')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (expires_at > starts_at)
);
create index if not exists mela_paid_memberships_owner_idx on public.mela_paid_memberships(user_id,expires_at desc);
alter table public.mela_paid_memberships enable row level security;
revoke all on public.mela_paid_memberships from public, anon, authenticated;
grant select on public.mela_paid_memberships to authenticated;
do $policy$
begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='mela_paid_memberships' and policyname='mela_paid_memberships_own_select') then
    create policy mela_paid_memberships_own_select on public.mela_paid_memberships
       for select to authenticated using (user_id = (select auth.uid()));
  end if;
end $policy$;

-- Product entries deliberately inactive until an MFA reviewer and receiving accounts are verified.
insert into public.mela_learning_products (
  product_key, product_name,product_type,billing_period,recommended_price_minor,
  active_price_minor,currency,audience_stage_keys,description,features,sale_enabled,active,display_order
)
values
  ('mela_pro_monthly','MELA Pro','subscription','monthly',5000,null,'ETB',
   array['school_1_6','school_7_8','school_9_10','school_11_12','college_tvet','university'],
   'MELA Pro subscription; paid access only after verified bank receipt',
   '["Pro study tools"]'::jsonb,false,true,90),
  ('mela_premium_monthly','MELA Premium','subscription','monthly',10000,null,'ETB',
   array['school_1_6','school_7_8','school_9_10','school_11_12','college_tvet','university'],
   'MELA Premium subscription; paid access only after verified bank receipt',
   '["Premium study tools"]'::jsonb,false,true,91)
on conflict (product_key) do nothing;

insert into mela_payments.products(product_key,title,amount_minor,currency,active)
select p.key,p.title,p.amount,'ETB',false
from (values
  ('mela_pro_monthly','MELA Pro — 50 ETB (30 days)',5000),
  ('mela_premium_monthly','MELA Premium — 100 ETB (30 days)',10000)
) as p(key,title,amount)
where not exists(select 1 from mela_payments.products x where x.product_key=p.key);

insert into mela_payments.tier_grants(payment_product_id,product_key)
select id,product_key from mela_payments.products
where product_key in ('mela_pro_monthly','mela_premium_monthly')
on conflict do nothing;

-- A signup records *attribution only*. It does not create money owed.
create or replace function public.process_registration_invitation(p_registered_user_id uuid,p_invitation_code text)
returns public.invitation_commissions
language plpgsql security definer set search_path=''
as $$
declare v_code public.referral_codes%rowtype;
begin
  if p_registered_user_id is null or nullif(trim(p_invitation_code),'') is null then return null; end if;
  if not exists(select 1 from public.referral_program_config where id=true and enabled) then return null; end if;
  select * into v_code from public.referral_codes where upper(code)=upper(trim(p_invitation_code)) and active limit 1;
  if v_code.id is null or v_code.owner_user_id=p_registered_user_id then return null; end if;
  insert into public.registration_referrals(registered_user_id,inviter_user_id,referral_code_id,invitation_code)
  values(p_registered_user_id,v_code.owner_user_id,v_code.id,v_code.code)
  on conflict(registered_user_id) do nothing;
  return null;
end $$;
revoke all on function public.process_registration_invitation(uuid,text) from public,anon,authenticated;
grant execute on function public.process_registration_invitation(uuid,text) to service_role;

-- Only an approved, reconciled bank receipt triggers membership and the
-- first eligible referral reward. Refund/reversal cancels unpaid awards.
create or replace function private.mela_verified_membership_bridge()
returns trigger language plpgsql security definer set search_path=''
as $$
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
      where registered_user_id=new.user_id and status='pending'
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
     (inviter_user_id,registered_user_id,invitation_code,registration_id,amount,currency,status,transaction_reference,eligibility_reason,invitee_tier)
  values(v_ref.inviter_user_id,new.user_id,v_ref.invitation_code,v_ref.id,v_amount,'ETB','pending',
     'INV-'||upper(replace(gen_random_uuid()::text,'-','')),
     'First verified paid MELA subscription; payout pending compliance review',v_tier)
  on conflict(registered_user_id) where status<>'cancelled' do nothing;
  return new;
end $$;

drop trigger if exists mela_verified_membership_bridge on mela_payments.orders;
create trigger mela_verified_membership_bridge
 after update of status on mela_payments.orders
 for each row execute function private.mela_verified_membership_bridge();

-- A legacy service_role RPC could mark unverified signup commissions as paid.
-- Stop it. Payouts require a separate, MFA-controlled outgoing-transfer process.
create or replace function public.mark_invitation_commission_paid(
 p_commission_id uuid,p_actor_id uuid default null
) returns public.invitation_commissions
language plpgsql security definer set search_path=''
as $$
begin
 raise exception 'Legacy payout disabled: verified outgoing bank transfer and MFA audit are required';
end $$;
revoke all on function public.mark_invitation_commission_paid(uuid,uuid) from public,anon,authenticated;
grant execute on function public.mark_invitation_commission_paid(uuid,uuid) to service_role;

-- Payout records are not public, and collection/payout flags remain untouched.
create table if not exists private.mela_referral_payout_records(
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null unique references public.invitation_commissions(id),
  provider text not null check(provider in ('telebirr','dashen','bank')),
  reference text not null,
  evidence_note text not null,
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(provider,reference)
);
alter table private.mela_referral_payout_records enable row level security;
revoke all on private.mela_referral_payout_records from public,anon,authenticated;

create or replace function public.mela_record_referral_payout_v1(
 p_commission_id uuid,p_provider text,p_reference text,p_evidence_note text
) returns jsonb language plpgsql security definer set search_path=''
as $$
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
  insert into private.mela_referral_payout_records(commission_id,provider,reference,evidence_note,actor_id)
   values(v_comm.id,p_provider,upper(p_reference),trim(p_evidence_note),v_user);
  update public.invitation_commissions set status='paid',paid_at=now()
   where id=v_comm.id and status='pending';
  insert into public.admin_audit_logs(actor_id,action,entity_type,entity_id,details)
   values(v_user,'mela_referral_payout_recorded','invitation_commission',v_comm.id,
     jsonb_build_object('provider',p_provider,'reference',upper(p_reference),'amount',v_comm.amount,'currency',v_comm.currency));
  return jsonb_build_object('status','paid','commission_id',v_comm.id);
end $$;
revoke all on function public.mela_record_referral_payout_v1(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.mela_record_referral_payout_v1(uuid,text,text,text) to authenticated;

-- The dashboard reads private membership state; no financial writes are client-accessible.
