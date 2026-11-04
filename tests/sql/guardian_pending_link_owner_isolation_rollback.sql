-- MELA staging-only guardian-relationship authorization regression test.
-- Execute the WHOLE file within one staging SQL transaction. Creates no accounts.
-- Simulates an accidental future INSERT grant, checks RLS, then ROLLBACKs
-- every test grant, fake link, and session claim. Never run on production.
BEGIN;

SELECT set_config('mela.qa.learner',
 (SELECT id::text FROM public.profiles
  WHERE role='student' AND account_status='active' AND deleted_at IS NULL
  ORDER BY id LIMIT 1),true);
SELECT set_config('mela.qa.other',
 (SELECT id::text FROM public.profiles
  WHERE role='student' AND account_status='active' AND deleted_at IS NULL
  ORDER BY id OFFSET 1 LIMIT 1),true);
DO $qa$
BEGIN
 IF current_setting('mela.qa.learner',true) IS NULL
 OR current_setting('mela.qa.other',true) IS NULL
 THEN RAISE EXCEPTION 'STOP: two staging student accounts required'; END IF;
END $qa$;

-- Current production posture does not permit this GRANT. It is applied
-- temporarily ONLY to test defense in depth, and is fully rolled back.
GRANT INSERT ON public.guardian_relationships TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
 jsonb_build_object('sub',current_setting('mela.qa.learner'),
 'role','authenticated','aal','aal1')::text,true);

DO $qa$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  INSERT INTO public.guardian_relationships
   (learner_id,guardian_user_id,guardian_email,relationship,status)
  VALUES(auth.uid(),current_setting('mela.qa.other')::uuid,
         'forged-binding-qa@example.invalid','parent','pending');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN
  RAISE EXCEPTION 'FAIL: RLS permitted learner to pre-bind unrelated guardian user';
 END IF;
END $qa$;

INSERT INTO public.guardian_relationships
 (learner_id,guardian_user_id,guardian_email,relationship,status)
 VALUES(auth.uid(),NULL,'unlinked-qa@example.invalid','parent','pending');

DO $qa$
BEGIN
 IF (SELECT count(*) FROM public.guardian_relationships
  WHERE learner_id=auth.uid() AND guardian_email='unlinked-qa@example.invalid'
  AND guardian_user_id IS NULL AND status='pending'
  AND verified_by IS NULL AND verified_at IS NULL)<>1 THEN
   RAISE EXCEPTION 'FAIL: legitimate pending unlinked request blocked'; END IF;
END $qa$;

-- The unrelated account cannot see the learner's unlinked pending request.
SELECT set_config('request.jwt.claims',
 jsonb_build_object('sub',current_setting('mela.qa.other'),
 'role','authenticated','aal','aal1')::text,true);
DO $qa$
BEGIN
 IF EXISTS (SELECT 1 FROM public.guardian_relationships
   WHERE guardian_email='unlinked-qa@example.invalid') THEN
  RAISE EXCEPTION 'FAIL: unrelated account read unlinked guardian request';
 END IF;
END $qa$;

RESET ROLE;
-- Verify the legacy self-verifying public entry point remains unreachable.
DO $qa$
BEGIN
 IF has_function_privilege('authenticated',
     'public.redeem_parent_link_invite_v35(text)','EXECUTE') OR
    has_function_privilege('anon',
     'public.redeem_parent_link_invite_v35(text)','EXECUTE') THEN
   RAISE EXCEPTION 'FAIL: old v35 self-verifying endpoint is executable';
 END IF;
 IF NOT has_function_privilege('authenticated',
     'public.redeem_parent_link_invite_v36(text)','EXECUTE') THEN
   RAISE EXCEPTION 'FAIL: current v36 parent invite redemption unavailable';
 END IF;
 IF (SELECT relforcerowsecurity
     FROM pg_class WHERE oid='public.guardian_relationships'::regclass) THEN
   RAISE EXCEPTION 'STOP: changed FORCE RLS; verify legitimate v36 definer flow';
 END IF;
END $qa$;

ROLLBACK;
SELECT 'PASS: forged guardian pre-binding denied; pending unlinked request allowed and private; v35 disabled, v36 available; all test grants/records rolled back' AS result;