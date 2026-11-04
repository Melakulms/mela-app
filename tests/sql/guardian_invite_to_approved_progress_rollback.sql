-- MELA guardian end-to-end database authorization test, STAGING ONLY.
-- Runs as ONE transaction; temporarily simulates a parent using an existing
-- staging learner profile; all role changes, invite tokens, links and audits
-- are ROLLED BACK. No production use, no real guardian identity asserted.
BEGIN;

SELECT set_config('qa.child',(SELECT p.id::text FROM public.profiles p WHERE p.role='student' AND p.account_status='active' AND p.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM admin.admin_users a WHERE a.user_id=p.id) ORDER BY p.id LIMIT 1),true);
SELECT set_config('qa.parent',(SELECT p.id::text FROM public.profiles p WHERE p.role='student' AND p.account_status='active' AND p.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM admin.admin_users a WHERE a.user_id=p.id) ORDER BY p.id OFFSET 1 LIMIT 1),true);
SELECT set_config('qa.other',(SELECT p.id::text FROM public.profiles p WHERE p.role='student' AND p.account_status='active' AND p.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM admin.admin_users a WHERE a.user_id=p.id) ORDER BY p.id OFFSET 2 LIMIT 1),true);
SELECT set_config('qa.admin',(SELECT a.user_id::text FROM admin.admin_users a JOIN admin.roles r ON r.id=a.role_id JOIN public.profiles p ON p.id=a.user_id WHERE r.key='super_admin' AND a.active AND a.mfa_required AND p.account_status='active' AND p.deleted_at IS NULL LIMIT 1),true);
DO $qa$
BEGIN
 IF current_setting('qa.child',true) IS NULL OR
    current_setting('qa.parent',true) IS NULL OR
    current_setting('qa.other',true) IS NULL OR
    current_setting('qa.admin',true) IS NULL THEN
  RAISE EXCEPTION 'STOP: require 3 non-admin staging learners + 1 active admin';
 END IF;
 IF current_setting('qa.child')=current_setting('qa.parent') OR
    current_setting('qa.parent')=current_setting('qa.other') OR
    current_setting('qa.child')=current_setting('qa.other') THEN
  RAISE EXCEPTION 'STOP: test identities are not distinct';
 END IF;
END $qa$;

-- Staging-only reversible simulation; NO real guardian is approved by QA.
UPDATE public.profiles SET role='parent'::public.user_role,email_verified=true
 WHERE id=current_setting('qa.parent')::uuid;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
 jsonb_build_object('sub',current_setting('qa.child'),'role','authenticated','aal','aal1')::text,true);
SELECT set_config('qa.token',public.create_parent_link_invite_v35(),true);

DO $qa$
BEGIN
 IF length(current_setting('qa.token'))<>64 OR
 NOT EXISTS (SELECT 1 FROM public.parent_link_invites
   WHERE learner_id=auth.uid() AND redeemed_at IS NULL AND expires_at>now())
 THEN RAISE EXCEPTION 'FAIL: learner cannot issue an expiring private invitation'; END IF;
END $qa$;

SELECT set_config('request.jwt.claims',
 jsonb_build_object('sub',current_setting('qa.parent'),'role','authenticated','aal','aal1')::text,true);
SELECT set_config('qa.link',
 public.redeem_parent_link_invite_v36(current_setting('qa.token'))::text,true);

DO $qa$
DECLARE denied boolean:=false;
BEGIN
 IF public.is_approved_guardian_of(current_setting('qa.child')::uuid) THEN
  RAISE EXCEPTION 'FAIL: invitation code granted guardian authority'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.guardian_relationships
   WHERE id=current_setting('qa.link')::uuid AND status='pending'
   AND guardian_user_id=auth.uid() AND verified_at IS NULL AND verified_by IS NULL) THEN
   RAISE EXCEPTION 'FAIL: pending relationship was not properly created'; END IF;
 BEGIN
  PERFORM public.get_my_guardian_learner_progress(current_setting('qa.child')::uuid);
 EXCEPTION WHEN raise_exception OR insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: child progress disclosed before approval'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.redeem_parent_link_invite_v36(current_setting('qa.token'));
 EXCEPTION WHEN raise_exception OR insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: one-use invitation redeemed twice'; END IF;
END $qa$;

SELECT set_config('request.jwt.claims',
 jsonb_build_object('sub',current_setting('qa.other'),'role','authenticated','aal','aal1')::text,true);
DO $qa$
DECLARE denied boolean:=false;
BEGIN
 IF EXISTS(SELECT 1 FROM public.guardian_relationships WHERE id=current_setting('qa.link')::uuid) THEN
  RAISE EXCEPTION 'FAIL: unrelated account reads a pending link'; END IF;
 BEGIN
  PERFORM public.get_my_guardian_learner_progress(current_setting('qa.child')::uuid);
 EXCEPTION WHEN raise_exception OR insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: unrelated account reads child progress'; END IF;
END $qa$;

SELECT set_config('request.jwt.claims',
 jsonb_build_object('sub',current_setting('qa.admin'),'role','authenticated','aal','aal1')::text,true);
DO $qa$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM public.review_guardian_consent(current_setting('qa.link')::uuid,
   'verified','Simulated evidence in rollback-only staging QA.');
 EXCEPTION WHEN raise_exception OR insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: AAL1 admin approved guardian'; END IF;
END $qa$;

SELECT set_config('request.jwt.claims',
 jsonb_build_object('sub',current_setting('qa.admin'),'role','authenticated','aal','aal2')::text,true);
SELECT public.review_guardian_consent(
 current_setting('qa.link')::uuid,'verified',
 'Simulated independent identity review for rollback-only QA');
DO $qa$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.guardian_relationships
   WHERE id=current_setting('qa.link')::uuid AND status='verified'
   AND verified_at IS NOT NULL AND verified_by=auth.uid()) THEN
  RAISE EXCEPTION 'FAIL: MFA reviewer did not approve pending link'; END IF;
END $qa$;

SELECT set_config('request.jwt.claims',
 jsonb_build_object('sub',current_setting('qa.parent'),'role','authenticated','aal','aal1')::text,true);
DO $qa$
DECLARE summary jsonb;
BEGIN
 IF NOT public.is_approved_guardian_of(current_setting('qa.child')::uuid) THEN
  RAISE EXCEPTION 'FAIL: reviewed parent not authorized'; END IF;
 summary:=public.get_my_guardian_learner_progress(current_setting('qa.child')::uuid);
 IF summary->'learner'->>'id' IS DISTINCT FROM current_setting('qa.child') OR
    NOT (summary ? 'courses') OR NOT (summary ? 'practice') THEN
  RAISE EXCEPTION 'FAIL: approved parent did not receive scoped progress summary'; END IF;
END $qa$;

SELECT set_config('request.jwt.claims',
 jsonb_build_object('sub',current_setting('qa.other'),'role','authenticated','aal','aal1')::text,true);
DO $qa$
DECLARE denied boolean:=false;
BEGIN
 IF public.is_approved_guardian_of(current_setting('qa.child')::uuid) THEN
  RAISE EXCEPTION 'FAIL: unrelated account authorized after approval'; END IF;
 BEGIN
  PERFORM public.get_my_guardian_learner_progress(current_setting('qa.child')::uuid);
 EXCEPTION WHEN raise_exception OR insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: unrelated account accessed progress after approval'; END IF;
END $qa$;

RESET ROLE;
DO $qa$
BEGIN
 IF (SELECT count(*) FROM private.guardian_decision_audit
   WHERE relationship_id=current_setting('qa.link')::uuid
   AND decision='verified')<>1 THEN
  RAISE EXCEPTION 'FAIL: no independent guardian decision audit'; END IF;
END $qa$;

ROLLBACK;
SELECT 'PASS: invite + one-use redemption + pending-only link + no premature progress + separate MFA approval + scoped parent progress + unrelated user denial + decision audit. All changes ROLLED BACK.' AS result;
