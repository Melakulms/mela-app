-- MELA staging only: scholarship admin connectivity + student preparation regression.
-- Expected project: tungqfmypuwzeyrtaseh. Transaction rolls back simulated claims.
BEGIN;
SET LOCAL ROLE anon;
DO $$
DECLARE s jsonb;
BEGIN
  SELECT public.staging_scholarship_public_status_v1() INTO s;
  IF (s->>'university_count')::integer<>200 OR (s->>'funding_page_count')::integer<>43
     OR (s->>'research_programme_count')::integer<>12
     THEN RAISE EXCEPTION 'Staging public scholarship status mismatch'; END IF;
  IF has_function_privilege('anon','public.staging_super_admin_assignment_v1()','EXECUTE')
     THEN RAISE EXCEPTION 'Anonymous caller has administrator assignment check'; END IF;
  IF has_table_privilege('anon','public.mela_staging_scholarship_metrics','INSERT')
     THEN RAISE EXCEPTION 'Anonymous caller may alter public status'; END IF;
END;
$$;
RESET ROLE;
SELECT set_config('request.jwt.claims',
 '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE p bigint;
BEGIN
 IF public.staging_super_admin_assignment_v1() IS DISTINCT FROM false
    THEN RAISE EXCEPTION 'Unregistered staging identity can enroll admin MFA'; END IF;
 SELECT min(id) INTO p FROM public.mela_scholarship_program_research;
 BEGIN
   INSERT INTO public.mela_scholarship_research_progress
     (user_id,program_id,step_key,completed)
   VALUES ('00000000-0000-4000-8000-000000000002',p,'check_eligibility',true);
   RAISE EXCEPTION 'FAIL: cross-account progress mutation was permitted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 WHEN OTHERS THEN
   IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
   RAISE EXCEPTION 'Unexpected cross-account denial: %', SQLERRM;
 END;
END;
$$;
RESET ROLE;
ROLLBACK;
-- IMPORTANT: does not establish real Android browser connectivity or complete privileged MFA login.
