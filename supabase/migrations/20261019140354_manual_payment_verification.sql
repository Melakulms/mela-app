-- Isolated payment module. No existing wallet, course or financial tables are changed.
-- Live collection is OFF. No reviewer, bank account or paid product is provisioned.
create schema mela_payments;
revoke all on schema mela_payments from public, anon, authenticated;
grant usage on schema mela_payments to authenticated;

create table mela_payments.settings (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false
);
insert into mela_payments.settings default values;
create table mela_payments.reviewers (
 user_id uuid primary key references auth.users(id), active boolean not null default true
);
create table mela_payments.accounts (
 id uuid primary key default gen_random_uuid(), provider text not null check(provider ~ '^[a-z0-9_-]{2,30}$'),
 recipient text not null check(length(recipient) between 3 and 100), label text not null,
 active boolean not null default false, unique(provider,recipient)
);
create table mela_payments.products (
 id uuid primary key default gen_random_uuid(), title text not null,
 amount_minor bigint not null check(amount_minor > 0 and amount_minor <= 100000000),
 currency text not null default 'ETB' check(currency='ETB'),
 active boolean not null default false
);
create table mela_payments.orders (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 product_id uuid not null references mela_payments.products(id), account_id uuid not null references mela_payments.accounts(id),
 amount_minor bigint not null, currency text not null, provider text not null, recipient text not null,
 status text not null default 'awaiting_payment' check(status in ('awaiting_payment','pending','approved','rejected')),
 reference text, created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '24 hours',
 approved_at timestamptz, reason text not null default 'Awaiting payment reference', attempts integer not null default 0
);
create index payment_order_owner on mela_payments.orders(user_id,created_at);
create table mela_payments.receipts (
 id uuid primary key default gen_random_uuid(), provider text not null, reference text not null,
 recipient text not null, amount_minor bigint not null check(amount_minor > 0), currency text not null check(currency='ETB'),
 paid_at timestamptz not null, verified_order_id uuid not null references mela_payments.orders(id),
 verified_by uuid not null references auth.users(id), verified_at timestamptz not null default now(),
 evidence_note text not null check(length(evidence_note) between 20 and 1000),
 unique(provider,reference), unique(verified_order_id)
);
create table mela_payments.entitlements (
 order_id uuid primary key references mela_payments.orders(id), receipt_id uuid not null unique references mela_payments.receipts(id),
 user_id uuid not null references auth.users(id), product_id uuid not null references mela_payments.products(id), granted_at timestamptz not null default now()
);
create table mela_payments.audit (
 id bigint generated always as identity primary key, order_id uuid references mela_payments.orders(id),
 actor uuid references auth.users(id), action text not null, detail text not null, created_at timestamptz not null default now()
);
-- All access goes through the narrowly scoped RPC. No direct client table grants.
do $$ declare t text; begin
 foreach t in array array['settings','reviewers','accounts','products','orders','receipts','entitlements','audit'] loop
  execute format('alter table mela_payments.%I enable row level security',t);
  execute format('revoke all on table mela_payments.%I from public, anon, authenticated',t);
 end loop;
end $$;

-- Deterministic reconciliation agent. Internal only, runs in the same transaction.
create function mela_payments.reconcile(p_order uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o mela_payments.orders; r mela_payments.receipts; why text;
begin
 select * into strict o from mela_payments.orders where id=p_order for update;
 if o.status in ('approved','rejected') then return jsonb_build_object('status',o.status,'reason',o.reason,'order_id',o.id); end if;
 select * into r from mela_payments.receipts where provider=o.provider and reference=o.reference for update;
 why := case
  when r.id is null then 'Awaiting a verified incoming-account record'
  when r.verified_order_id <> o.id then 'Reference is not verified for this order; administrator review required'
  when r.recipient <> o.recipient then 'Recipient mismatch; administrator review required'
  when r.currency <> o.currency or r.amount_minor <> o.amount_minor then 'Amount or currency mismatch; administrator review required'
  when r.paid_at < o.created_at or r.paid_at > o.expires_at or r.paid_at > now() then 'Payment date is outside the order window; administrator review required'
  when exists(select 1 from mela_payments.entitlements where receipt_id=r.id) then 'Receipt already used; administrator review required'
  else null end;
 if why is not null then
  update mela_payments.orders set status='pending',reason=why where id=o.id;
  return jsonb_build_object('status','pending','reason',why,'order_id',o.id);
 end if;
 insert into mela_payments.entitlements(order_id,receipt_id,user_id,product_id) values(o.id,r.id,o.user_id,o.product_id);
 update mela_payments.orders set status='approved',approved_at=now(),reason='Incoming payment verified; all matching checks passed' where id=o.id;
 insert into mela_payments.audit(order_id,actor,action,detail) values(o.id,auth.uid(),'agent_approved','Matched verified record, provider, reference, recipient, amount, currency, order ownership and payment window');
 return jsonb_build_object('status','approved','reason','Incoming payment verified; all matching checks passed','order_id',o.id);
end $$;
revoke all on function mela_payments.reconcile(uuid) from public,anon,authenticated;

create function mela_payments.command(p_action text, p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid := auth.uid(); o mela_payments.orders; a mela_payments.accounts; p mela_payments.products;
 ref text; result jsonb; note text; paid timestamptz; amount bigint;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or not exists(select 1 from auth.users where id=u) then raise exception 'Sign in with a registered account' using errcode='42501'; end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Invalid request'; end if;
 if p_action like 'admin_%' then
  if (auth.jwt()->>'aal') is distinct from 'aal2' or not exists(select 1 from mela_payments.reviewers where user_id=u and active) then
   raise exception 'Payment reviewer permission and MFA required' using errcode='42501';
  end if;
 end if;
 if p_action='catalog' then
  return jsonb_build_object('enabled',(select enabled from mela_payments.settings),
   'products',coalesce((select jsonb_agg(to_jsonb(x)) from (select id,title,amount_minor,currency from mela_payments.products where active) x),'[]'::jsonb),
   'accounts',coalesce((select jsonb_agg(to_jsonb(x)) from (select id,provider,recipient,label from mela_payments.accounts where active) x),'[]'::jsonb));
 elsif p_action='my_orders' then
  return coalesce((select jsonb_agg(to_jsonb(x)) from (select * from mela_payments.orders where user_id=u order by created_at desc limit 100) x),'[]'::jsonb);
 elsif p_action='admin_queue' then
  return coalesce((select jsonb_agg(to_jsonb(x)) from (select * from mela_payments.orders where status='pending' order by created_at limit 100) x),'[]'::jsonb);
 elsif p_action='admin_audit' then
  return coalesce((select jsonb_agg(to_jsonb(x)) from (select * from mela_payments.audit where order_id=(p_data->>'order_id')::uuid order by id desc limit 100) x),'[]'::jsonb);
 elsif p_action='create_order' then
  if not (select enabled from mela_payments.settings) then raise exception 'Payment collection is not enabled'; end if;
  -- Serialize per user to enforce the daily limit even on concurrent requests.
  perform pg_advisory_xact_lock(hashtextextended(u::text,0));
  if (select count(*) from mela_payments.orders where user_id=u and created_at>now()-interval '24 hours') >= 10 then raise exception 'Daily order limit reached'; end if;
  select * into strict a from mela_payments.accounts where id=(p_data->>'account_id')::uuid and active;
  select * into strict p from mela_payments.products where id=(p_data->>'product_id')::uuid and active;
  insert into mela_payments.orders(user_id,product_id,account_id,amount_minor,currency,provider,recipient)
   values(u,p.id,a.id,p.amount_minor,p.currency,a.provider,a.recipient) returning * into o;
  insert into mela_payments.audit(order_id,actor,action,detail) values(o.id,u,'created','Server-priced order created');
  return to_jsonb(o);
 elsif p_action in ('submit','admin_record','admin_reject','admin_recheck') then
  select * into o from mela_payments.orders where id=(p_data->>'order_id')::uuid for update;
  if o.id is null or (p_action='submit' and o.user_id<>u) then raise exception 'Order not accessible' using errcode='42501'; end if;
  if o.status in ('approved','rejected') then return jsonb_build_object('status',o.status,'reason',o.reason,'order_id',o.id); end if;
  if p_action='submit' then
   ref := upper(trim(p_data->>'reference'));
   if ref is null or ref !~ '^[A-Z0-9][A-Z0-9-]{5,63}$' then raise exception 'Enter a valid transaction reference (6–64 letters, digits or hyphens)'; end if;
   if o.expires_at<now() then raise exception 'Order expired; contact support if you already paid'; end if;
   if o.attempts>=10 then raise exception 'Reference submission limit reached; contact support'; end if;
   -- Unverified claims do not reserve the receipt: prevents reference-squatting attacks.
   update mela_payments.orders set reference=ref,attempts=attempts+1 where id=o.id;
   insert into mela_payments.audit(order_id,actor,action,detail) values(o.id,u,'reference_submitted','Untrusted reference submitted; not proof of payment');
  elsif p_action='admin_record' then
   if p_data->>'confirmed_received' is distinct from 'true' or p_data->>'confirmed_order_owner' is distinct from 'true' then raise exception 'Confirm receipt in receiving account and payer/order ownership'; end if;
   ref := upper(trim(p_data->>'reference')); note := trim(p_data->>'evidence_note');
   paid := (p_data->>'paid_at')::timestamptz; amount := (p_data->>'amount_minor')::bigint;
   if ref is null or ref !~ '^[A-Z0-9][A-Z0-9-]{5,63}$' or note is null or length(note)<20 then raise exception 'Reference and verification evidence required'; end if;
   if paid is null or paid>now() or paid<o.created_at or paid>o.expires_at then raise exception 'Invalid payment date'; end if;
   if (p_data->>'recipient') is distinct from o.recipient or (p_data->>'currency') is distinct from o.currency or amount is distinct from o.amount_minor then raise exception 'Payment amount, currency or recipient does not match the order'; end if;
   if ref is distinct from o.reference then raise exception 'Verified reference does not match customer submission'; end if;
   insert into mela_payments.receipts(provider,reference,recipient,amount_minor,currency,paid_at,verified_order_id,verified_by,evidence_note)
    values(o.provider,ref,o.recipient,amount,o.currency,paid,o.id,u,note);
   insert into mela_payments.audit(order_id,actor,action,detail) values(o.id,u,'incoming_record_verified',note);
  elsif p_action='admin_reject' then
   note:=trim(p_data->>'reason');
   if note is null or length(note) not between 10 and 500 then raise exception 'Provide a reason (10–500 characters)'; end if;
   update mela_payments.orders set status='rejected',reason=note where id=o.id;
   insert into mela_payments.audit(order_id,actor,action,detail) values(o.id,u,'rejected',note);
   return jsonb_build_object('status','rejected','reason',note,'order_id',o.id);
  end if;
  return mela_payments.reconcile(o.id);
 else raise exception 'Unknown payment action'; end if;
end $$;
revoke all on function mela_payments.command(text,jsonb) from public,anon,authenticated;
grant execute on function mela_payments.command(text,jsonb) to authenticated;
create function public.payment_command_v1(p_action text, p_data jsonb default '{}'::jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select mela_payments.command(p_action,p_data); $$;
revoke all on function public.payment_command_v1(text,jsonb) from public,anon,authenticated;
grant execute on function public.payment_command_v1(text,jsonb) to authenticated;
notify pgrst,'reload schema';
