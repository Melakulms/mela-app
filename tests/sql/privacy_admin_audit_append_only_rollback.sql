-- MELA staging-only audit-log integrity test.
-- Run the entire file as one transaction in the staging SQL executor.
-- All test requests and audit rows are rolled back. NEVER run on production.
BEGIN;

-- Isolated synthetic event: no existing audit event is ever edited in this test.
WITH audit_event AS (
 INSERT INTO admin.audit_log (
   actor_role,action,target_schema,target_table,target_id,
   before_data,after_data,metadata,request_id)
 VALUES ('qa','qa.audit_rollback','public','data_subject_requests',
  'rollback-only',NULL,'{"status":"pending"}'::jsonb,
  '{"test_only":true}'::jsonb,'rollback-only')
 RETURNING id
)
SELECT set_config('mela.qa.audit_id',id::text,true) FROM audit_event;
DO $test$
DECLARE denied boolean;
BEGIN
 denied := false;
 BEGIN
  UPDATE admin.audit_log SET action='qa.illicit_modification'
   WHERE id=current_setting('mela.qa.audit_id')::bigint;
 EXCEPTION WHEN insufficient_privilege THEN denied := true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: audit UPDATE permitted'; END IF;

 denied := false;
 BEGIN
  DELETE FROM admin.audit_log WHERE id=current_setting('mela.qa.audit_id')::bigint;
 EXCEPTION WHEN insufficient_privilege THEN denied := true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: audit DELETE permitted'; END IF;

 denied := false;
 BEGIN
  TRUNCATE admin.audit_log;
 EXCEPTION WHEN insufficient_privilege THEN denied := true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: audit TRUNCATE permitted'; END IF;

 IF NOT EXISTS (SELECT 1 FROM admin.audit_log
   WHERE id=current_setting('mela.qa.audit_id')::bigint AND action='qa.audit_rollback')
 THEN RAISE EXCEPTION 'FAIL: synthetic audit event changed'; END IF;
END $test$;

-- Verify that valid privacy lifecycle events can still append atomically.
SELECT set_config('mela.qa.owner',(
  SELECT p.id::text FROM public.profiles p
  WHERE NOT EXISTS(SELECT 1 FROM admin.admin_users a WHERE a.user_id=p.id)
  ORDER BY p.id LIMIT 1),true);
DO $test$
BEGIN
 IF current_setting('mela.qa.owner',true) IS NULL
 THEN RAISE EXCEPTION 'STOP: staging profile is missing'; END IF;
END $test$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
 jsonb_build_object('sub',current_setting('mela.qa.owner'),'role','authenticated',
  'aal','aal1')::text,true);
SELECT set_config('mela.qa.req',
 public.request_my_data_subject_action('access',NULL)::text,true);
UPDATE public.data_subject_requests SET status='cancelled'
 WHERE id=current_setting('mela.qa.req')::uuid AND status='pending';
RESET ROLE;

DO $test$
BEGIN
 IF (SELECT count(*) FROM admin.audit_log WHERE request_id=current_setting('mela.qa.req')
   AND action IN ('privacy.request_submitted','privacy.request_cancelled'))<>2
 THEN RAISE EXCEPTION 'FAIL: legitimate audit INSERT path rejected'; END IF;
END $test$;

ROLLBACK;
SELECT 'PASS: audit UPDATE, DELETE, TRUNCATE denied; valid privacy events appended; all test data rolled back' AS result;
