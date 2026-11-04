-- Issue #168, STAGING ONLY. Rollback-only negative-path test.
-- Requires migration 20261104193000_financial_launch_checkout_gate.sql first.
-- Do not run against production. No transfers, approvals or payouts occur.
begin;

-- Explicitly force the launch gates closed inside a rollback transaction.
update public.platform_launch_requirements r
set manual_status='pending', completed_at=null, completed_by=null
where r.requirement_key in ('payments_provider', 'wallet_business_legal');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claims',
 '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false,"aal":"aal1"}', true);

do $tests$
declare
 v_catalog jsonb;
 v_error text;
begin
 v_catalog:=public.payment_command_v1('catalog', '{}'::jsonb);
 if coalesce((v_catalog->>'enabled')::boolean, true) is distinct from false
    or jsonb_array_length(v_catalog->'products') <> 0
    or jsonb_array_length(v_catalog->'accounts') <> 0
 then
   raise exception 'Financial checkout catalogue was exposed while gates were pending';
 end if;

 begin
   perform public.payment_command_v1('create_order', '{}'::jsonb);
   raise exception 'Financial checkout created or accepted an order despite closed gates';
 exception when insufficient_privilege then
   get stacked diagnostics v_error=message_text;
   if position('financial-launch approval' in v_error)=0 then
     raise exception 'Unexpected order denial: %',v_error;
   end if;
 end;
end;
$tests$;

rollback;
