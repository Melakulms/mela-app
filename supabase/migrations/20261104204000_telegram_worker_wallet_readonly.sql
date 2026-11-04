-- MELA Telegram worker wallet: read-only status + one-use account pairing.
-- Does NOT transfer funds, request withdrawals, approve payments, change
-- payouts_enabled or affect any existing payment/commission records.
-- The Telegram webhook must verify Telegram's secret token and private chat.
create table if not exists private.mela_worker_telegram_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table if not exists private.mela_worker_telegram_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  chat_id bigint not null unique,
  linked_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists mela_worker_telegram_links_chat_active_idx
  on private.mela_worker_telegram_links(chat_id) where revoked_at is null;
alter table private.mela_worker_telegram_tokens enable row level security;
alter table private.mela_worker_telegram_links enable row level security;
revoke all on private.mela_worker_telegram_tokens from public,anon,authenticated;
revoke all on private.mela_worker_telegram_links from public,anon,authenticated;

-- A signed-in user must explicitly request a short-lived deep link within MELA.
-- Never accept a user_id sent by Telegram or from a browser.
create or replace function public.mela_worker_telegram_link_v1()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_token text;
begin
  if v_uid is null
    or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
  then raise exception 'Signed-in MELA account required' using errcode='42501'; end if;
  v_token:=encode(extensions.gen_random_bytes(24),'hex');
  insert into private.mela_worker_telegram_tokens(user_id,token_hash,expires_at)
    values(v_uid,encode(extensions.digest(decode(v_token,'hex'),'sha256'),'hex'),now()+interval '10 minutes')
  on conflict(user_id) do update set
    token_hash=excluded.token_hash,expires_at=excluded.expires_at,created_at=now();
  return jsonb_build_object(
    'url','https://t.me/Mela_edu_bot?start=work_'||v_token,
    'expires_in_seconds',600
  );
end $$;
revoke all on function public.mela_worker_telegram_link_v1() from public,anon,authenticated;
grant execute on function public.mela_worker_telegram_link_v1() to authenticated;

-- Service role only; never grant to anon or authenticated.
-- Commands are read-only except for linking/unlinking Telegram identity.
create or replace function public.mela_worker_telegram_bot_v1(
 p_action text,p_data jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_chat_id bigint;
  v_uid uuid;
  v_token text;
  v_payouts_enabled boolean;
  v_reqs jsonb;
  v_available numeric;
  v_pending numeric;
  v_paid numeric;
begin
  if (p_data->>'chat_id') !~ '^[0-9]{5,18}$'
  then raise exception 'Invalid private Telegram chat' using errcode='22023'; end if;
  v_chat_id:=(p_data->>'chat_id')::bigint;

  if p_action='link' then
    v_token:=lower(trim(coalesce(p_data->>'token','')));
    if v_token !~ '^[a-f0-9]{48}$'
    then raise exception 'Invalid or expired MELA link' using errcode='22023'; end if;
    if (p_data->>'update_id') !~ '^[0-9]{1,18}$'
    then raise exception 'Telegram update ID required' using errcode='22023'; end if;

    -- Exclusive account/chat pairing. A chat already connected to a different
    -- MELA account must explicitly unlink first.
    select t.user_id into v_uid
      from private.mela_worker_telegram_tokens t
      where t.token_hash=encode(extensions.digest(decode(v_token,'hex'),'sha256'),'hex')
        and t.expires_at>now()
      for update;
    if v_uid is null then raise exception 'Link expired; create a new link in MELA Wallet'; end if;
    if exists (
      select 1 from private.mela_worker_telegram_links l
      where l.chat_id=v_chat_id and l.user_id<>v_uid and l.revoked_at is null
    ) then raise exception 'This Telegram chat is already linked; use /unlink first'; end if;
    delete from private.mela_worker_telegram_links where chat_id=v_chat_id and user_id<>v_uid and revoked_at is not null;
    insert into private.mela_worker_telegram_links(user_id,chat_id,linked_at,revoked_at)
      values(v_uid,v_chat_id,now(),null)
    on conflict(user_id) do update set chat_id=excluded.chat_id,linked_at=now(),revoked_at=null;
    delete from private.mela_worker_telegram_tokens where user_id=v_uid;
    return jsonb_build_object('linked',true);
  end if;

  if p_action='unlink' then
    update private.mela_worker_telegram_links
      set revoked_at=now()
      where chat_id=v_chat_id and revoked_at is null;
    return jsonb_build_object('unlinked',true);
  end if;

  if p_action<>'status'
  then raise exception 'Unsupported worker wallet action' using errcode='22023'; end if;

  select l.user_id into v_uid
    from private.mela_worker_telegram_links l
    where l.chat_id=v_chat_id and l.revoked_at is null;
  if v_uid is null then return jsonb_build_object('linked',false); end if;

  -- Only aggregate the *linked* account; no bank account numbers,
  -- worker names, full transaction histories or payout references.
  select coalesce(sum(l.net_amount) filter(where l.status='available'),0),
    coalesce(sum(l.net_amount) filter(where l.status='pending'),0),
    coalesce(sum(l.net_amount) filter(where l.status='paid'),0)
    into v_available,v_pending,v_paid
    from public.earnings_ledger l
    where l.user_id=v_uid and upper(l.currency)='ETB';

  select coalesce(jsonb_agg(jsonb_build_object(
    'status',p.status,'amount_etb',(p.amount_minor::numeric/100),
    'date',to_char(p.created_at at time zone 'UTC','YYYY-MM-DD')
  ) order by p.created_at desc),'[]'::jsonb) into v_reqs
  from (
    select status,amount_minor,created_at
    from public.payout_requests where freelancer_id=v_uid
      and upper(currency)='ETB' order by created_at desc limit 5
  ) p;

  select coalesce(enabled,false) into v_payouts_enabled
  from public.platform_feature_flags where feature_key='payouts';

  return jsonb_build_object(
    'linked',true,'currency','ETB','available',v_available,
    'pending',v_pending,'paid',v_paid,
    'payouts_enabled',coalesce(v_payouts_enabled,false),
    'recent_payouts',coalesce(v_reqs,'[]'::jsonb)
  );
end $$;
revoke all on function public.mela_worker_telegram_bot_v1(text,jsonb) from public,anon,authenticated;
grant execute on function public.mela_worker_telegram_bot_v1(text,jsonb) to service_role;
