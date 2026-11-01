-- Retire unlinked Telegram payments; historical chat status remains readable.
create or replace function mela_telegram_payments.bot(p_action text,p_data jsonb)
 returns jsonb language plpgsql security definer set search_path=''
as $$
declare cid text:=p_data->>'chat_id';
begin
 if p_action='health' then return jsonb_build_object('enabled',false); end if;
 if p_action='accounts' then return jsonb_build_object('enabled',false,'accounts','[]'::jsonb); end if;
 if p_action='status' then
   if cid is null or cid !~ '^[0-9]{1,20}$' then raise exception 'Private Telegram chat ID required'; end if;
   return coalesce((select jsonb_agg(x) from (
     select id,provider,amount_minor,currency,status,reference,created_at,reviewed_at,
       case when status='rejected' then evidence_note else null end as reason
     from mela_telegram_payments.submissions where chat_id=cid order by created_at desc limit 5
   ) x),'[]'::jsonb);
 end if;
 raise exception 'Unlinked Telegram payment submissions are permanently closed. Create a verified in-app MELA subscription order and open its private Telegram link.';
end $$;
revoke all on function mela_telegram_payments.bot(text,jsonb) from public,anon,authenticated;
grant execute on function mela_telegram_payments.bot(text,jsonb) to service_role;