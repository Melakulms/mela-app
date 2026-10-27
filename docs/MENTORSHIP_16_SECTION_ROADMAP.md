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
| 6 | Mentorship Requests | Existing send/cancel requests UI & DB functions | Existing staging INSERT privilege currently missing; need least-privilege security fix |
| 7 | Booking & Scheduling | Existing session calendar and mentor schedule/cancel/complete | Existing lifecycle RPC execution grants missing; authenticated integration test required |
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
2. Existing mentorship_requests INSERT privilege and session RPC EXECUTE privileges are absent on staging. Do not blindly widen grants: first strengthen adult/guardian checks, review SECURITY DEFINER function paths and run cross-user negative tests.
3. Group program enrollment and direct audio/video are **not implemented or open**.
4. Mentor applications reviewed as eligible do not automatically create verified mentor profiles. Admin must independently validate credentials and safeguarding.
5. Verify GitHub CI for both PR head commits. Then test real staging sign-in, controlled verification, request, session, assignment and feedback paths using approved test accounts before any production rollout.
6. Independent privacy, safeguarding, moderation, age and production deployment reviews remain required.
