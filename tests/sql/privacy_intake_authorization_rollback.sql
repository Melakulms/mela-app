-- Manual staging-only integration test. Requires two real staging profile rows
-- and an active superadmin profile, but NO credentials or persistent test records.
-- Run the entire file as ONE SQL statement/transaction via Supabase execute_sql.
-- Every inserted request, checkpoint and audit entry is rolled back.
BEGIN;
SELECT set_config('mela.qa.owner_a',
  (SELECT p.id::text FROM public.profiles p WHERE NOT EXISTS
   (SELECT 1 FROM admin.admin_users a WHERE a.user_id=p.id)
   ORDER BY p.id LIMIT 1),true);
SELECT set_config('mela.qa.owner_b',
  (SELECT p.id::text FROM public.profiles p WHERE NOT EXISTS
   (SELECT 1 FROM admin.admin_users a WHERE a.user_id=p.id)
   ORDER BY p.id OFFSET 1 LIMIT 1),true);
SELECT set_config('mela.qa.reviewer',
  (SELECT a.user_id::text FROM admin.admin_users a JOIN admin.roles r ON r.id=a.role_id
   JOIN public.profiles p ON p.id=a.user_id WHERE r.key='super_admin'
   AND a.active AND a.mfa_required AND p.account_status='active'
   AND p.deleted_at IS NULL LIMIT 1),true);
DO $check$
BEGIN
 IF current_setting('mela.qa.owner_a',true) IS NULL OR
    current_setting('mela.qa.owner_b',true) IS NULL OR
    current_setting('mela.qa.reviewer',true) IS NULL THEN
  RAISE EXCEPTION 'Missing staging profiles: STOP without running test';
 END IF;
END $check$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  jsonb_build_object('sub',current_setting('mela.qa.owner_a'),
  'role','authenticated','aal','aal1')::text,true);

DO $test$
DECLARE denied boolean := false;
BEGIN
 BEGIN
  INSERT INTO public.data_subject_requests
    (user_id,request_type,status,response_notes,handled_by,completed_at)
  VALUES (auth.uid(),'restriction','pending',
    'Fake administrator approval',
    current_setting('mela.qa.reviewer')::uuid,clock_timestamp());
 EXCEPTION WHEN insufficient_privilege THEN denied := true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: forged reviewer metadata accepted'; END IF;
 denied := false;
 BEGIN
  INSERT INTO public.data_subject_requests(user_id,request_type,status)
  VALUES (auth.uid(),'export','completed');
 EXCEPTION WHEN insufficient_privilege THEN denied := true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: forged completed status accepted'; END IF;
END $test$;

SELECT set_config('mela.qa.original_id',
  extensions.gen_random_uuid()::text,true);
INSERT INTO public.data_subject_requests
 (id,user_id,request_type,status,requested_at,updated_at)
VALUES
 (current_setting('mela.qa.original_id')::uuid,auth.uid(),'restriction','pending',
 '2010-01-01 00:00:00+00'::timestamptz,
 '2099-01-01 00:00:00+00'::timestamptz);
DO $test$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM public.data_subject_requests
  WHERE user_id=auth.uid() AND request_type='restriction'
    AND id<>current_setting('mela.qa.original_id')::uuid
    AND requested_at BETWEEN now()-interval '2 minutes' AND now()+interval '2 minutes'
    AND updated_at BETWEEN now()-interval '2 minutes' AND now()+interval '2 minutes'
    AND response_notes IS NULL AND completed_at IS NULL
 ) THEN RAISE EXCEPTION 'FAIL: forged ID/date retained'; END IF;
END $test$;

SELECT set_config('mela.qa.active_id',
 public.request_my_data_subject_action('access',NULL)::text,true);
DO $test$
DECLARE denied boolean:=false;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.data_subject_requests
  WHERE id=current_setting('mela.qa.active_id')::uuid
    AND user_id=auth.uid() AND status='pending' AND handled_by IS NULL) THEN
  RAISE EXCEPTION 'FAIL: owner intake RPC failed'; END IF;
 BEGIN
  PERFORM public.request_my_data_subject_action('access',NULL);
 EXCEPTION WHEN raise_exception OR unique_violation THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: duplicate open request accepted'; END IF;
END $test$;

SELECT set_config('request.jwt.claims',
 jsonb_build_object('sub',current_setting('mela.qa.owner_b'),
 'role','authenticated','aal','aal1')::text,true);
DO $test$
DECLARE affected int:=0; denied boolean:=false;
BEGIN
 IF EXISTS(SELECT 1 FROM public.data_subject_requests
   WHERE id=current_setting('mela.qa.active_id')::uuid) THEN
  RAISE EXCEPTION 'FAIL: another owner read the case'; END IF;
 UPDATE public.data_subject_requests SET status='cancelled'
  WHERE id=current_setting('mela.qa.active_id')::uuid;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>0 THEN RAISE EXCEPTION 'FAIL: cross-owner cancellation'; END IF;
 BEGIN
  INSERT INTO public.data_subject_requests(user_id,request_type,status)
   VALUES (current_setting('mela.qa.owner_a')::uuid,'rectification','pending');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: cross-owner request insertion'; END IF;
END $test$;

SELECT set_config('request.jwt.claims',
 jsonb_build_object('sub',current_setting('mela.qa.owner_a'),
 'role','authenticated','aal','aal1')::text,true);
UPDATE public.data_subject_requests SET status='cancelled'
 WHERE id=current_setting('mela.qa.active_id')::uuid AND status='pending';
SELECT set_config('mela.qa.reopened_id',
 public.request_my_data_subject_action('access',NULL)::text,true);
DO $test$
BEGIN
 IF (SELECT count(*) FROM public.data_subject_requests
  WHERE user_id=auth.uid() AND request_type='access')<>2 THEN
 RAISE EXCEPTION 'FAIL: owner cannot resubmit after cancellation'; END IF;
END $test$;

SELECT set_config('request.jwt.claims',
 jsonb_build_object('sub',current_setting('mela.qa.reviewer'),
 'role','authenticated','aal','aal1')::text,true);
DO $test$
DECLARE affected int:=0;
BEGIN
 UPDATE public.data_subject_requests SET status='in_review',
   response_notes='A review cannot begin without MFA.'
   WHERE id=current_setting('mela.qa.reopened_id')::uuid;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>0 THEN RAISE EXCEPTION 'FAIL: AAL1 reviewer mutation'; END IF;
END $test$;

SELECT set_config('request.jwt.claims',
 jsonb_build_object('sub',current_setting('mela.qa.reviewer'),
 'role','authenticated','aal','aal2')::text,true);
UPDATE public.data_subject_requests SET status='in_review',
 response_notes='We are reviewing your request in the secure staff queue.'
 WHERE id=current_setting('mela.qa.reopened_id')::uuid AND status='pending';
INSERT INTO public.privacy_review_checkpoints(request_id,reviewer_id,checkpoint,finding)
 VALUES(current_setting('mela.qa.reopened_id')::uuid,auth.uid(),
 'requester_identity','needs_follow_up');
DO $test$
DECLARE denied boolean:=false;
BEGIN
 IF (SELECT count(*) FROM public.privacy_review_checkpoints
  WHERE request_id=current_setting('mela.qa.reopened_id')::uuid)<>1 THEN
  RAISE EXCEPTION 'FAIL: AAL2 assigned checklist insert'; END IF;
 BEGIN
  UPDATE public.data_subject_requests SET status='completed'
  WHERE id=current_setting('mela.qa.reopened_id')::uuid;
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: reviewer was able to fake completion'; END IF;
END $test$;

SELECT set_config('request.jwt.claims',
 jsonb_build_object('sub',current_setting('mela.qa.owner_b'),
 'role','authenticated','aal','aal1')::text,true);
DO $test$
BEGIN
 IF EXISTS(SELECT 1 FROM public.privacy_review_checkpoints
  WHERE request_id=current_setting('mela.qa.reopened_id')::uuid) THEN
  RAISE EXCEPTION 'FAIL: non-admin read internal checklist'; END IF;
END $test$;

RESET ROLE;
DO $test$
BEGIN
 IF (SELECT count(*) FROM admin.audit_log WHERE
  request_id=current_setting('mela.qa.reopened_id')
  AND action IN ('privacy.review_started','privacy.checkpoint_recorded'))<>2 THEN
  RAISE EXCEPTION 'FAIL: review/checkpoint audit missing'; END IF;
END $test$;

ROLLBACK;
SELECT 'PASS: intake forgery blocked, metadata server-generated, owner isolation, cancellation and reopen, AAL2 review, checklist, audit, final closure denied; all data rolled back' AS outcome;
