-- A verified MELA order is required before Telegram can submit any transfer reference.
-- No payment collection, commission or payout flags are changed by this migration.
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
alter table mela_payments.telegram_order_tokens enable row level security;
revoke all on mela_payments.telegram_order_tokens from public,anon,authenticated;
create unique index if not exists mela_telegram_order_unique_bank_reference
  on mela_payments.orders(provider,recipient,upper(reference))
  where reference is not null;

create or replace function public.mela_issue_telegram_order_code_v1(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
  v_user uuid:=auth.uid();
  v_order mela_payments.orders%rowtype;
  v_token text;
begin
  if v_user is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
     or not exists(select 1 from auth.users u where u.id=v_user)
  then raise exception 'Sign in to MELA before linking an order' using errcode='42501'; end if;
  select * into v_order from mela_payments.orders
    where id=p_order_id and user_id=v_user for update;
  if v_order.id is null then raise exception 'Order not found for this account' using errcode='42501'; end if;
  if v_order.status not in ('awaiting_payment','pending') or v_order.reference is not null
      or v_order.expires_at<=now() then
    raise exception 'Only an open order without a reference can be linked'; end if;
  if not (coalesce((select enabled from mela_payments.settings),false)
    and coalesce((select enabled from public.platform_feature_flags where feature_key='payments'),false))
  then raise exception 'MELA payment collection is not open'; end if;
  if not exists(select 1 from mela_payments.accounts a
      join mela_payments.account_verifications v on v.account_id=a.id
      where a.id=v_order.account_id and a.active and v.revoked_at is null
        and a.provider=v_order.provider and a.recipient=v_order.recipient
        and v.provider=a.provider and v.recipient=a.recipient)
  then raise exception 'Receiving account is not verified'; end if;
  if not exists(select 1 from mela_payments.products p where p.id=v_order.product_id
        and p.active and p.amount_minor=v_order.amount_minor and p.currency=v_order.currency)
  then raise exception 'Payment product is not active'; end if;
  -- A short-lived, high-entropy capability is shown to the signed-in account
  -- and never written to the database in plaintext.
  v_token:=upper(replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''));
  insert into mela_payments.telegram_order_tokens(order_id,token_hash,created_by,expires_at)
    values(v_order.id,encode(extensions.digest('mela-telegram-order-v1:'||v_order.id::text||':'||v_token,'sha256'),'hex'),
      v_user,least(now()+interval '15 minutes',v_order.expires_at))
    on conflict(order_id) do update set token_hash=excluded.token_hash,
      created_at=now(),created_by=v_user,expires_at=excluded.expires_at,
      used_at=null,chat_id=null,update_id=null;
  return jsonb_build_object('order_id',v_order.id,'code',v_token,
    'expires_at',least(now()+interval '15 minutes',v_order.expires_at),
    'amount_minor',v_order.amount_minor,'currency',v_order.currency,
    'provider',v_order.provider,'recipient',v_order.recipient);
end $fn$;
revoke all on function public.mela_issue_telegram_order_code_v1(uuid) from public,anon;
grant execute on function public.mela_issue_telegram_order_code_v1(uuid) to authenticated;

create or replace function public.mela_submit_telegram_order_v1(
  p_order_id uuid,p_code text,p_reference text,p_chat_id text,p_update_id bigint
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 v_order mela_payments.orders%rowtype;
 v_token mela_payments.telegram_order_tokens%rowtype;
 v_ref text:=upper(trim(p_reference));
 v_hash text;
begin
 -- The Telegram handler alone has the Supabase service-role key.
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'Only the MELA Telegram service may submit this proof'
   using errcode='42501'; end if;
 if p_order_id is null or p_code is null or p_code !~ '^[A-Fa-f0-9]{64}$'
   or v_ref is null or v_ref !~ '^[A-Z0-9][A-Z0-9-]{5,63}$'
   or p_chat_id is null or p_chat_id !~ '^[0-9]{1,20}$'
   or p_update_id is null or p_update_id<1
 then raise exception 'Invalid order, private code, or transfer reference'; end if;
 if not (coalesce((select enabled from mela_payments.settings),false)
    and coalesce((select enabled from public.platform_feature_flags where feature_key='payments'),false))
 then raise exception 'MELA payment collection is not open'; end if;
 select * into v_order from mela_payments.orders where id=p_order_id for update;
 if v_order.id is null then raise exception 'Order does not exist'; end if;
 select * into v_token from mela_payments.telegram_order_tokens
   where order_id=p_order_id for update;
 v_hash:=encode(extensions.digest('mela-telegram-order-v1:'||p_order_id::text||':'||upper(p_code),'sha256'),'hex');
 if v_token.order_id is null or v_token.token_hash is distinct from v_hash
    or v_token.expires_at<=now() then
    raise exception 'Invalid or expired private order code'; end if;
 if v_token.used_at is not null then
   if v_token.chat_id=p_chat_id and v_token.update_id=p_update_id
      and v_order.reference=v_ref and v_order.status='pending'
   then return jsonb_build_object('status','pending','order_id',v_order.id,'duplicate',true); end if;
   raise exception 'This order code was already used'; end if;
 if v_order.status<>'awaiting_payment' or v_order.reference is not null
    or v_order.expires_at<=now() or v_order.attempts>=10
 then raise exception 'This order is no longer accepting a payment reference'; end if;
 if not exists(select 1 from mela_payments.accounts a
     join mela_payments.account_verifications v on v.account_id=a.id
     where a.id=v_order.account_id and a.active and v.revoked_at is null
       and a.provider=v_order.provider and a.recipient=v_order.recipient
       and v.provider=a.provider and v.recipient=a.recipient)
 then raise exception 'Receiving account is not verified'; end if;
 if not exists(select 1 from mela_payments.products p
   where p.id=v_order.product_id and p.active and p.amount_minor=v_order.amount_minor
     and p.currency=v_order.currency)
 then raise exception 'Subscription is unavailable'; end if;
 if exists(select 1 from mela_payments.receipts
      where provider=v_order.provider and recipient=v_order.recipient
        and upper(reference)=v_ref)
 then raise exception 'This bank reference has already been verified'; end if;
 if exists(select 1 from mela_payments.orders
      where id<>v_order.id and provider=v_order.provider and recipient=v_order.recipient
        and upper(reference)=v_ref)
 then raise exception 'That transfer reference was already submitted for another order'; end if;
 update mela_payments.orders set status='pending',reference=v_ref,
     attempts=attempts+1,reason='Telegram reference submitted; bank evidence not yet verified'
   where id=v_order.id;
 update mela_payments.telegram_order_tokens set used_at=now(),chat_id=p_chat_id,update_id=p_update_id
   where order_id=v_order.id;
 insert into mela_payments.audit(order_id,actor,action,detail)
   values(v_order.id,null,'telegram_reference_submitted',
    'Single-use order code consumed; no entitlement or commission granted');
 return jsonb_build_object('status','pending','order_id',v_order.id,'duplicate',false);
end $fn$;
revoke all on function public.mela_submit_telegram_order_v1(uuid,text,text,text,bigint)
 from public,anon,authenticated;
grant execute on function public.mela_submit_telegram_order_v1(uuid,text,text,text,bigint)
 to service_role;
