-- Staging only: rollback the negative-path customer and Telegram tests.
-- No receipts, refunds, subscriptions, provider approvals or payouts are written.
begin;

update public.platform_launch_requirements r
set manual_status='pending', completed_at=null, completed_by=null
where r.requirement_key in ('payments_provider', 'wallet_business_legal', 'legal_review');

-- Telegram is service-only. The health check must refuse new payment cases,
-- while historical order status can still be queried.
do $tests$
declare v_health jsonb; v_old jsonb;
begin
 v_health:=public.mela_telegram_order_bot_v1('health', '{}'::jsonb);
 if coalesce((v_health->>'enabled')::boolean,true) is distinct from false
 then raise exception 'Telegram is exposed with legal/provider approvals pending'; end if;
 v_old:=public.mela_telegram_order_bot_v1('status','{"chat_id":"9999999999"}'::jsonb);
 if jsonb_typeof(v_old)<>'array'
 then raise exception 'Historical Telegram order status must remain accessible'; end if;
end;
$tests$;

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claims',
 '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false,"aal":"aal1"}',true);

do $tests$
declare v_catalog jsonb; v_error text;
begin
 v_catalog:=public.payment_command_v1('catalog', '{}'::jsonb);
 if coalesce((v_catalog->>'enabled')::boolean, true) is distinct from false
    or jsonb_array_length(v_catalog->'products')<>0
    or jsonb_array_length(v_catalog->'accounts')<>0
 then raise exception 'Payment catalog leaked while provider/legal approvals are pending'; end if;
 begin
   perform public.payment_command_v1('create_order', '{}'::jsonb);
   raise exception 'New payment order bypassed legal/provider launch gates';
 exception when insufficient_privilege then
   get stacked diagnostics v_error=message_text;
   if position('financial-launch approval' in v_error)=0
     then raise exception 'Unexpected create-order denial: %',v_error; end if;
 end;
end;
$tests$;
rollback;
