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
| 13 | Group Mentorship | Staging supervised program drafts/publishing, adult-only interest requests/withdrawals, MFA-admin approval and capacity checks; no groups invented | Real MFA administration, verified mentors, real adult learner E2E; supervised meetings and attendance still unavailable |
| 14 | Mentor Workspace | Existing requests/session management, new availability editor & assignment forms | Mentor applicant-to-verification & full calendar testing |
| 15 | Guardian/Safety | Safety entry point and existing restriction notices; new assignment RLS ties work to accepted relationships | Guardian and abuse-report end-to-end checks, explicit 11–12 eligibility validation |
| 16 | Administration | MFA-protected mentor intake queue, overview counts, supervised program drafts and group interest approvals in Central Admin PR #65 | Real admin login/MFA browser tests, mentor credential validation and complete safeguarding cases |

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

## 2026-10-27 supervised group mentoring extension

- Staging migration `20261027123000_mentorship_supervised_groups_staging.sql` added `mentorship_group_interests` (RLS). Adults in approved university/TVET stages with age record and adult-work attestation can request interest in future published groups led by active verified mentors; records start as pending.
- MFA-verified admins can create **draft** group programs, publish only with a verified active facilitator and future date, and approve/decline interest. Approvals are serialized against the group row so seat limits cannot be bypassed by concurrent approvals; changes are audited. Learners cannot approve themselves, and cannot read other learners' enrollment records.
- `20261027124500_mentorship_group_program_integrity.sql` prevents reducing group capacity below approved enrollments and changing facilitators for existing approved groups; records audit events.
- `20261027125500_mentorship_group_review_revalidation.sql` rechecks adult eligibility and future program status at interest submission and approval; expired programs do not accept new requests.
- The learner app presents approved programs without fabricating meetings; eligible adults can request/withdraw *pending* interest. Central Admin adds supervised program creation/publication and interest review to its MFA-protected section.
- `supabase/tests/mentorship_groups_staging_smoke.sql` passed on staging with rollback-only simulated denied-action checks. The test cannot prove real login/guardian safeguarding because staging registrations are currently disabled and no approved test mentors exist.
- **NOT YET BUILT:** real supervised voice/video, enrollment attendance, group messaging, guardian-enabled groups, automatic certificates or Career Passport grants. No production deployment.

## 2026-10-27: final mentor credential verification (staging)

- Added the missing last stage after mentor application eligibility review: `public.finalize_mentorship_verification` is an INVOKER wrapper around a non-exposed private, MFA-restricted implementation. The finalizer requires an already `reviewed_eligible` application, an active eligible account, an administrator who is not the applicant, explicit safeguarding/credential confirmation, 50–2000 characters of independent review detail and **at least one previously independently verified** profile document, education, professional experience or approved teacher record.
- The finalized profile's public headline, biography, expertise and languages come from the **reviewed application**, not from an unreviewed existing draft. Once verified, public profile changes require another MFA administrator review. All final decisions generate administrative audit events and use the existing role/mentor notification triggers.
- Verified teacher-mentors keep their teacher account role and receive mentor tools alongside teaching tools; verified adult student applicants follow MELA's pre-existing student → mentor role transition.
- New final review is surfaced in Central Admin PR #65. Learner applicant status now distinguishes `reviewed_eligible` from a truly verified active mentor.
- `supabase/tests/mentor_final_verification_staging_smoke.sql` passed; an authenticated database role with no signed-in AAL2 admin identity cannot finalize anyone. The private proof check has not yet been exercised with a real approved user and real credential, because staging new registrations are gated.
- **Important:** teacher-mentor age is reviewed by the administrator using verified qualifications and safeguarding evidence; the existing structured DOB helper is student-specific and is not a complete teacher identity age-verification solution. Finish the dedicated professional identity policy before general production rollout.
- Still **not production-ready**: real MFA administrator + verified teacher + adult learner authentication tests, verification-record review UX, background-check policy, real supervised communications, minor/guardian abuse-report flow and production release gate.
