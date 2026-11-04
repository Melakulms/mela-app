-- Defense in depth for pending learner-initiated guardian relationship requests.
-- At present authenticated clients have SELECT but no direct INSERT/UPDATE/DELETE
-- grants. This RLS policy must remain safe even if a later migration accidentally
-- widens INSERT permissions. A learner may request an UNLINKED pending guardian
-- relationship, never pre-bind another person's account.
--
-- The active parent invite redemption public.redeem_parent_link_invite_v36(text)
-- is SECURITY DEFINER (table owner) and creates a PENDING link upon proof of
-- the one-time invite and active verified parent account. It still requires
-- independent MFA admin review to become verified. The old, self-verifying v35
-- redemption wrapper remains revoked from authenticated and anon.
ALTER POLICY guardian_relationships_insert
  ON public.guardian_relationships
  WITH CHECK (
    learner_id = (SELECT auth.uid())
    AND guardian_user_id IS NULL
    AND status = 'pending'
    AND verified_at IS NULL
    AND verified_by IS NULL
  );
