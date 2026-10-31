# MELA Mentorship production wave 2 — published guidance (applied October 29, 2026)

**Production project:** `duizgtmbptmlbyipreqg`
**Applied migration:** `mentorship_published_guidance_prod_20261029`

This is additive, educational-content-only migration. It does not open real
mentorship session scheduling, messaging, a payment gateway, MFA recovery or
mentor verification workflows.

## What has been installed
A new `public.mentorship_resources` table with published/draft/archive
statuses, an RLS SELECT policy allowing only `status='published'` rows to
signed-in users, no direct anonymous read or authenticated write privileges,
and six original learning/safety guides.

Guide topics: first mentor meeting, career exploration, scholarship
preparation, portfolio review, exam study planning, and safeguarding.

No personal data was copied or seeded; all six resources are original general
guidance. No fees or payment credentials are involved.

## Verification
The full forward SQL, permission/row-status checks and non-destructive
withdraw-access script passed in a `BEGIN ... ROLLBACK` transaction
on actual production before applying the migration.

Post-apply SQL verification:
- 6 published guides.
- `authenticated` has SELECT, not INSERT.
- `anon` has no SELECT.
- Existing production mentorship data preserved: 1 verified mentor, 1 session.

## Rollback
`supabase/production-review/mentorship_wave2_published_guidance_REVIEW.down.sql`
withdraws authenticated reading and drops the RLS SELECT policy but retains
content for retention/privacy review rather than deleting user-edited material.
It is a safe *access rollback*, not a destructive table/schema rollback.

## Remaining release gate
The learner production frontend does not automatically expose this table.
The 16-section Mentorship foundation PR #96 and Section 2 PR #98 are still
drafts and must not be indiscriminately promoted: production is missing
numerous staging tables/triggers and real authenticated mentor/MFA testing is
still outstanding. First resolve production Vercel environment ownership,
schema migration dependency order, genuine guardian protections and session
workflows. Never point production users to staging Supabase configuration.
Payment collection stays OFF.

The original 2026-10-27 mentorship expansion migration from PR #96 also
creates the same `mentorship_resources` table and SELECT policy. Skip or
adapt that portion during future production migrations; do not rerun it blindly.
