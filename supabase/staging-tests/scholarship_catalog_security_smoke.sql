-- MELA scholarship staging-only smoke suite.
-- Project: tungqfmypuwzeyrtaseh. Never run against production.
BEGIN;
DO $smoke$
DECLARE n integer;
BEGIN
 IF has_table_privilege('anon','public.mela_scholarship_program_research','SELECT')
    THEN RAISE EXCEPTION 'FAIL: anonymous research table readable'; END IF;
 IF has_table_privilege('authenticated','public.mela_scholarship_program_research','INSERT')
    OR has_table_privilege('authenticated','public.mela_scholarship_program_research','UPDATE')
    THEN RAISE EXCEPTION 'FAIL: public clients may fabricate scholarship programmes'; END IF;
 IF has_function_privilege('anon','public.mela_review_scholarship_program(bigint,text,text)','EXECUTE')
    THEN RAISE EXCEPTION 'FAIL: anonymous scholarship approval enabled'; END IF;
 IF has_function_privilege('anon','public.check_scholarship_eligibility(uuid)','EXECUTE')
    THEN RAISE EXCEPTION 'FAIL: anonymous eligibility tool enabled'; END IF;
 SELECT count(*) INTO n FROM public.mela_scholarship_program_research
  WHERE research_state='source_checked';
 IF n<>12 THEN RAISE EXCEPTION 'FAIL: expected 12 source-checked programmes, got %',n; END IF;
 IF EXISTS (
 SELECT 1 FROM public.mela_scholarship_program_research
 WHERE closes_on IS NOT NULL AND deadline_status='dated' AND closes_on<opens_on
 ) THEN RAISE EXCEPTION 'FAIL: reversed scholarship dates'; END IF;
 IF position('premium subscription required' in pg_get_functiondef('public.check_scholarship_eligibility(uuid)'::regprocedure))>0
 THEN RAISE EXCEPTION 'FAIL: scholarship fit check is paywalled'; END IF;
END;$smoke$;

SELECT set_config('request.jwt.claims',
 '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
DO $deny$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.mela_scholarship_program_research;
 IF n<>12 THEN RAISE EXCEPTION 'FAIL: research programmes invisible to signed-in learner'; END IF;
 BEGIN
  PERFORM public.mela_review_scholarship_program(
    (SELECT min(id) FROM public.mela_scholarship_program_research),
    'approve',
    'Synthetic check; not real administrator verification');
  RAISE EXCEPTION 'FAIL: unauthorized approval succeeded';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  IF position('super administrator' in SQLERRM)=0 THEN
    RAISE EXCEPTION 'FAIL: unexpected admin denial: %',SQLERRM; END IF;
 END;
 BEGIN
  INSERT INTO public.mela_scholarship_research_saved(user_id,program_id)
    SELECT '00000000-0000-4000-8000-000000000002'::uuid, min(id)
    FROM public.mela_scholarship_program_research;
  RAISE EXCEPTION 'FAIL: forged bookmark owner accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 WHEN OTHERS THEN
  IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  RAISE EXCEPTION 'FAIL: bookmark authorization rejection was not RLS: %',SQLERRM;
 END;
END;$deny$;
RESET ROLE;
ROLLBACK;

-- Does not replace actual Android browser, real user save flow or MFA reviewer E2E.
