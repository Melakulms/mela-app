-- STAGING-ONLY ROLLBACK. Use only after reviewing present grants and
-- verifying the original privilege configuration is still applicable.
-- This deliberately restores the PREVIOUS direct authenticated execute grant,
-- so it REOPENS the access path and must never be automatic.
ALTER FUNCTION public.complete_mentorship_session(uuid,text) SECURITY INVOKER;
ALTER FUNCTION public.schedule_mentorship_session(uuid,timestamptz,integer,text) SECURITY INVOKER;
ALTER FUNCTION public.respond_mentorship_request_with_reason(uuid,text,text,text) SECURITY INVOKER;

GRANT EXECUTE ON FUNCTION private.complete_mentorship_session(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.schedule_mentorship_session(uuid,timestamptz,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.respond_mentorship_request_with_reason(uuid,text,text,text) TO authenticated;
