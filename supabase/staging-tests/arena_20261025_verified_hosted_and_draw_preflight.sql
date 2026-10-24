-- MELA ARENA STAGING RELEASE PREFLIGHT · 2026-10-25
-- RUN ONLY against Supabase staging project tungqfmypuwzeyrtaseh.
-- Never apply to production duizgtmbptmlbyipreqg.
-- Read-only, transaction-scoped assertions. ROLLBACK prevents any writes.
BEGIN;
DO $checks$
DECLARE start_def text;finish_def text;board_def text;host_def text;
BEGIN
 SELECT pg_get_functiondef('private.start_arena(uuid)'::regprocedure) INTO start_def;
 SELECT pg_get_functiondef('private.finalize_arena_match(uuid)'::regprocedure) INTO finish_def;
 SELECT pg_get_functiondef('private.get_arena_live_scoreboard(uuid)'::regprocedure) INTO board_def;
 SELECT pg_get_functiondef('public.staging_arena_public_hosted_list_v1(text,integer,integer)'::regprocedure) INTO host_def;
 IF position('v_m.rules->>''matchmaking''=''true''' IN start_def)=0
    OR position('v_m.rated=false' IN start_def)=0
    OR position('all participants must be ready' IN start_def)=0
 THEN RAISE EXCEPTION 'A matched participant can bypass startup safety, or recovery is missing';END IF;
 IF position('dense_rank() over(order by score desc' IN finish_def)=0
    OR position('dense_rank() over(order by ap.score desc)' IN board_def)=0
 THEN RAISE EXCEPTION 'Draw instead of join-order win is not installed';END IF;
 IF position('verification_status=''approved''' IN host_def)=0
 THEN RAISE EXCEPTION 'Hosted competitions do not filter verified organizers';END IF;
 IF has_function_privilege('anon',
  'public.staging_arena_public_hosted_list_v1(text,integer,integer)','EXECUTE')
  OR has_function_privilege('anon',
  'public.staging_arena_hosted_join_v1(text,text,uuid,text,text)','EXECUTE')
  OR has_function_privilege('anon',
  'public.staging_arena_review_submission_v1(uuid,numeric,text)','EXECUTE')
 THEN RAISE EXCEPTION 'Anonymous access to hosted/judging API detected';END IF;
 IF NOT has_function_privilege('authenticated',
  'public.staging_arena_public_hosted_list_v1(text,integer,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'Adult beta hosted discovery is not accessible';END IF;
 IF (SELECT count(*) FROM public.assessment_questions q
      JOIN public.skill_assessments a ON a.id=q.assessment_id
      WHERE a.title='MELA STAGING DEMO — Adult Arena Fundamentals (not teacher-reviewed)'
        AND q.active)<>8
 THEN RAISE EXCEPTION 'Eight-question staging assessment unavailable';END IF;
 IF (SELECT count(*) FROM private.assessment_answer_keys k
      JOIN public.assessment_questions q ON k.question_id=q.id
      JOIN public.skill_assessments a ON a.id=q.assessment_id
      WHERE a.title='MELA STAGING DEMO — Adult Arena Fundamentals (not teacher-reviewed)')<>8
 THEN RAISE EXCEPTION 'Demo keys missing, quiz cannot be graded safely';END IF;
 RAISE NOTICE 'Arena staging static DB and role preflight passed';
END $checks$;
SELECT
 (SELECT count(*) FROM public.arena_matches) AS matches,
 (SELECT count(*) FROM public.arena_round_submissions) AS answers,
 (SELECT count(*) FROM public.arena_tournaments) AS tournaments,
 (SELECT count(*) FROM public.student_profiles WHERE date_of_birth IS NOT NULL) AS dob_entries,
 (SELECT count(*) FROM public.arena_reward_rules) AS reward_rules;
ROLLBACK;

-- NON-AUTOMATED RELEASE GATES:
-- 1. Two real independent adult staging sign-ins and concurrent quiz matchmaking.
-- 2. Both become ready; either starts. 8 correct/wrong/timeout scores and tie behavior.
-- 3. Disconnect, reconnect, queue cancellation, privacy and match isolation.
-- 4. Independent MFA judge grades written task and finishes matched competition.
-- 5. Verified teacher/employer publishes genuine public event; team creation,
--    join code, team registration and organizer approval tests.
-- 6. Bracket progression, tie-break policy, child eligibility and admin audit tests.
-- 7. Android browser and installed PWA tests. Until then Arena is BETA only.
