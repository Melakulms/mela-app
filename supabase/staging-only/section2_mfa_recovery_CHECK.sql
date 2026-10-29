-- Run after forward recovery migration. Structural checks only.
DO $check$
DECLARE
  v_func text;
BEGIN
  IF to_regclass('private.mentor_mfa_recovery_requests') IS NULL
    OR to_regclass('private.mentor_mfa_recovery_reviews') IS NULL THEN
    RAISE EXCEPTION 'MFA recovery tables are missing';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='private.mentor_mfa_recovery_requests'::regclass)
    OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='private.mentor_mfa_recovery_reviews'::regclass) THEN
    RAISE EXCEPTION 'Recovery tables must have row-level security enabled';
  END IF;
  IF has_table_privilege('authenticated','private.mentor_mfa_recovery_requests','SELECT')
    OR has_table_privilege('authenticated','private.mentor_mfa_recovery_requests','UPDATE')
    OR has_table_privilege('anon','private.mentor_mfa_recovery_requests','SELECT')
    OR has_table_privilege('authenticated','private.mentor_mfa_recovery_reviews','INSERT') THEN
    RAISE EXCEPTION 'Client can directly access private recovery evidence';
  END IF;
  IF has_function_privilege('anon','public.list_mentor_mfa_recovery_requests()','EXECUTE')
    OR has_function_privilege('anon','public.request_mentor_mfa_recovery(text)','EXECUTE')
    OR has_function_privilege('anon','public.review_mentor_mfa_recovery(uuid,text,boolean)','EXECUTE')
    OR has_function_privilege('anon','public.claim_mentor_mfa_recovery(uuid)','EXECUTE')
    OR has_function_privilege('anon','public.finalize_mentor_mfa_recovery(uuid,boolean)','EXECUTE')
    OR has_function_privilege('authenticated','public.finalize_mentor_mfa_recovery(uuid,boolean)','EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous/client role has a privileged MFA recovery grant';
  END IF;
  IF NOT has_function_privilege('service_role','public.finalize_mentor_mfa_recovery(uuid,boolean)','EXECUTE') THEN
    RAISE EXCEPTION 'Trusted backend cannot finalize recovery';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='private'
      AND indexname='mentor_mfa_recovery_one_active_per_mentor') THEN
    RAISE EXCEPTION 'One-active-request constraint missing';
  END IF;
  FOREACH v_func IN ARRAY ARRAY[
     'request_mentor_mfa_recovery(text)',
     'review_mentor_mfa_recovery(uuid,text,boolean)',
     'claim_mentor_mfa_recovery(uuid)',
     'list_mentor_mfa_recovery_requests()',
     'finalize_mentor_mfa_recovery(uuid,boolean)'
  ] LOOP
    IF NOT (SELECT prosecdef FROM pg_proc WHERE oid=('public.'||v_func)::regprocedure) THEN
      RAISE EXCEPTION 'Expected guarded definer RPC: %',v_func;
    END IF;
  END LOOP;
END;
$check$;
