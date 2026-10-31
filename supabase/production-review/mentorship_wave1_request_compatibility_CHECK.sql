-- Run after forward migration in a transaction on PROD.
-- Asserts additive structure and privileges; does not prove signed Auth/Android.
DO $check$
BEGIN
  IF to_regprocedure('public.respond_mentorship_request_with_reason(uuid,text,text,text)') IS NULL
    OR to_regprocedure('private.respond_mentorship_request_with_reason(uuid,text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'Expected response RPC missing';
  END IF;
  IF NOT (select prosecdef from pg_proc where oid=
    'public.respond_mentorship_request_with_reason(uuid,text,text,text)'::regprocedure) THEN
    RAISE EXCEPTION 'Public request response wrapper is not SECURITY DEFINER';
  END IF;
  IF has_function_privilege('anon',
      'public.respond_mentorship_request_with_reason(uuid,text,text,text)','EXECUTE')
    OR has_function_privilege('authenticated',
      'private.respond_mentorship_request_with_reason(uuid,text,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected direct anonymous/private function EXECUTE grant';
  END IF;
  IF NOT has_function_privilege('authenticated',
    'public.respond_mentorship_request_with_reason(uuid,text,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated role cannot execute guarded public function';
  END IF;
  IF (select count(*) from information_schema.columns where table_schema='public'
      and table_name='mentorship_requests' and column_name in
      ('decline_reason_code','decline_note','preferred_timezone')) <> 3 THEN
    RAISE EXCEPTION 'Request compatibility fields missing';
  END IF;
  IF NOT EXISTS(select 1 from pg_trigger where tgrelid='public.mentorship_requests'::regclass
     and tgname='trg_validate_mentorship_preferred_timezone') THEN
    RAISE EXCEPTION 'Timezone trigger missing';
  END IF;
  -- Critical: existing live acceptance-to-session trigger must remain
  -- exactly in place until a separate product behavior change is approved.
  IF NOT EXISTS(select 1 from pg_trigger where tgrelid='public.mentorship_requests'::regclass
     and tgname='trg_process_mentorship_request_status') THEN
    RAISE NOTICE 'Verify original request status trigger name before promotion';
  END IF;
END;
$check$;

-- Unauthenticated calls never act upon mentorship requests.
DO $test$
DECLARE v_rejected boolean := false;
BEGIN
  BEGIN
    PERFORM public.respond_mentorship_request_with_reason(
      '10000000-0000-4000-8000-000000000777','declined','other','test');
  EXCEPTION WHEN others THEN
    IF position('Authentication required' in SQLERRM)>0 THEN
      v_rejected := true;
    ELSE RAISE;
    END IF;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Unauthenticated RPC call succeeded'; END IF;
END;
$test$;
