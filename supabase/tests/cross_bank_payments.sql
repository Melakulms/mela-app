begin;
do $$ declare buyer uuid:=gen_random_uuid(); reviewer uuid:=gen_random_uuid(); account uuid; product uuid; oid uuid; second_id uuid; body jsonb; result jsonb;
begin
 insert into auth.users(id,aud,role) values(buyer,'authenticated','authenticated'),(reviewer,'authenticated','authenticated');
 insert into mela_payments.reviewers(user_id) values(reviewer);
 insert into mela_payments.accounts(provider,recipient,label,active) values('receiving-bank','LOCAL-TEST-ACCOUNT','Isolated test fixture',true) returning id into account;
 insert into mela_payments.products(title,amount_minor,active) values('Isolated fixture',10000,true) returning id into product;
 update mela_payments.settings set enabled=true;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',buyer,'aal','aal1','role','authenticated')::text,true);
 result:=public.payment_command_v1('create_order',jsonb_build_object('account_id',account,'product_id',product)); oid:=(result->>'id')::uuid;
 perform public.payment_command_v1('submit',jsonb_build_object('order_id',oid,'reference','sender/ref:001','sending_bank','A Different Sending Bank'));
 if (select sending_bank from mela_payments.orders where id=oid)<>'a different sending bank' then raise exception 'FAIL: sender bank lost'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',reviewer,'aal','aal2','role','authenticated')::text,true);
 body:=jsonb_build_object('order_id',oid,'reference','sender/ref:001','incoming_reference','INCOMING-999','recipient','LOCAL-TEST-ACCOUNT','currency','ETB','amount_minor',10000,'paid_at',now(),'confirmed_received',true,'confirmed_order_owner',true,'evidence_note','Local regression: incoming credit and cross-bank ownership verified');
 result:=public.payment_command_v1('admin_record',body);
 if result->>'status'<>'approved' then raise exception 'FAIL: different incoming reference cannot approve'; end if;
 if not exists(select 1 from mela_payments.receipts where verified_order_id=oid and reference='INCOMING-999' and customer_reference='SENDER/REF:001') then raise exception 'FAIL: reference provenance lost'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',buyer,'aal','aal1','role','authenticated')::text,true);
 result:=public.payment_command_v1('create_order',jsonb_build_object('account_id',account,'product_id',product)); second_id:=(result->>'id')::uuid;
 perform public.payment_command_v1('submit',jsonb_build_object('order_id',second_id,'reference','ANOTHER-SENDER-REF','sending_bank','Any Other Bank'));
 perform set_config('request.jwt.claims',jsonb_build_object('sub',reviewer,'aal','aal2','role','authenticated')::text,true);
 begin
  perform public.payment_command_v1('admin_record',body||jsonb_build_object('order_id',second_id,'reference','ANOTHER-SENDER-REF'));
  raise exception 'FAIL: same incoming credit reused with a different sender reference';
 exception when unique_violation then null; end;
 if exists(select 1 from mela_payments.entitlements where order_id=second_id) then raise exception 'FAIL: duplicate credit unlocked another order'; end if;
end $$;
select 'PASS: arbitrary sending bank, differing sender/receiver references, provenance and cross-bank credit reuse blocked' as cross_bank_tests;
rollback;
