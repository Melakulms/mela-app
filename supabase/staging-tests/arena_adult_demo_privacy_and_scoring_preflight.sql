-- MELA staging QA only — project tungqfmypuwzeyrtaseh. Read-only
-- verification and transactionally rolled-back simulated permission checks.
-- Does NOT simulate a valid live user session or establish two-player match proof.
BEGIN;
DO $qa$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n
 FROM public.skill_assessments a JOIN public.assessment_questions q ON q.assessment_id=a.id
 WHERE a.title='MELA STAGING DEMO — Adult Arena Fundamentals (not teacher-reviewed)'
   AND a.status='published' AND q.active;
 IF n<>8 THEN RAISE EXCEPTION 'Expected 8 staged demo questions; found %',n;END IF;
 IF (SELECT count(*) FROM private.assessment_answer_keys k
     JOIN public.assessment_questions q ON q.id=k.question_id
     JOIN public.skill_assessments a ON a.id=q.assessment_id
     WHERE a.title='MELA STAGING DEMO — Adult Arena Fundamentals (not teacher-reviewed)')<>8
 THEN RAISE EXCEPTION 'Staging demo answer keys incomplete';END IF;
 IF EXISTS(SELECT 1 FROM public.arena_matches WHERE rated=true AND title LIKE 'Mela Matchmaking%')
 THEN RAISE EXCEPTION 'Unexpected rated staging demo match';END IF;
END;$qa$;
SET LOCAL ROLE anon;
DO $qa$ BEGIN
 IF has_function_privilege('anon','public.join_arena_matchmaking(text,uuid,uuid,integer)','EXECUTE')
 OR has_function_privilege('anon','public.submit_arena_round(uuid,jsonb,text)','EXECUTE')
 OR has_function_privilege('anon','public.staging_arena_advance_my_match_v1(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Anonymous access to Arena mutation detected';END IF;
END $qa$;
RESET ROLE;
SELECT set_config('request.jwt.claims',
 '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $qa$ BEGIN
 PERFORM public.get_arena_leaderboard('global','all_time','overall',null,null,20);
 BEGIN
  PERFORM public.join_arena_matchmaking('skill_sprint',null,null,200);
  RAISE EXCEPTION 'UNAUTHORIZED_JOIN_SUCCEEDED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='UNAUTHORIZED_JOIN_SUCCEEDED' THEN RAISE;END IF;
  IF POSITION('Adult staging student verification needed' IN SQLERRM)=0
   THEN RAISE EXCEPTION 'Unexpected access error: %',SQLERRM;END IF;
 END;
END $qa$;
RESET ROLE;
ROLLBACK;
-- Live test gate: two distinct adult Auth sessions; quizzes and written answers;
-- timer expiration, cancellation, accurate 0/10 scoring, replay and isolation.
