-- Run after migration within a transaction; always roll back the whole test.
do $$
declare first_code text; second_code text; invite uuid; denied boolean:=false;
begin
  if has_table_privilege('anon','public.telegram_registration_bindings','SELECT')
    or has_table_privilege('authenticated','public.telegram_registration_bindings','SELECT')
    or has_function_privilege('anon','public.issue_telegram_registration_code(text,text,text)','EXECUTE')
    or has_function_privilege('authenticated','public.issue_telegram_registration_code(text,text,text)','EXECUTE') then
    raise exception 'Public access to private verification data';
  end if;
end $$;
insert into public.platform_feature_flags(feature_key,label,enabled) values('beta_access','Registration test',true) on conflict(feature_key) do update set enabled=true;
set local role service_role;
do $$
declare first_code text; second_code text; invite uuid; denied boolean:=false;
begin
  first_code:=public.issue_telegram_registration_code(repeat('a',64),'mela.verify.test','student')->>'code';
  if length(first_code)<>64 then raise exception 'Invalid code'; end if;
  select invite_id into invite from public.telegram_registration_bindings where chat_hash=repeat('a',64);
  if not exists(select 1 from public.beta_access_invites where id=invite and expires_at <= now()+interval '10 minutes' and used_at is null) then raise exception 'Invalid expiry'; end if;
  second_code:=public.issue_telegram_registration_code(repeat('a',64),'mela.verify.test2','parent')->>'code';
  if second_code=first_code then raise exception 'Code not rotated'; end if;
  if not exists(select 1 from public.beta_access_invites where id=invite and revoked_at is not null) then raise exception 'Old code remains usable'; end if;
  select invite_id into invite from public.telegram_registration_bindings where chat_hash=repeat('a',64);
  update public.beta_access_invites set used_at=now() where id=invite;
  begin
    perform public.issue_telegram_registration_code(repeat('a',64),'mela.verify.test3','student');
  exception when raise_exception then denied:=true; end;
  if not denied then raise exception 'Reused Telegram account accepted'; end if;
  denied:=false;
  begin
    perform public.issue_telegram_registration_code(repeat('b',64),'mela.verify.test','admin');
  exception when raise_exception then denied:=true; end;
  if not denied then raise exception 'Privileged role accepted'; end if;
end $$;
reset role;
select 'Telegram registration SQL checks passed; transaction rolled back' as result;
