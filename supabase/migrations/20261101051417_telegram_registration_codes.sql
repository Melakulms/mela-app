-- Only the authenticated Telegram webhook service can issue registration codes.
create table public.telegram_registration_bindings (
  invite_id uuid primary key references public.beta_access_invites(id) on delete restrict,
  code_hash text not null unique check (code_hash ~ '^[a-f0-9]{64}$'),
  chat_hash text not null unique check (chat_hash ~ '^[a-f0-9]{64}$'),
  username text not null check (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'),
  verified_at timestamptz not null default now()
);
alter table public.telegram_registration_bindings enable row level security;
revoke all on public.telegram_registration_bindings from public, anon, authenticated;
grant select, insert, update, delete on public.telegram_registration_bindings to service_role;

create function public.issue_telegram_registration_code(p_chat_hash text, p_username text, p_role text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  previous public.telegram_registration_bindings%rowtype;
  old_invite public.beta_access_invites%rowtype;
  new_id uuid;
  code text;
  code_hash text;
begin
  if p_chat_hash is null or p_chat_hash !~ '^[a-f0-9]{64}$'
    or p_username is null or p_username !~ '^[a-z0-9][a-z0-9._-]{2,31}$'
    or p_role is null or p_role not in ('student','parent','teacher','company') then
    raise exception 'Invalid registration details.';
  end if;
  if not exists (select 1 from public.platform_feature_flags where feature_key='beta_access' and enabled) then
    raise exception 'Registration is temporarily unavailable.';
  end if;
  -- Serialize issuance for a Telegram account, including the first request.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('telegram-registration:'||p_chat_hash,0));
  if not public.consume_beta_auth_rate_limit(p_chat_hash,5,600) then
    raise exception 'Too many code requests. Please wait 10 minutes.';
  end if;
  select * into previous from public.telegram_registration_bindings where chat_hash=p_chat_hash;
  if found then
    -- Lock the invite itself: signup's atomic consume cannot race reissuance.
    select * into old_invite from public.beta_access_invites where id=previous.invite_id for update;
    if old_invite.used_at is not null or old_invite.used_by is not null then
      raise exception 'This Telegram account already verified a MELA registration. Sign in with your existing username or use your recovery code.';
    end if;
    update public.beta_access_invites set revoked_at=now() where id=previous.invite_id;
    delete from public.telegram_registration_bindings where invite_id=previous.invite_id;
  end if;
  -- Two UUIDs provide 244 random bits; only its hash is retained.
  code := replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
  code_hash := encode(extensions.digest(code,'sha256'),'hex');
  insert into public.beta_access_invites(code_hash,role,expires_at,note)
    values(code_hash,p_role::public.user_role,now()+interval '10 minutes','Telegram account control verification; no identity or professional approval')
    returning id into new_id;
  insert into public.telegram_registration_bindings(invite_id,code_hash,chat_hash,username)
    values(new_id,code_hash,p_chat_hash,p_username);
  return jsonb_build_object('code',code,'expires_in',600);
end;
$$;
revoke all on function public.issue_telegram_registration_code(text,text,text) from public,anon,authenticated;
grant execute on function public.issue_telegram_registration_code(text,text,text) to service_role;
