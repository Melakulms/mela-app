-- PRODUCTION CANDIDATE ROLLBACK — only for the exact wave 1 add-only migration.
-- Refuse data loss in request decline notes or timezone. Reverting the
-- exported RPC also requires confirmation no frontend is still using it.
DO $preflight$
BEGIN
  IF EXISTS (SELECT 1 FROM public.mentorship_requests
    WHERE decline_reason_code IS NOT NULL OR decline_note IS NOT NULL
      OR preferred_timezone IS NOT NULL) THEN
    RAISE EXCEPTION 'Rollback blocked: new request decline/timezone data exists';
  END IF;
END;
$preflight$;
DROP FUNCTION IF EXISTS public.respond_mentorship_request_with_reason(uuid,text,text,text);
DROP FUNCTION IF EXISTS private.respond_mentorship_request_with_reason(uuid,text,text,text);
DROP TRIGGER IF EXISTS trg_validate_mentorship_preferred_timezone ON public.mentorship_requests;
DROP FUNCTION IF EXISTS private.validate_mentorship_preferred_timezone();
ALTER TABLE public.mentorship_requests
  DROP CONSTRAINT IF EXISTS mentorship_requests_decline_reason_code_check,
  DROP CONSTRAINT IF EXISTS mentorship_requests_decline_note_check,
  DROP CONSTRAINT IF EXISTS mentorship_requests_decline_fields_check,
  DROP CONSTRAINT IF EXISTS mentorship_requests_preferred_timezone_length,
  DROP COLUMN IF EXISTS decline_reason_code,
  DROP COLUMN IF EXISTS decline_note,
  DROP COLUMN IF EXISTS preferred_timezone;
