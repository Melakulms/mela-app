-- Run after proposed hardening inside transaction on STAGING.
-- This tests database grants/metadata, NOT genuine MFA or actor behavior.
DO $check$
DECLARE
  v_fn text;
  v_public_oid oid;
  v_private_oid oid;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'complete_mentorship_session(uuid,text)',
    'schedule_mentorship_session(uuid,timestamptz,integer,text)',
    'respond_mentorship_request_with_reason(uuid,text,text,text)'
  ] LOOP
    v_public_oid := to_regprocedure('public.'||v_fn);
    v_private_oid := to_regprocedure('private.'||v_fn);
    IF v_public_oid IS NULL OR v_private_oid IS NULL THEN
      RAISE EXCEPTION 'Missing mentorship function: %',v_fn;
    END IF;
    IF (SELECT NOT prosecdef FROM pg_proc WHERE oid=v_public_oid) THEN
      RAISE EXCEPTION 'Public wrapper is not SECURITY DEFINER: %',v_fn;
    END IF;
    IF (SELECT pg_get_userbyid(proowner) <> 'postgres' FROM pg_proc WHERE oid=v_public_oid) THEN
      RAISE EXCEPTION 'Unrecognized public wrapper owner: %',v_fn;
    END IF;
    IF has_function_privilege('authenticated',v_private_oid,'EXECUTE') OR
       has_function_privilege('anon',v_private_oid,'EXECUTE') THEN
      RAISE EXCEPTION 'Client still directly executes private function: %',v_fn;
    END IF;
    IF NOT has_function_privilege('authenticated',v_public_oid,'EXECUTE') OR
       has_function_privilege('anon',v_public_oid,'EXECUTE') THEN
      RAISE EXCEPTION 'Public RPC grants changed unexpectedly: %',v_fn;
    END IF;
  END LOOP;
  RAISE NOTICE 'Three existing mentorship RPC grants/definer checks passed';
END;
$check$;
