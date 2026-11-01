-- Run after 20261101210000_telegram_verified_order_linking.sql on a test database.
-- Negative-only security tests: no customers, receipts, balances, or payouts created.
do $$
declare v jsonb; denied boolean;
begin
  if has_function_privilege('anon','public.mela_telegram_order_link_v1(uuid)','execute')
    or has_function_privilege('anon','public.mela_telegram_order_bot_v1(text,jsonb)','execute')
    or has_function_privilege('authenticated','public.mela_telegram_order_bot_v1(text,jsonb)','execute')
    or not has_function_privilege('authenticated','public.mela_telegram_order_link_v1(uuid)','execute')
    or not has_function_privilege('service_role','public.mela_telegram_order_bot_v1(text,jsonb)','execute')
  then raise exception 'Incorrect Telegram order RPC grants'; end if;

  if has_table_privilege('anon','mela_payments.telegram_order_tokens','select')
    or has_table_privilege('authenticated','mela_payments.telegram_order_tokens','insert')
    or has_table_privilege('authenticated','mela_payments.telegram_order_tokens','update')
  then raise exception 'Token table must not be exposed to clients'; end if;

  if coalesce((select enabled from public.platform_feature_flags
      where feature_key='telegram_payment_order_linking'),false)
  then raise exception 'Telegram order feature must start disabled'; end if;

  v:=public.mela_telegram_order_bot_v1('health','{}');
  if v->>'enabled' is distinct from 'false'
    then raise exception 'Bot reported unreviewed checkout as enabled'; end if;

  denied:=false;
  begin
    perform public.mela_telegram_order_bot_v1('submit',jsonb_build_object(
       'chat_id','12345','update_id',101,'reference','BANK123456'));
  exception when others then denied:=true; end;
  if not denied then raise exception 'Disabled Telegram reference submission accepted'; end if;

  denied:=false;
  begin
    perform public.mela_telegram_order_link_v1('00000000-0000-0000-0000-000000000000'::uuid);
  exception when others then denied:=true; end;
  if not denied then raise exception 'Anonymous Telegram link issuance accepted'; end if;
end $$;
