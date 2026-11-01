-- No payment receipts are deleted. /status and MFA review remain read-only.
-- Telegram cannot collect unlinked subscription payments under the global off switch.
CREATE OR REPLACE FUNCTION mela_telegram_payments.bot(p_action text, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a mela_telegram_payments.accounts; t mela_telegram_payments.submissions; cid text:=p_data->>'chat_id'; ref text; refkey text; amt bigint; detail text;
begin
 -- A raw Telegram reference cannot be safely used for account-linked MELA subscriptions.
 -- This flow stays paused until a separately audited order-linking feature is enabled.
 if p_action='health' then return jsonb_build_object('enabled',
   coalesce((select enabled from mela_telegram_payments.settings),false)
   and coalesce((select enabled from public.platform_feature_flags where feature_key='payments'),false)
   and coalesce((select enabled from public.platform_feature_flags where feature_key='telegram_payment_order_linking'),false));
 end if;
 if p_action='accounts' then
 return jsonb_build_object('enabled',
    coalesce((select enabled from mela_telegram_payments.settings),false)
    and coalesce((select enabled from public.platform_feature_flags where feature_key='payments'),false)
    and coalesce((select enabled from public.platform_feature_flags where feature_key='telegram_payment_order_linking'),false),
   'accounts', case when
    coalesce((select enabled from public.platform_feature_flags where feature_key='payments'),false)
    and coalesce((select enabled from public.platform_feature_flags where feature_key='telegram_payment_order_linking'),false)
   then (select jsonb_agg(x) from mela_telegram_payments.accounts x) else '[]'::jsonb end); end if;
 if cid is null or cid!~'^[0-9]{1,20}$' then raise exception 'Invalid private chat'; end if;
 if p_action='status' then return coalesce((select jsonb_agg(x) from (select id,provider,amount_minor,currency,status,reference,created_at,reviewed_at,case when status='rejected' then evidence_note else null end as reason from mela_telegram_payments.submissions where chat_id=cid order by created_at desc limit 5)x),'[]'::jsonb); end if;
 if p_action<>'submit' then raise exception 'Unknown action'; end if;
 if not (coalesce((select enabled from mela_telegram_payments.settings),false)
      and coalesce((select enabled from public.platform_feature_flags where feature_key='payments'),false)
      and coalesce((select enabled from public.platform_feature_flags where feature_key='telegram_payment_order_linking'),false))
 then raise exception 'Unlinked Telegram payment submissions are paused. Use MELA in-app orders when available.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('telegram-receipt:'||cid,0));
 select * into t from mela_telegram_payments.submissions where update_id=(p_data->>'update_id')::bigint and chat_id=cid;
 if t.id is not null then return jsonb_build_object('id',t.id,'status',t.status,'duplicate',true); end if;
 select * into strict a from mela_telegram_payments.accounts where provider=p_data->>'provider';
 ref:=upper(trim(p_data->>'reference')); refkey:=regexp_replace(ref,'[^A-Z0-9]','','g');
 if ref is null or ref!~'^[A-Z0-9][A-Z0-9-]{5,63}$' then raise exception 'Use a valid transaction reference (6–64 letters, digits or hyphens).'; end if;
 select * into t from mela_telegram_payments.submissions where provider=a.provider and reference_key=refkey and status<>'rejected';
 if t.id is not null then
   if t.chat_id=cid then return jsonb_build_object('id',t.id,'status',t.status,'duplicate',true); end if;
   raise exception 'That reference is already submitted. Contact MELA if you believe this is an error.';
 end if;
 if (select count(*) from mela_telegram_payments.submissions where chat_id=cid and created_at>now()-interval '24 hours')>=5 then raise exception 'Daily submission limit reached. Check /status before trying again.'; end if;
 if (select count(*) from mela_telegram_payments.submissions where chat_id=cid and status='pending')>=3 then raise exception 'You have three payments awaiting review. Use /status.'; end if;
 amt:=(p_data->>'amount_minor')::bigint; detail:=trim(p_data->>'details');
 if amt is null or amt not between 100 and 100000000 then raise exception 'Enter a valid amount in birr.'; end if;
 if detail is null or length(detail) not between 5 and 200 then raise exception 'Include the payer name and what the payment is for (5–200 characters).'; end if;
 insert into mela_telegram_payments.submissions(chat_id,update_id,provider,recipient,amount_minor,reference,reference_key,claimant,details)
 values(cid,(p_data->>'update_id')::bigint,a.provider,a.recipient,amt,ref,refkey,left(coalesce(p_data->>'claimant','Telegram customer'),120),detail) returning * into t;
 insert into mela_telegram_payments.audit(submission_id,action) values(t.id,'submitted_unverified');
 return jsonb_build_object('id',t.id,'status',t.status,'duplicate',false);
end $function$
;
