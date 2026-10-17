# MELA role and information segregation implementation tracker

Date: 2026-10-17. Scope: learner app and read-only Supabase metadata; no schema or live data changes.

## Observed in repository and live schema
- 266 of 266 public database tables have row-level security enabled. This checks the flag **only**; does not prove policy correctness.
- Dedicated student, parent, teacher, company, mentor, guardian relationship and partner membership tables exist.
- Email and invitation sign-up currently present student, parent, teacher and company.
- Student education onboarding includes grade/stage/subject selection; teacher onboarding includes subjects, grade qualification and documents; company, parent and mentorship components exist.
- Authenticated administrative roles are excluded from the learner workspace. The separate admin dashboard remains its own app.
- Partner role exists in database, but was not routed to its own workspace.
- No evidence of functioning user-switchable multi-role accounts in this repo; do not claim support.

## In this PR (not yet live)
- Self-account overview for signed-in learner, parent, teacher, mentor, company and partner users, with status, language and role information.
- Explicit shared-feature and role-workspace catalogue that lists conditional requirements without granting privileges.
- Read-only partner workspace using only authenticated membership data.
- Mentor session interface hidden until verified active profile; backend RLS/RPC must still enforce this independently.
- Tests for account overview, role separation and excluded admin roles.

## Release blockers requiring additional work
1. Validate all actual policies on private records, guardian links, professional verification, partner tables and document storage using separate user test accounts. RLS enabled alone is insufficient.
2. Build and approve secure mentor and partner signup and role-specific setup; neither has a full public signup flow. Existing mentor accounts use a mentor profile; partner invitation and approval require integration.
3. Implement role additions and switching for existing accounts only through an independently authorized server workflow, not user-editable metadata.
4. Give parents, teachers, mentors, companies and partners edit/review flows for their own profiles, without silently changing qualification or verification status.
5. Complete backend age/consent eligibility, subject/grade enforcement and tests for private child data; validate notifications and language translations for all sections.
6. Verify every feature end-to-end in staging and on Android, and only then release. **mela-staging** was INACTIVE when checked; production was ACTIVE_HEALTHY. Do not push untested DDL to production.
7. Payment/escrow and cash rewards remain deferred.

## Verification grid
Test as: incomplete student, completed child student, adult student, pending teacher, verified teacher, unverified mentor, verified mentor, pending employer, verified employer, parent with and without approved child link, partner with and without active organization membership, admin, super_admin.
For each: registration, login, profile save/reopen, dashboard navigation, own-record reads, other-user reads, file access, actions, re-login and mobile install. Verify denial from server and not just hidden UI.

This tracking document is not a claim of launch readiness.
