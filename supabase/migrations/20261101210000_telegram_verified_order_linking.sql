-- Staged, opt-in Telegram -> MELA order binding.
-- No collection/payout switch is enabled by this migration. Existing unlinked
-- Telegram submissions cannot grant memberships or commissions.
create table if not exists mela_payments.telegram_order_tokens (
  order_id uuid primary key references mela_payments.orders(id) on delete cascade,
  token_hash text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  chat_id text,
  update_id bigint
);
create unique index if not exists telegram_order_tokens_hash_unique
  on mela_payments.telegram_order_tokens(token_hash);
create index if not exists telegram_order_tokens_chat_idx
  on mela_payments.telegram_order_tokens(chat_id, used_at desc) where chat_id is not null;
alter table mela_payments.telegram_order_tokens enable row level security;
revoke all on mela_payments.telegram_order_tokens from public, anon, authenticated;

insert into public.platform_feature_flags
 (feature_key,label,description,enabled)
values ('telegram_payment_order_linking','Telegram verified-order binding',
 'Requires an authenticated MELA order, one-time private Telegram link, verified receiving account and MFA bank review.',false)
on conflict(feature_key) do nothing;

create or replace function public.mela_telegram_order_link_v1(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid(); v_order mela_payments.orders%rowtype;
        v_link mela_payments.telegram_order_tokens%rowtype;
        v_token text:=encode(extensions.gen_random_bytes(24),'hex');
        v_exp timestamptz;
begin
 if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
   or not exists(select 1 from auth.users where id=v_uid)
   or not exists(select 1 from auth.sessions where user_id=v_uid
     and id::text=auth.jwt()->>'session_id' and (not_after is null or not_after>now()))
 then raise exception 'Sign in to your verified MELA account' using errcode='42501'; end if;
 if not (coalesce((select enabled from mela_payments.settings where singleton),false)
   and coalesce((select enabled from public.platform_feature_flags where feature_key='payments'),false)
   and coalesce((select enabled from public.platform_feature_flags where feature_key='telegram_payment_order_linking'),false))
 then raise exception 'Telegram payment orders are not enabled'; end if;
 select * into v_order from mela_payments.orders
  where id=p_order_id and user_id=v_uid for update;
 if v_order.id is null or v_order.status not in ('awaiting_payment','pending')
   or v_order.expires_at<=now() or v_order.reference is not null
 then raise exception 'An active, unpaid order without a submitted reference is required'; end if;
 if not exists(select 1 from mela_payments.accounts a
   join mela_payments.account_verifications v on v.account_id=a.id
   where a.id=v_order.account_id and a.active and v.revoked_at is null
     and v.provider=a.provider and v.recipient=a.recipient)
 then raise exception 'Receiving account not verified'; end if;
 if not exists(select 1 from mela_payments.products p
    where p.id=v_order.product_id and p.active
      and ((p.product_key='mela_pro_monthly' and p.amount_minor=5000)
        or (p.product_key='mela_premium_monthly' and p.amount_minor=10000))
      and p.currency='ETB')
 then raise exception 'Verified subscription plan not available'; end if;
 select * into v_link from mela_payments.telegram_order_tokens
   where order_id=v_order.id for update;
 if v_link.used_at is not null then
   raise exception 'This order is already linked to Telegram. Use /status or MELA support'; end if;
 v_exp:=least(now()+interval '15 minutes',v_order.expires_at);
 insert into mela_payments.telegram_order_tokens
    (order_id,token_hash,created_by,created_at,expires_at,used_at,chat_id,update_id)
 values (v_order.id,encode(extensions.digest(convert_to(v_token,'UTF8'),'sha256'),'hex'),v_uid,
   now(),v_exp,null,null,null)
 on conflict(order_id) do update set token_hash=excluded.token_hash,
   created_by=excluded.created_by,created_at=excluded.created_at,
   expires_at=excluded.expires_at, used_at=null,chat_id=null,update_id=null;
 insert into mela_payments.audit(order_id,actor,action,detail)
  values(v_order.id,v_uid,'telegram_link_issued','One-time order link issued; no payment verified');
 return jsonb_build_object('url','https://t.me/Mela_edu_bot?start=pay_'||v_token,'expires_at',v_exp);
end $$;
revoke all on function public.mela_telegram_order_link_v1(uuid) from public,anon,authenticated;
grant execute on function public.mela_telegram_order_link_v1(uuid) to authenticated;

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
   update mela_payments.orders set reference=v_ref,attempts=attempts+1
     where id=v_order.id;
   insert into mela_payments.audit(order_id,actor,action,detail)
     values(v_order.id,null,'telegram_reference_submitted',
       'Claimed bank reference from linked private Telegram chat; bank verification still required');
   return jsonb_build_object('status','pending','order_id',v_order.id,'duplicate',false);
 else raise exception 'Unknown action'; end if;
end $$;
revoke all on function public.mela_telegram_order_bot_v1(text,jsonb) from public,anon,authenticated;
grant execute on function public.mela_telegram_order_bot_v1(text,jsonb) to service_role;
