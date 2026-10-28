-- STAGING ONLY. Refuse any rollback that would erase real security reviews
-- or recovery history, unless an explicit, independently reviewed data
-- retention and audit export procedure has already been completed.
DO $guard$
BEGIN
  IF EXISTS(SELECT 1 FROM private.mentor_mfa_recovery_requests)
    OR EXISTS(SELECT 1 FROM private.mentor_mfa_recovery_reviews) THEN
    RAISE EXCEPTION 'MFA recovery rollback blocked: retain all request and review records for audit';
  END IF;
END;
$guard$;
DROP FUNCTION IF EXISTS public.finalize_mentor_mfa_recovery(uuid,boolean);
DROP FUNCTION IF EXISTS public.claim_mentor_mfa_recovery(uuid);
DROP FUNCTION IF EXISTS public.review_mentor_mfa_recovery(uuid,text,boolean);
DROP FUNCTION IF EXISTS public.request_mentor_mfa_recovery(text);
DROP FUNCTION IF EXISTS private.mentor_mfa_recovery_is_admin();
DROP TABLE IF EXISTS private.mentor_mfa_recovery_reviews;
DROP TABLE IF EXISTS private.mentor_mfa_recovery_requests;
