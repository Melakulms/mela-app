-- Staging-only integration test: inspect audit integrity without keeping records.
-- Run the WHOLE file as one SQL transaction. No test identities are created.
BEGIN;

SELECT set_config('mela.qa.a',
  (SELECT p.id::text FROM public.profiles p
   WHERE NOT EXISTS (SELECT 1 FROM admin.admin_users a WHERE a.user_id=p.id)
   ORDER BY p.id LIMIT 1),true);
SELECT set_config('mela.qa.b',
  (SELECT p.id::text FROM public.profiles p
   WHERE NOT EXISTS (SELECT 1 FROM admin.admin_users a WHERE a.user_id=p.id)
   ORDER BY p.id OFFSET 1 LIMIT 1),true);
SELECT set_config('mela.qa.admin',
  (SELECT a.user_id::text FROM admin.admin_users a
   JOIN admin.roles r ON r.id=a.role_id
   JOIN public.profiles p ON p.id=a.user_id
   WHERE r.key='super_admin' AND a.active AND a.mfa_required
     AND p.account_status='active' AND p.deleted_at IS NULL LIMIT 1),true);
DO $qa$
BEGIN
  IF current_setting('mela.qa.a',true) IS NULL
     OR current_setting('mela.qa.b',true) IS NULL
     OR current_setting('mela.qa.admin',true) IS NULL THEN
    RAISE EXCEPTION 'Missing staging identities; no test executed';
  END IF;
END;
$qa$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  jsonb_build_object('sub',current_setting('mela.qa.a'),'role','authenticated','aal','aal1')::text,true);

SELECT set_config('mela.qa.a.first',
 public.request_my_data_subject_action(
  'access','QA-PRIVATE-NARRATIVE-NEVER-IN-AUDIT')::text,true);
DO $qa$
DECLARE denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.request_my_data_subject_action('access',NULL);
  EXCEPTION WHEN raise_exception OR unique_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Duplicate request accepted'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.data_subject_requests
    WHERE id=current_setting('mela.qa.a.first')::uuid
      AND user_id=auth.uid() AND status='pending'
      AND details='QA-PRIVATE-NARRATIVE-NEVER-IN-AUDIT'
  ) THEN RAISE EXCEPTION 'Owner RPC request not stored correctly'; END IF;
END $qa$;

SELECT set_config('request.jwt.claims',
  jsonb_build_object('sub',current_setting('mela.qa.b'),'role','authenticated','aal','aal1')::text,true);
DO $qa$
BEGIN
  IF EXISTS(SELECT 1 FROM public.data_subject_requests
     WHERE id=current_setting('mela.qa.a.first')::uuid) THEN
    RAISE EXCEPTION 'Another user read owner A request';
  END IF;
END $qa$;
SELECT set_config('mela.qa.b.first',
 public.request_my_data_subject_action('rectification',NULL)::text,true);

SELECT set_config('request.jwt.claims',
  jsonb_build_object('sub',current_setting('mela.qa.a'),'role','authenticated','aal','aal1')::text,true);
UPDATE public.data_subject_requests SET status='cancelled'
 WHERE id=current_setting('mela.qa.a.first')::uuid AND status='pending';
SELECT set_config('mela.qa.a.second',
 public.request_my_data_subject_action('access',NULL)::text,true);

SELECT set_config('request.jwt.claims',
  jsonb_build_object('sub',current_setting('mela.qa.admin'),'role','authenticated','aal','aal2')::text,true);
UPDATE public.data_subject_requests SET status='in_review',
 response_notes='The private review is underway; this does not resolve the request.'
 WHERE id=current_setting('mela.qa.a.second')::uuid AND status='pending';
INSERT INTO public.privacy_review_checkpoints(request_id,reviewer_id,checkpoint,finding)
 VALUES(current_setting('mela.qa.a.second')::uuid,auth.uid(),
        'requester_identity','needs_follow_up');

RESET ROLE;

DO $qa$
DECLARE
  v_expected_events integer;
BEGIN
  SELECT count(*) INTO v_expected_events
    FROM admin.audit_log
    WHERE request_id IN (
       current_setting('mela.qa.a.first'),
       current_setting('mela.qa.a.second'),
       current_setting('mela.qa.b.first')
     )
      AND action='privacy.request_submitted';
  IF v_expected_events<>3 THEN
    RAISE EXCEPTION 'Expected 3 intake audits, received %',v_expected_events;
  END IF;

  IF NOT EXISTS(
    SELECT 1 FROM admin.audit_log
    WHERE request_id=current_setting('mela.qa.a.first')
      AND actor_user_id=current_setting('mela.qa.a')::uuid
      AND actor_role='user' AND action='privacy.request_submitted'
      AND target_schema='public'
      AND target_table='data_subject_requests'
      AND target_id=current_setting('mela.qa.a.first')
      AND after_data='{"status":"pending"}'::jsonb
      AND before_data IS NULL
      AND metadata->>'category'='access'
      AND metadata->>'includes_request_details'='false'
  ) THEN RAISE EXCEPTION 'Intake audit actor/reference/status incorrect'; END IF;

  IF EXISTS(
    SELECT 1 FROM admin.audit_log
    WHERE request_id IN (
       current_setting('mela.qa.a.first'),
       current_setting('mela.qa.a.second'),
       current_setting('mela.qa.b.first')
     )
     AND (
       coalesce(metadata::text,'') ILIKE '%QA-PRIVATE-NARRATIVE-NEVER-IN-AUDIT%'
       OR coalesce(after_data::text,'') ILIKE '%QA-PRIVATE-NARRATIVE-NEVER-IN-AUDIT%'
       OR coalesce(before_data::text,'') ILIKE '%QA-PRIVATE-NARRATIVE-NEVER-IN-AUDIT%'
     )
  ) THEN RAISE EXCEPTION 'Private requester narrative leaked into audit'; END IF;

  IF (SELECT count(*) FROM admin.audit_log
     WHERE request_id=current_setting('mela.qa.a.first')
       AND action='privacy.request_cancelled') <> 1 THEN
    RAISE EXCEPTION 'Owner cancellation audit missing'; END IF;

  IF (SELECT count(*) FROM admin.audit_log
     WHERE request_id=current_setting('mela.qa.a.second')
       AND action IN ('privacy.review_started','privacy.checkpoint_recorded')) <> 2 THEN
    RAISE EXCEPTION 'Review/checkpoint audit chain missing'; END IF;

  IF (SELECT count(*) FROM public.data_subject_requests
      WHERE user_id=current_setting('mela.qa.a')::uuid
        AND request_type='access') <> 2 THEN
    RAISE EXCEPTION 'Cancelled request did not preserve history'; END IF;
END $qa$;

ROLLBACK;
SELECT 'PASS: three intake audits, immutable actor/ref/status, no narrative in logs, cancellation/reopen/review/checkpoint chain, zero persisted test data' AS result;