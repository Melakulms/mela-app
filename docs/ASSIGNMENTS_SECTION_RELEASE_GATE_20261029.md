# MELA Mentorship — Section 11 Assignments release gate
Date: 2026-10-29

## Scope and live status
This ledger covers **Mentorship Section 11** only, not educator question-review assignments or general classroom assignments.
It is a release audit, not a declaration of production readiness.

| Operation | Draft foundation (PR #96) | Follow-up change (PR #111) | Validated live? |
|---|---|---|---|
| Verified mentor creates a task for accepted learner | Implemented | Unchanged | NO: zero staging accepted pairs |
| Learner submits one answer | Implemented | Unchanged | NO authenticated E2E |
| Mentor provides constructive feedback only after actual submission | Implemented, database guarded | Unchanged | NO authenticated E2E |
| Follow-up revision exercise after review | Previously missing | Prepares a **new** task; mentor explicitly saves | Test pending |
| Original response/feedback retained | Insert-only grants, one per task | No mutation to originals | Structural DB checks only |
| Rubric scoring/independent credential verification | Not implemented | Not implemented | NO |
| Attachment uploads/offline synchronization | Not implemented | Not implemented | NO |
| Paid mentoring or certificates | Disabled | Unchanged | Must remain OFF |

## Verified database inspection (2026-10-29)
- **Staging** Supabase project `tungqfmypuwzeyrtaseh` contains `mentorship_assignments`, `mentorship_submissions`, and `mentorship_feedback`.
- All three have RLS enabled; none grant anonymous SELECT or INSERT; all three have enabled write-guard triggers. Authenticated clients cannot set generated assignment IDs, submission IDs, or feedback timestamps.
- Staging counts at inspection: 0 assigned tasks; 0 submissions; 0 feedback; 0 accepted mentorship requests; 0 verified active mentors. Do not fake real identity proofs, accepted requests, approved guardians or TOTP factors.
- **Production** Supabase project `duizgtmbptmlbyipreqg` has **none** of the three tables. Never deploy the staging foundation migration wholesale: staging and production have independently evolved; reconcile migration history and dependent private functions/triggers first.
- Production has existing data; take a verified backup and test non-destructive reconciliation and rollback with those existing relationships before any production DDL.
- Payment collection must remain OFF in every environment.

## Acceptance before production
1. Run CI against exact PR #111 head: locked install, assignment regression tests, TypeScript and production build; record commit/check IDs.
2. Run schema/column-grant/trigger and cross-account rejection tests in staging with **real signed-in** learner, verified mentor, suspended mentor, guardian, and MFA administrator. No seeded identity approval as a substitute.
3. Verify assignment creation, due dates and timezone handling, learner response, mentor feedback, follow-up revision task creation, and original response retained. Retry/duplicate and account-switch tests are required.
4. Verify mobile Android/PWA flows, accessible form labels, and a deployment linked to the *same* tested Git commit.
5. Produce and review a production-specific, additive schema reconciliation plan with forward/rollback SQL; evaluate RLS, dependencies, sensitive data, and no future payment activation. Production currently lacks these tables.
6. Release to a protected preview, run real E2E, and only then approve the exact build for production, confirming routes and login do not regress. A GitHub PR or passing mocked tests alone cannot satisfy this gate.
7. Post-release read-only checks: live frontend commit, permissions, non-error counts, production route and Android owner smoke. Keep submissions/feedback private and do not manufacture reviews or awards.

## Deployment blocker
The connected Vercel API returned HTTP 403 on creating a preview of PR #111 on the explicitly scoped `mela-staging` project. CLI is not available in the current execution environment. No preview or production deployment is claimed. PR #111 is intentionally draft and targets PR #96's feature branch, not `main`.

## Intended user experience
Mentor selects an accepted request, creates a task with optional deadline. Learner submits an original response. Mentor reads that response and records specific feedback. After feedback, a mentor can prepare a **new, editable follow-up revision task** with the earlier feedback as context; it is not sent until the mentor explicitly assigns it. The first response and feedback remain available and unchanged. This is not a versioned resubmission on the same assignment, a scored evaluation, or an officially certified outcome.
