-- Staging/production parity: current learner invitation issuer must remain
-- callable only by authenticated learners. Its SECURITY DEFINER body checks
-- auth.uid(), an active student profile, and issues a 30-minute single-use
-- token; it NEVER verifies parent identity or grants child-data access.
-- The old v35 *redemption* route remains revoked. Current parent redemption
-- uses v36 and always creates pending links, requiring MFA admin review.
REVOKE ALL ON FUNCTION public.create_parent_link_invite_v35()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_parent_link_invite_v35()
  TO authenticated;
