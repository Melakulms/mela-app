-- STAGING-ONLY security hardening. No production migration is authorized.
-- Previously, an unrestricted participant UPDATE policy was dormant solely because
-- client roles had no UPDATE table privileges. A future table-level GRANT would
-- allow participants to change notes and other columns without AAL2.
-- Participant session changes must continue through the existing checked RPCs.
-- The policy is currently inert on staging (authenticated has no UPDATE).
-- Removing it does not change SELECT, INSERT, DELETE or SECURITY DEFINER RPC access.
drop policy if exists "Mentorship sessions update by participants" on public.mentorship_sessions;
