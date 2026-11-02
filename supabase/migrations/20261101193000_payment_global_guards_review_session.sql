-- Harden manual payments: only active MFA administrators can reconcile a receipt.
-- Client catalog and new orders require BOTH global payments and a verified
-- immutable bank receiving identity. Existing orders and reviews remain readable.
CREATE OR REPLACE FUNCTION mela_payments.command(p_action text, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid := auth.uid(); o mela_payments.orders; a mela_payments.accounts; p mela_payments.products;
 ref text; result jsonb; note text; paid timestamptz; amount bigint;
begin
  if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) or not exists(select 1 from auth.users where id=u) then raise exception 'Sign in with a registered account' using errcode='42501'; end if;
  if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Invalid request'; end if;
  if p_action like 'admin_%' then
    if (auth.jwt()->>'aal') is distinct from 'aal2'
       or not exists(select 1 from mela_payments.reviewers where user_id=u and active)
       or not exists(select 1 from admin.admin_users where user_id=u and active)
       or not exists(select 1 from auth.mfa_factors where user_id=u and status='verified')
       or not exists(select 1 from auth.sessions where user_id=u
             and id::text=(auth.jwt()->>'session_id')
             and (not_after is null or not_after>now()))
    then
      raise exception 'Active MELA administrator, payment reviewer and current MFA session required'
        using errcode='42501';
    end if;
  end if;
  if p_action='catalog' then
    -- Never advertise receiving accounts unless global paid checkout is enabled
    -- AND bank ownership has been independently verified by an MFA reviewer.
    return jsonb_build_object(
      'enabled',coalesce((select enabled from mela_payments.settings where singleton),false)
        and coalesce((select enabled from public.platform_feature_flags where feature_key='payments'),false)
        and exists (select 1 from mela_payments.accounts bank
          join mela_payments.account_verifications v on v.account_id=bank.id
          where bank.active and v.revoked_at is null
            and v.provider=bank.provider and v.recipient=bank.recipient),
      'products',case when
        coalesce((select enabled from mela_payments.settings where singleton),false)
        and coalesce((select enabled from public.platform_feature_flags where feature_key='payments'),false)
        then coalesce((select jsonb_agg(to_jsonb(x)) from
             (select id,title,amount_minor,currency from mela_payments.products where active) x),'[]'::jsonb)
        else '[]'::jsonb end,
      'accounts',case when
        coalesce((select enabled from mela_payments.settings where singleton),false)
        and coalesce((select enabled from public.platform_feature_flags where feature_key='payments'),false)
        then coalesce((select jsonb_agg(to_jsonb(x)) from
          (select bank.id,bank.provider,bank.recipient,bank.label
           from mela_payments.accounts bank
           join mela_payments.account_verifications v on v.account_id=bank.id
           where bank.active and v.revoked_at is null
             and bank.recipient=v.recipient and bank.provider=v.provider) x),'[]'::jsonb)
        else '[]'::jsonb end
    );
  elsif p_action='my_orders' then
    return coalesce((select jsonb_agg(to_jsonb(x)) from (select * from mela_payments.orders where user_id=u order by created_at desc limit 100) x),'[]'::jsonb);
  elsif p_action='admin_queue' then
    return coalesce((select jsonb_agg(to_jsonb(x)) from (select * from mela_payments.orders where status='pending' order by created_at limit 100) x),'[]'::jsonb);
  elsif p_action='admin_audit' then
    return coalesce((select jsonb_agg(to_jsonb(x)) from (select * from mela_payments.audit where order_id=(p_data->>'order_id')::uuid order by id desc limit 100) x),'[]'::jsonb);
  elsif p_action='create_order' then
    if not (coalesce((select enabled from mela_payments.settings where singleton),false)
       and coalesce((select enabled from public.platform_feature_flags where feature_key='payments'),false))
    then raise exception 'Paid orders are closed: checkout and platform payment authorization required'; end if;
    perform pg_advisory_xact_lock(hashtextextended(u::text,0));
    if (select count(*) from mela_payments.orders where user_id=u and created_at>now()-interval '24 hours') >= 10 then raise exception 'Daily order limit reached'; end if;
    select * into strict a from mela_payments.accounts ac
      where ac.id=(p_data->>'account_id')::uuid and ac.active
        and exists (select 1 from mela_payments.account_verifications v
          where v.account_id=ac.id and v.revoked_at is null
            and v.provider=ac.provider and v.recipient=ac.recipient);
    select * into strict p from mela_payments.products
      where id=(p_data->>'product_id')::uuid and active;
    insert into mela_payments.orders(user_id,product_id,account_id,amount_minor,currency,provider,recipient)
     values(u,p.id,a.id,p.amount_minor,p.currency,a.provider,a.recipient) returning * into o;
    insert into mela_payments.audit(order_id,actor,action,detail) values(o.id,u,'created','Server-priced order created');
    return to_jsonb(o);
  elsif p_action='admin_reverse' then
    select * into o from mela_payments.orders where id=(p_data->>'order_id')::uuid for update;
    if o.id is null then raise exception 'Order not found'; end if;
    if o.status <> 'approved' then raise exception 'Only approved orders can be reversed'; end if;
    note := trim(p_data->>'reason');
    if note is null or length(note) not between 10 and 500 then raise exception 'Provide a reason (10–500 characters)'; end if;
    update public.mela_user_learning_entitlements set status='revoked', ends_at=now(), updated_at=now()
     where source='payment' and source_reference=o.id::text and status='active';
    update mela_payments.orders set status='reversed', reason=note where id=o.id;
    insert into mela_payments.audit(order_id,actor,action,detail) values(o.id,u,'reversed',note);
    return jsonb_build_object('status','reversed','reason',note,'order_id',o.id);
  elsif p_action in ('submit','admin_record','admin_reject','admin_recheck') then
    select * into o from mela_payments.orders where id=(p_data->>'order_id')::uuid for update;
    if o.id is null or (p_action='submit' and o.user_id<>u) then raise exception 'Order not accessible' using errcode='42501'; end if;
    if o.status in ('approved','rejected','reversed') then return jsonb_build_object('status',o.status,'reason',o.reason,'order_id',o.id); end if;
    if p_action='submit' then
      ref := upper(trim(p_data->>'reference'));
      if ref is null or ref !~ '^[A-Z0-9][A-Z0-9-]{5,63}$' then raise exception 'Enter a valid transaction reference (6–64 letters, digits or hyphens)'; end if;
      if o.expires_at<now() then raise exception 'Order expired; contact support if you already paid'; end if;
      if o.attempts>=10 then raise exception 'Reference submission limit reached; contact support'; end if;
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
end
$function$
;
