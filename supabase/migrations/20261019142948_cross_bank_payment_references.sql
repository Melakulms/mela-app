-- Preserve the sender claim separately from the verified incoming-account reference.
-- Supports manual reconciliation for any configured receiving bank, including interbank transfers.
-- This does not assert automatic API integration with any bank.
alter table mela_payments.orders add column sending_bank text;
alter table mela_payments.receipts add column customer_reference text;
alter table mela_payments.receipts add column sending_bank text;
update mela_payments.orders set sending_bank=provider where reference is not null;
update mela_payments.receipts set customer_reference=reference,sending_bank=provider;
alter table mela_payments.receipts alter column customer_reference set not null;
alter table mela_payments.receipts alter column sending_bank set not null;
create or replace function mela_payments.reconcile(p_order uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o mela_payments.orders; r mela_payments.receipts; why text;
begin
 select * into strict o from mela_payments.orders where id=p_order for update;
 if o.status in ('approved','rejected') then return jsonb_build_object('status',o.status,'reason',o.reason,'order_id',o.id); end if;
 select * into r from mela_payments.receipts where verified_order_id=o.id for update;
 why := case
  when r.id is null then 'Awaiting a verified incoming-account record'
  when r.verified_order_id <> o.id then 'Reference is not verified for this order; administrator review required'
  when r.customer_reference is distinct from o.reference or r.sending_bank is distinct from o.sending_bank then 'Submitted payment details changed; administrator review required'
  when r.provider <> o.provider then 'Receiving provider mismatch; administrator review required'
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
create or replace function mela_payments.command(p_action text, p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid := auth.uid(); o mela_payments.orders; a mela_payments.accounts; p mela_payments.products;
 ref text; result jsonb; note text; paid timestamptz; amount bigint; incoming_ref text; sender_bank text;
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
   if ref is null or ref !~ '^[A-Z0-9][A-Z0-9 /_.:-]{2,127}$' then raise exception 'Enter a valid transaction reference (3–128 letters, digits, spaces or /_.:-)'; end if;
   if o.expires_at<now() then raise exception 'Order expired; contact support if you already paid'; end if;
   if o.attempts>=10 then raise exception 'Reference submission limit reached; contact support'; end if;
   -- Unverified claims do not reserve the receipt: prevents reference-squatting attacks.
   sender_bank := lower(trim(coalesce(p_data->>'sending_bank',o.sending_bank,o.provider)));
   if length(sender_bank) not between 2 and 80 or sender_bank ~ '[[:cntrl:]]' then raise exception 'Enter the sending bank or wallet name'; end if;
   update mela_payments.orders set reference=ref,sending_bank=sender_bank,attempts=attempts+1 where id=o.id;
   insert into mela_payments.audit(order_id,actor,action,detail) values(o.id,u,'reference_submitted','Untrusted reference submitted; not proof of payment');
  elsif p_action='admin_record' then
   if p_data->>'confirmed_received' is distinct from 'true' or p_data->>'confirmed_order_owner' is distinct from 'true' then raise exception 'Confirm receipt in receiving account and payer/order ownership'; end if;
   ref := upper(trim(p_data->>'reference')); note := trim(p_data->>'evidence_note');
   paid := (p_data->>'paid_at')::timestamptz; amount := (p_data->>'amount_minor')::bigint;
   if ref is null or ref !~ '^[A-Z0-9][A-Z0-9 /_.:-]{2,127}$' or note is null or length(note)<20 then raise exception 'Reference and verification evidence required'; end if;
   if paid is null or paid>now() or paid<o.created_at or paid>o.expires_at then raise exception 'Invalid payment date'; end if;
   if (p_data->>'recipient') is distinct from o.recipient or (p_data->>'currency') is distinct from o.currency or amount is distinct from o.amount_minor then raise exception 'Payment amount, currency or recipient does not match the order'; end if;
   if ref is distinct from o.reference then raise exception 'Verified reference does not match customer submission'; end if;
   incoming_ref:=upper(trim(coalesce(p_data->>'incoming_reference',ref)));
   if incoming_ref !~ '^[A-Z0-9][A-Z0-9 /_.:-]{2,127}$' then raise exception 'Enter the receiving-account transaction reference'; end if;
   insert into mela_payments.receipts(customer_reference,sending_bank,provider,reference,recipient,amount_minor,currency,paid_at,verified_order_id,verified_by,evidence_note)
    values(ref,coalesce(o.sending_bank,o.provider),o.provider,incoming_ref,o.recipient,amount,o.currency,paid,o.id,u,note);
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
notify pgrst,'reload schema';
