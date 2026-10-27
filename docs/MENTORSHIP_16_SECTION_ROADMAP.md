# MELA Mentorship — 16-section implementation & release gates

Date: 2026-10-27. Frontend work is in learner PR #96 (draft). Admin work is in Central Dashboard PR #65 (draft).
Database migrations were applied **only to staging** `tungqfmypuwzeyrtaseh`. Production `duizgtmbptmlbyipreqg` remains untouched; payments remain off.

## What each section actually contains

| # | Section | Implemented in feature branches | Remaining launch gates |
|---|---|---|---|
| 1 | Mentorship Home | Real counts, upcoming meeting, learner goals, suggested verified mentors, notifications and announcements | Authenticated staging journey + mobile verification |
| 2 | Find a Mentor | Search approved mentor profiles by keyword, expertise and language | Populate genuine verified mentors, verify search behavior |
| 3 | Categories | Eight descriptive guidance filters | Field review and translations |
| 4 | Mentor Profiles | Verified status filter, work, expertise, languages, ratings and available hours | Full professional proof review + mentor edit flow |
| 5 | Smart Matching | Rule-based interest matching, not eligibility determination | Matching evaluation + guardian and underage negative tests |
| 6 | Mentorship Requests | Existing send/cancel requests UI & DB functions | Staging INSERT repaired with per-column grants, private audience validation and stage restrictions; **authenticated learner E2E remains untested** |
| 7 | Booking & Scheduling | Existing session calendar and mentor schedule/cancel/complete | Staging lifecycle RPC grants repaired; acceptance and scheduling now re-check active verified mentors, guardian/adult clearance and participant/MFA authority. **Authenticated scheduling test still required** |
| 8 | Live Mentorship | Honest status and safety guidance | Approved call provider, moderation, explicit recording controls; **not live** |
| 9 | My Mentorship | New private goal plans and status updates; existing requests/session history | Adult/child role tests and read-after-write |
| 10 | Resources | Six original approved guide texts published on staging and read-only library | Expanded expert-reviewed references & localization |
| 11 | Assignments & Challenges | Verified mentor task assignment to accepted mentee, one learner response, one mentor feedback (staging tables/UI) | Verified mentor+adult learner authenticated end-to-end |
| 12 | Progress & Achievements | Real assignment submission/review counts and self-reported goal tracking | Independent evidence verification and Career Passport awarding **not live** |
| 13 | Group Mentorship | RLS-protected, admin-published group directory; no invented groups | Controlled enrolment, supervised communications, attendance; **no groups published** |
| 14 | Mentor Workspace | Existing requests/session management, new availability editor & assignment forms | Mentor applicant-to-verification & full calendar testing |
| 15 | Guardian/Safety | Safety entry point and existing restriction notices; new assignment RLS ties work to accepted relationships | Guardian and abuse-report end-to-end checks, explicit 11–12 eligibility validation |
| 16 | Administration | MFA-protected adult applicant intake review built in Central Admin PR #65 | Approve/verify full mentor profiles, credential checks, audit logs, authenticated MFA tests |

## New staging-only schema

- `mentorship_goals`: private learner goals, with own-account read/edit.
- `mentorship_assignments`: verified and active mentors can issue tasks only against accepted mentorship requests.
- `mentorship_submissions`: only assigned learners can respond; one response per task.
- `mentorship_feedback`: only verified and active mentors can respond to actual submitted assignments; one feedback per task.
- `mentorship_resources`: published approved resource guides; authenticated read-only.
- `mentorship_groups`: approved published directory only; no user enrollment is enabled.
- `mentorship_applications`: adult intake with student/adult or verified teacher profile eligibility; self-only read/submit; admin review requires authenticated MFA AAL2 and private.is_admin_user().

Every new exposed table has RLS enabled and an explicit policy. No ordinary-user insert/update grants exist on resources or groups. New tables were deployed on staging and are not yet present on production.

## Release blockers

1. Staging currently has zero approved mentor profiles, requests and sessions. This means no real mentor–learner journey was proven. Do not create fake listings.
2. Existing request/RPC permissions were repaired in *staging* using restrictive grants and DB trigger authorization. The rollback-only smoke test passes for missing-identity rejection. Cross-user and real guardian/adult E2E tests are **still required**.
3. Group program enrollment and direct audio/video are **not implemented or open**.
4. Mentor applications reviewed as eligible do not automatically create verified mentor profiles. Admin must independently validate credentials and safeguarding.
5. Verify GitHub CI for both PR head commits. Then test real staging sign-in, controlled verification, request, session, assignment and feedback paths using approved test accounts before any production rollout.
6. Independent privacy, safeguarding, moderation, age and production deployment reviews remain required.

## 2026-10-27 staging lifecycle hardening

- Applied migration `20261027110000_mentorship_staging_request_session_security.sql`: per-column INSERT on request fields (not full-table inserts), actor-owned request status RPC permissions, accepted-mentor check, adult/guardian clearance for request submission/acceptance and scheduling, 15–180 minute future schedule validation. The RPCs were already present; this restores narrowly scoped execution on staging only.
- Applied `20261027111500_mentorship_staging_actor_mfa_guard.sql`: database triggers require the actual mentor/learner participant or an admin with MFA AAL2 for privileged transitions; repeated pending requests for a pair rejected by a partial unique index.
- Executed `supabase/tests/mentorship_staging_security_smoke.sql` on staging: **passed** (grants and simulated missing-JWT negative paths, transaction rolled back). This does *not* prove real student sign-in, approved mentor provisioning, or a real session.
- Direct authenticated INSERT on mentorship_sessions remains revoked; anonymous mentorship RPC execution remains denied. No staged learner or mentor records were created by these tests.
- Still blocked for production: stage a real approved adult mentor and adult learner, verify guardian and teacher roles, cross-account denial, full session lifecycle, email notifications and mobile testing. No live deployment until gates pass.
