-- Secure owner-initiated privacy request intake, even outside the official form.
-- Staging proof: forged review notes/assignee/completion rejected; arbitrary UUID
-- and timestamps replaced; existing request RPC + cancellation still work.
CREATE OR REPLACE FUNCTION private.guard_data_subject_request_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := (SELECT auth.uid());
BEGIN
  IF v_actor IS NULL OR NEW.user_id IS DISTINCT FROM v_actor
     OR NEW.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'Privacy request intake requires the authenticated owner and pending status'
      USING errcode = '42501';
  END IF;
  IF NEW.response_notes IS NOT NULL
     OR NEW.handled_by IS NOT NULL
     OR NEW.completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Reviewer fields cannot be supplied at request intake'
      USING errcode = '42501';
  END IF;
  NEW.id := extensions.gen_random_uuid();
  NEW.requested_at := clock_timestamp();
  NEW.updated_at := NEW.requested_at;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.guard_data_subject_request_insert()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_data_subject_request_insert ON public.data_subject_requests;
CREATE TRIGGER trg_guard_data_subject_request_insert
  BEFORE INSERT ON public.data_subject_requests
  FOR EACH ROW EXECUTE FUNCTION private.guard_data_subject_request_insert();
