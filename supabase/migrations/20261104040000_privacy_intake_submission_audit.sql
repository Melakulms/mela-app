-- Record every accepted privacy request from its creation.
-- The BEFORE INSERT guard establishes auth.uid() ownership and canonical server
-- IDs/timestamps; this AFTER INSERT event shares the request's transaction.
-- No requester narrative, staff note or confidential identity content is copied.
CREATE OR REPLACE FUNCTION private.audit_data_subject_request_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := (SELECT auth.uid());
BEGIN
  IF v_actor IS NULL
     OR NEW.user_id IS DISTINCT FROM v_actor
     OR NEW.status IS DISTINCT FROM 'pending'
     OR NEW.handled_by IS NOT NULL
     OR NEW.response_notes IS NOT NULL
     OR NEW.completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Privacy request submission audit authorization failed'
      USING errcode='42501';
  END IF;

  INSERT INTO admin.audit_log (
    actor_user_id, actor_role, action, target_schema, target_table,
    target_id, before_data, after_data, metadata, request_id
  ) VALUES (
    v_actor, 'user', 'privacy.request_submitted',
    'public', 'data_subject_requests', NEW.id::text,
    NULL,
    jsonb_build_object('status','pending'),
    jsonb_build_object('category',NEW.request_type,
      'source','privacy-request-intake',
      'includes_request_details',false),
    NEW.id::text
  );

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.audit_data_subject_request_submission()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_data_subject_request_submission
  ON public.data_subject_requests;
CREATE TRIGGER trg_audit_data_subject_request_submission
  AFTER INSERT ON public.data_subject_requests
  FOR EACH ROW EXECUTE FUNCTION private.audit_data_subject_request_submission();
