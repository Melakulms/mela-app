-- Ensure Telegram-linked reference claims appear in the same MFA admin review queue.
-- No payment is approved and no entitlement/commission is granted here.
create or replace function public.mela_telegram_order_bot_v1(p_action text,p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare cid text:=p_data->>'chat_id'; v_token text; v_ref text;
  v_link mela_payments.telegram_order_tokens%rowtype;
  v_order mela_payments.orders%rowtype; v_upd bigint;
  v_enabled boolean;
begin
 -- Call only from MELA's server-side Telegram webhook, never from clients.
 if session_user not in ('postgres','supabase_admin') and current_user not in ('postgres','supabase_admin')
    and auth.role() is distinct from 'service_role' then
   raise exception 'Service credential required' using errcode='42501';
 end if;
 v_enabled := coalesce((select enabled from mela_payments.settings where singleton),false)
   and coalesce((select enabled from public.platform_feature_flags where feature_key='payments'),false)
   and coalesce((select enabled from public.platform_feature_flags where feature_key='telegram_payment_order_linking'),false);
 if p_action='health' then return jsonb_build_object('enabled',v_enabled); end if;
 if cid is null or cid !~ '^[0-9]{1,20}$' then raise exception 'Private Telegram chat required'; end if;
 if p_action='status' then
   return coalesce((select jsonb_agg(to_jsonb(x)) from
     (select o.id as order_id,o.status,o.amount_minor,o.currency,
         o.provider,o.reference,o.reason
      from mela_payments.telegram_order_tokens t
      join mela_payments.orders o on o.id=t.order_id
      where t.chat_id=cid and t.used_at is not null
      order by t.used_at desc limit 5) x),'[]'::jsonb);
 end if;
 if not v_enabled then raise exception 'Telegram order verification is paused. Do not transfer money'; end if;
 if p_data->>'update_id' !~ '^[0-9]{1,20}$' then raise exception 'Telegram update ID required'; end if;
 v_upd:=(p_data->>'update_id')::bigint;
 perform pg_advisory_xact_lock(hashtextextended('mela-telegram-order:'||cid,0));
 if p_action='link' then
   v_token:=lower(trim(p_data->>'token'));
   if v_token is null or v_token !~ '^[a-f0-9]{48}$' then raise exception 'Invalid order link'; end if;
   select * into v_link from mela_payments.telegram_order_tokens
      where token_hash=encode(extensions.digest(convert_to(v_token,'UTF8'),'sha256'),'hex')
      for update;
   if v_link.order_id is null or v_link.expires_at<=now() then raise exception 'Order link has expired. Reopen your order in MELA'; end if;
   if v_link.used_at is not null then
     if v_link.chat_id=cid then return jsonb_build_object('status','linked','order_id',v_link.order_id,'duplicate',true); end if;
     raise exception 'Order link already used'; end if;
   select * into v_order from mela_payments.orders where id=v_link.order_id for update;
   if v_order.status not in ('awaiting_payment','pending') or v_order.expires_at<=now()
      or v_order.reference is not null then raise exception 'Order no longer accepts references'; end if;
   if exists(select 1 from mela_payments.telegram_order_tokens t
       join mela_payments.orders o on o.id=t.order_id
       where t.chat_id=cid and t.used_at is not null and t.order_id<>v_order.id
         and o.status in ('awaiting_payment','pending') and o.expires_at>now()
         and o.reference is null)
   then raise exception 'Finish the previous Telegram-linked order before linking another'; end if;
   update mela_payments.telegram_order_tokens set chat_id=cid,used_at=now(),update_id=v_upd
     where order_id=v_link.order_id;
   insert into mela_payments.audit(order_id,actor,action,detail)
     values(v_order.id,null,'telegram_chat_linked','Validated single-use order link; no transfer verified');
   return jsonb_build_object('status','linked','order_id',v_order.id,
     'amount_minor',v_order.amount_minor,'currency',v_order.currency,
     'provider',v_order.provider);
 elsif p_action='submit' then
   v_ref:=upper(trim(p_data->>'reference'));
   if v_ref is null or v_ref !~ '^[A-Z0-9][A-Z0-9-]{5,63}$'
     then raise exception 'Enter a valid 6–64 character bank reference'; end if;
   select o.* into v_order from mela_payments.orders o
     join mela_payments.telegram_order_tokens t on t.order_id=o.id
     where t.chat_id=cid and t.used_at is not null
        and o.status in ('awaiting_payment','pending') and o.expires_at>now()
     order by t.used_at desc limit 1 for update of o;
   if v_order.id is null then raise exception 'Open an active payment order in MELA and use its Telegram link first'; end if;
   if v_order.reference is not null then
     if v_order.reference=v_ref then
       return jsonb_build_object('status',v_order.status,'order_id',v_order.id,'duplicate',true);
     end if;
     raise exception 'This order already has a reference. Do not pay twice; contact MELA support'; end if;
   if v_order.attempts>=10 then raise exception 'Order submission limit reached'; end if;
   update mela_payments.orders set reference=v_ref,attempts=attempts+1,
       status='pending',reason='Awaiting independently verified incoming account record'
     where id=v_order.id;
   insert into mela_payments.audit(order_id,actor,action,detail)
     values(v_order.id,null,'telegram_reference_submitted',
       'Claimed bank reference from linked private Telegram chat; bank verification still required');
   return jsonb_build_object('status','pending','order_id',v_order.id,'duplicate',false);
 else raise exception 'Unknown action'; end if;
end $$;
