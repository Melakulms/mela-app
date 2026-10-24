-- STAGING ONLY: MELA guardian / university safety regression smoke checks.
-- Never execute against production. This script rolls back all session changes.
-- Safe for repeated use, and does not insert users or privileged accounts.
BEGIN;

DO $check$
BEGIN
  IF (SELECT count(*) FROM public.education_audience_stages) <> 6
    THEN RAISE EXCEPTION 'FAIL: expected six education audience stages'; END IF;
  IF (SELECT count(*) FROM public.audience_opportunity_rules WHERE opportunity_type='scholarships') <> 6
    THEN RAISE EXCEPTION 'FAIL: scholarship stage rules incomplete'; END IF;
  IF (SELECT count(*) FROM public.universities WHERE is_active) <> 200
    THEN RAISE EXCEPTION 'FAIL: expected 200 active research universities'; END IF;
  IF (SELECT count(*) FROM public.university_funding_sources) < 43
    THEN RAISE EXCEPTION 'FAIL: missing official funding research links'; END IF;
  IF (SELECT count(*) FROM public.mela_national_subject_catalog
      WHERE active AND source_status='pending_review') < 55
    THEN RAISE EXCEPTION 'FAIL: staging provisional school subjects missing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='applications'
      AND policyname='applications_insert_minor_gate'
      AND cmd='INSERT' AND permissive='RESTRICTIVE'
  ) THEN RAISE EXCEPTION 'FAIL: required restrictive application policy missing'; END IF;
  IF has_function_privilege('anon','public.review_guardian_consent(uuid,text,text)','EXECUTE')
    THEN RAISE EXCEPTION 'FAIL: anonymous guardian decisions enabled'; END IF;
  IF has_table_privilege('authenticated','private.guardian_decision_audit','INSERT')
    THEN RAISE EXCEPTION 'FAIL: public actor may forge an audit record'; END IF;
END;
$check$;

SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
DO $deny$
BEGIN
  IF public.can_apply('00000000-0000-4000-8000-000000000001') IS DISTINCT FROM false
    THEN RAISE EXCEPTION 'FAIL: synthetic missing student can apply'; END IF;
  BEGIN
    PERFORM public.review_guardian_consent(
      '00000000-0000-4000-8000-000000000002',
      'verified','test notes only - not an actual guardian');
    RAISE EXCEPTION 'FAIL: ordinary user could verify guardian';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
    IF position('super administrator' in SQLERRM) = 0 THEN
      RAISE EXCEPTION 'FAIL: unexpected verification error: %',SQLERRM;
    END IF;
  END;
END;
$deny$;
RESET ROLE;
ROLLBACK;

-- This is a simulated negative authorization test, NOT a real MFA sign-in,
-- actual parent/student journey, or confirmation of Ethiopian scholarship eligibility.
