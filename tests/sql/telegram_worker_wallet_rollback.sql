-- Staging-only, rollback-only integration test. Do NOT use production.
-- Requires telegram_worker_wallet_readonly migration and one staging auth user.
begin;
select set_config('request.jwt.claim.sub',
  (select id::text from auth.users order by created_at limit 1),true);
select set_config('request.jwt.claims',
  '{"role":"authenticated","is_anonymous":false,"aal":"aal1"}',true);

set local role authenticated;
select set_config('mela.worker_test_link',
  (public.mela_worker_telegram_link_v1()->>'url'),true);
set local role service_role;

do $test$
declare
 v_token text := substring(current_setting('mela.worker_test_link') from 'work_([a-f0-9]{48})');
 v_link jsonb;
 v_status jsonb;
begin
 if v_token is null then raise exception 'Missing wallet pairing token'; end if;
 v_status:=public.mela_worker_telegram_bot_v1('status','{"chat_id":"123456789000"}'::jsonb);
 if (v_status->>'linked')::boolean is distinct from false
 then raise exception 'Unpaired Telegram chat was allowed wallet access'; end if;

 v_link:=public.mela_worker_telegram_bot_v1('link',
   jsonb_build_object('chat_id','123456789000','token',v_token,'update_id','987654321'));
 if (v_link->>'linked')::boolean is distinct from true
 then raise exception 'Wallet pairing failed'; end if;

 v_status:=public.mela_worker_telegram_bot_v1('status','{"chat_id":"123456789000"}'::jsonb);
 if (v_status->>'linked')::boolean is distinct from true
    or not (v_status ? 'recent_payouts')
    or not (v_status ? 'available')
 then raise exception 'Linked Telegram chat cannot read owner-scoped wallet status'; end if;

 v_status:=public.mela_worker_telegram_bot_v1('status','{"chat_id":"123456789001"}'::jsonb);
 if (v_status->>'linked')::boolean is distinct from false
 then raise exception 'Wallet status leaked to a different chat'; end if;

 perform public.mela_worker_telegram_bot_v1('unlink','{"chat_id":"123456789000"}'::jsonb);
 v_status:=public.mela_worker_telegram_bot_v1('status','{"chat_id":"123456789000"}'::jsonb);
 if (v_status->>'linked')::boolean is distinct from false
 then raise exception 'Telegram chat still sees wallet after unlink'; end if;
end;
$test$;

rollback;
