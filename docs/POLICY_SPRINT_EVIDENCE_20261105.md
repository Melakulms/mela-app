# MELA policy / RLS sprint evidence — 2026-11-05

**Status: staging fix applied, production unchanged, policy launch NOT approved.**
Environment: staging \`tungqfmypuwzeyrtaseh\`, production \`duizgtmbptmlbyipreqg\`.

## Verified staging RLS repair
Before change: querying \`public.opportunities\` as \`anon\` failed with PostgreSQL 42501 permission denied for \`public.employers\`.
Root cause: anonymous \`opportunities\` SELECT policy referenced the employer table and authenticated owner/team subqueries while anon had no employer SELECT grant.

Applied staging migration: \`mela_opportunities_anon_public_read_fix_20261105\`.
Tracked staged-only SQL: \`supabase/staging-only/20261105_mela_opportunities_anon_public_read.sql\`.
Regression and rollback: \`tests/sql/20261105_opportunities_anon_read_regression.sql\` and accompanying explicit rollback SQL.

Technical fix:
- Separate \`anon\` from \`authenticated\` RLS SELECT policies.
- Preserve original authenticated owner/team/admin authorization clauses.
- Public policy requires open, verified-active, approved, nonexpired opportunity.
- For associated employers, a private stable definer helper returns only whether the employer is verified.
- Function pins the search_path, does not return personal data, and EXECUTE is revoked from PUBLIC.
- \`anon\` still has **no direct SELECT permission** on \`public.employers\`.

Verified in staging on 2026-11-05:
- Anonymous \`SELECT COUNT(*)\` over opportunities and screening questions: succeeds.
- Authenticated \`SELECT COUNT(*)\` over opportunities: succeeds.
- No rows outside public opportunity criteria visible to anon in current dataset.
- Unknown all-zero employer UUID returns false when queried by privileged QA.
- 0 eligible public opportunities in the existing staging dataset. Subsequently **a rollback-only synthetic test passed** (three inserted listings: verified/open/approved, unverified/open/approved, verified/closed; an anonymous query saw exactly one). All synthetic rows were confirmed absent afterward. This does not certify actual Android browsing or end-to-end signed-in employer/team workflows.

## Security baseline, staging
Latest security advisor categories: 62 RLS-enabled tables with no policies (many may be intentionally private); 63 authenticated-callable SECURITY DEFINER functions requiring individual review; leaked-password protection warning still active. The previously reported anonymous SECURITY DEFINER finding is absent. This is not a security certification.

## Production hold
No production SQL, feature flags, migration, records, policies, secrets or payment settings changed in this sprint.
Reconcile the previous staging-only privilege migrations and create a reviewed production-specific patch if needed. Before production promotion:
1. Add rollback-only fixtures for verified/unverified employers and anonymous opportunity visibility.
2. Test employer/owner/team/admin cross-role cases with real test users, not only no-row counts.
3. Confirm production-specific policy/ACL differences; do not copy staging changes blindly.
4. Require CI and separate release approval.

## Additional policy findings
See \`docs/CONTENT_RIGHTS_AUDIT_20261105.md\` and \`docs/CERTIFICATE_PUBLIC_VERIFICATION_REVIEW_20261105.md\`.

Remaining external dependencies: verified operator identity/contact; qualified Ethiopian privacy/data-residency review; content licence/permission evidence; independent provider settlements and financial compliance review. None is satisfied by an engineering migration.
