-- PRODUCTION MIGRATION CANDIDATE: REVIEW ONLY. DO NOT AUTO-APPLY.
-- First additive compatibility wave for live MELA mentorship requests.
-- Designed against production Supabase project duizgtmbptmlbyipreqg,
-- which already has a live verified mentor and scheduled session.
-- Does NOT change: old acceptance auto-booking trigger, session status,
-- existing mentor identities, guardian validation, RLS or payment collection.
-- Apply only after signed-in behavior tests and backup approval.
DO $preflight$
BEGIN
  IF to_regclass('public.mentorship_requests') IS NULL THEN
    RAISE EXCEPTION 'Production mentorship request table not found';
  END IF;
  IF to_regprocedure('public.respond_mentorship_request_with_reason(uuid,text,text,text)') IS NOT NULL
    OR to_regprocedure('private.respond_mentorship_request_with_reason(uuid,text,text,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'A decline-with-reason implementation already exists: review before changing';
  END IF;
  IF to_regprocedure('private.is_admin_user()') IS NULL OR
    to_regprocedure('private.create_notification(uuid,text,text,text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Expected production authorization or notification dependency missing';
  END IF;
END;
$preflight$;

ALTER TABLE public.mentorship_requests
  ADD COLUMN IF NOT EXISTS decline_reason_code text,
  ADD COLUMN IF NOT EXISTS decline_note text,
  ADD COLUMN IF NOT EXISTS preferred_timezone text;

ALTER TABLE public.mentorship_requests
  ADD CONSTRAINT mentorship_requests_decline_reason_code_check
    CHECK (decline_reason_code IS NULL OR decline_reason_code IN
      ('schedule_unavailable','outside_expertise','capacity_full','different_timing','other')),
  ADD CONSTRAINT mentorship_requests_decline_note_check
    CHECK (decline_note IS NULL OR char_length(decline_note) BETWEEN 1 AND 300),
  ADD CONSTRAINT mentorship_requests_decline_fields_check
    CHECK (status='declined' OR (decline_reason_code IS NULL AND decline_note IS NULL)),
  ADD CONSTRAINT mentorship_requests_preferred_timezone_length
    CHECK (preferred_timezone IS NULL OR char_length(preferred_timezone) BETWEEN 3 AND 64);

-- The submitted instant remains timestamptz. The timezone is metadata only.
CREATE FUNCTION private.validate_mentorship_preferred_timezone()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $fn$
BEGIN
  IF new.preferred_timezone IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM pg_catalog.pg_timezone_names
    WHERE name=new.preferred_timezone
  ) THEN
    RAISE EXCEPTION 'Preferred timezone must be a valid IANA name';
  END IF;
  RETURN new;
END;
$fn$;
REVOKE ALL ON FUNCTION private.validate_mentorship_preferred_timezone()
  FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_validate_mentorship_preferred_timezone
  BEFORE INSERT OR UPDATE OF preferred_timezone ON public.mentorship_requests
  FOR EACH ROW EXECUTE FUNCTION private.validate_mentorship_preferred_timezone();

-- Existing production has broad INSERT and UPDATE table grants. The new
-- RPC is still server-authorized, but existing direct-write privileges
-- must be tightened separately after testing all legacy callers.
-- Do not falsely claim this migration closes direct-update pathways.
CREATE FUNCTION private.respond_mentorship_request_with_reason(
  p_request_id uuid, p_decision text,
  p_reason_code text DEFAULT NULL, p_note text DEFAULT NULL
) RETURNS public.mentorship_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_request public.mentorship_requests%rowtype;
  v_code text := nullif(btrim(coalesce(p_reason_code,'')),'');
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_admin boolean;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_decision NOT IN ('accepted','declined') THEN
    RAISE EXCEPTION 'Decision must be accepted or declined';
  END IF;
  IF p_decision='accepted' AND (v_code IS NOT NULL OR v_note IS NOT NULL) THEN
    RAISE EXCEPTION 'Decline reasons are not accepted with an approval';
  END IF;
  IF p_decision='declined' AND
    (v_code IS NULL OR v_code NOT IN ('schedule_unavailable','outside_expertise',
      'capacity_full','different_timing','other')) THEN
    RAISE EXCEPTION 'A valid decline reason is required';
  END IF;
  IF v_note IS NOT NULL AND char_length(v_note)>300 THEN
    RAISE EXCEPTION 'Decline note must be 300 characters or fewer';
  END IF;
  v_admin := private.is_admin_user() AND coalesce((auth.jwt()->>'aal'),'')='aal2';
  SELECT * INTO v_request FROM public.mentorship_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_request.mentor_id IS DISTINCT FROM v_actor AND NOT v_admin THEN
    RAISE EXCEPTION 'Only the mentor or MFA-verified administrator may respond';
  END IF;
  IF v_request.status <> 'pending' THEN RAISE EXCEPTION 'Request is no longer pending'; END IF;
  -- Preserve existing production request triggers and their live accepted
  -- auto-booking side effects. Never separately create a new session here.
  UPDATE public.mentorship_requests
    SET status=p_decision, responded_at=now(),
      decline_reason_code=CASE WHEN p_decision='declined' THEN v_code ELSE NULL END,
      decline_note=CASE WHEN p_decision='declined' THEN v_note ELSE NULL END
    WHERE id=p_request_id AND status='pending'
    RETURNING * INTO v_request;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request concurrently changed'; END IF;
  RETURN v_request;
END;
$fn$;
REVOKE ALL ON FUNCTION private.respond_mentorship_request_with_reason(uuid,text,text,text)
  FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.respond_mentorship_request_with_reason(
  p_request_id uuid, p_decision text,
  p_reason_code text DEFAULT NULL, p_note text DEFAULT NULL
) RETURNS public.mentorship_requests
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $fn$
  SELECT * FROM private.respond_mentorship_request_with_reason(
    p_request_id,p_decision,p_reason_code,p_note);
$fn$;
REVOKE ALL ON FUNCTION public.respond_mentorship_request_with_reason(uuid,text,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.respond_mentorship_request_with_reason(uuid,text,text,text)
  TO authenticated;
