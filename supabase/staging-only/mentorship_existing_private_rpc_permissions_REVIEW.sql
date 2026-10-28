-- REVIEW ONLY — STAGING-ONLY; DO NOT ADD TO AUTOMATIC PRODUCTION MIGRATIONS.
-- Independent from PR #98. Reconciles a preexisting authenticated EXECUTE grant
-- on three SECURITY DEFINER functions in schema private.
-- Keep public entry-point names/signatures/return types and underlying guards.
--
-- PRECONDITIONS: 2026-10-28 staging functions are owned by postgres; the three
-- public wrapper functions are currently SECURITY INVOKER and grant EXECUTE to
-- authenticated and service_role, not anon/PUBLIC.
DO $preflight$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN (
      'complete_mentorship_session',
      'schedule_mentorship_session',
      'respond_mentorship_request_with_reason'
    )
      AND pg_get_userbyid(p.proowner) <> 'postgres'
  ) THEN
    RAISE EXCEPTION 'Unexpected public mentorship RPC owner: re-review before hardening';
  END IF;
  IF to_regprocedure('public.complete_mentorship_session(uuid,text)') IS NULL OR
     to_regprocedure('public.schedule_mentorship_session(uuid,timestamptz,integer,text)') IS NULL OR
     to_regprocedure('public.respond_mentorship_request_with_reason(uuid,text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'Expected public mentorship RPC entry point is missing';
  END IF;
END;
$preflight$;

-- These existing SQL wrappers already use SET search_path = '' and call only
-- fixed, fully qualified private targets. Their callee functions enforce
-- actor identity, ownership and relevant role / time/eligibility checks.
ALTER FUNCTION public.complete_mentorship_session(uuid,text) SECURITY DEFINER;
ALTER FUNCTION public.schedule_mentorship_session(uuid,timestamptz,integer,text) SECURITY DEFINER;
ALTER FUNCTION public.respond_mentorship_request_with_reason(uuid,text,text,text) SECURITY DEFINER;

-- Remove direct SQL entry for client roles. PUBLIC is included explicitly
-- so a future grants change cannot leave default EXECUTE inherited.
REVOKE ALL ON FUNCTION private.complete_mentorship_session(uuid,text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.schedule_mentorship_session(uuid,timestamptz,integer,text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.respond_mentorship_request_with_reason(uuid,text,text,text)
  FROM PUBLIC, anon, authenticated;

-- Explicitly preserve the existing public Data API entry points. The
-- underlying function bodies and public function signatures are unchanged.
GRANT EXECUTE ON FUNCTION public.complete_mentorship_session(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_mentorship_session(uuid,timestamptz,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_mentorship_request_with_reason(uuid,text,text,text) TO authenticated;
