-- Defense in depth: reject audit-ledger UPDATE, DELETE, and TRUNCATE.
-- The app roles already lack these privileges. This guard also rejects
-- accidental data-owner maintenance DML. It is not cryptographic WORM:
-- privileged users can still change DDL. Any later, lawful data-retention
-- process must be separately authorized, tested, and fully audited.
CREATE OR REPLACE FUNCTION private.reject_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  RAISE EXCEPTION 'MELA audit trail is append-only; record mutation requires a separately approved retention process'
    USING errcode = '42501';
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION private.reject_audit_log_mutation()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_reject_audit_log_update_delete ON admin.audit_log;
CREATE TRIGGER trg_reject_audit_log_update_delete
  BEFORE UPDATE OR DELETE ON admin.audit_log
  FOR EACH ROW EXECUTE FUNCTION private.reject_audit_log_mutation();

DROP TRIGGER IF EXISTS trg_reject_audit_log_truncate ON admin.audit_log;
CREATE TRIGGER trg_reject_audit_log_truncate
  BEFORE TRUNCATE ON admin.audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION private.reject_audit_log_mutation();
