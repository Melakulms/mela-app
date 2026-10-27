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

## 2026-10-27: emergency mentor safeguarding suspension (staging)

- `public.suspend_mentorship_mentor` uses an INVOKER wrapper around a private function that requires an authenticated MFA AAL2 administrator, a verified active mentor, and a 20–2000 character case reason. Self-suspension by the reviewer is denied. It deliberately provides no unreviewed self-reactivation path.
- On successful suspension, the function deactivates the mentor, cancels their *future* scheduled sessions, declines pending mentorship requests, closes their published supervised groups, notifies the mentor and writes an audit event with affected counts. Updates are transactional; if any step fails, the suspension rolls back.
- Central Admin PR #65 now provides a safeguard panel with explicit confirmation and case reason, including denial handling. No learner records or private documents are read by the summary.
- `supabase/tests/mentor_suspension_staging_smoke.sql` passed, proving missing identity/MFA cannot invoke the API. This is a rollback-only negative test; **real authorized admin action and its side effects remain untested** because staging has no approved mentors and registration is still disabled.
- Do not advertise full child safeguarding, real-time video moderation or reinstatement until independent testing completes.

## 2026-10-27 — Adult learner eligibility request and MFA review (staging)

- Root-cause audit: all 3 active university/TVET staging student accounts lack a recorded adult DOB and the required adult-work attestation. The `policy_documents` table is empty and the existing DOB triggers prohibit self-edits. These accounts cannot lawfully be treated as adult verified solely because their education stage is university/TVET.
- Added `mentorship_adult_age_reviews`, protected by RLS: adult university/TVET learners submit a private claimed Gregorian birth date plus explicit safeguarding acknowledgement. Learners cannot set approval status or alter a DOB after submission, and no private ID files or national IDs are stored here.
- Central Admin PR #65 includes a private reviewer queue with evidence checkbox and case notes. Only MFA AAL2 admin reviewers can approve; the server rechecks age, identity/eligibility, and updates the *existing protected* `student_profiles.date_of_birth` with an audit entry. A declared age alone is never enough.
- The internal `private.mentorship_adult_verified(uuid)` requires a matching admin-approved review and an adult DOB. The mentorship-specific audience helper, supervised group interest and adult student mentor application/final verification now use this consistent check; **the separate general-purpose `adult_work_eligibility` policy remains unchanged**.
- Learner panel displays pending/approved/declined status; 18+ claims are not automatically accepted. Grade 1–10 restrictions and grade 11–12 verified guardian clearance are unchanged. Existing beta signup restriction remains intact.
- Migration source: `20261027150000_mentorship_adult_age_review_staging.sql` and `20261027151500_mentorship_unified_adult_approval.sql`. Database smoke: `supabase/tests/mentorship_adult_eligibility_staging_smoke.sql` passed, rejecting anonymous age-review attempts, read access, and direct DOB edits. Client tests cover explicit consent and age restriction; Central Admin tests cover mandatory independent evidence.
- Real AAL2 admin approval, credential evaluation and signed-in adult learner/mentor flow **still require actual controlled test accounts**. Staging has no pending age review and no verified mentors. This is not a production release.

## 2026-10-27: Critical learner-assignment authorization fixes (staging)

- Identified and corrected three existing INSERT RLS policy bugs. Policies compared `r.mentor_id = r.mentor_id`, `a.mentor_id = a.mentor_id` or `s.assignment_id = s.assignment_id` instead of correlating each record with its actual mentorship relationship.
- Staging migration `20261027163000_mentorship_assignments_feedback_rls_correlation.sql` now enforces matched accepted request, verified active mentor, assigned learner, existing learner submission before feedback, and live guardian/adult eligibility at every assignment, submission and feedback write. Column-level INSERT grants disallow client-supplied IDs/timestamps.
- Staging `20261027164000_mentorship_live_room_shutdown.sql` blocks arbitrary meeting URL, video room, and recording references until MELA has an approved live-session safeguarding design.
- Staging `20261027165500_mentorship_suspended_mentor_private_read_revocation.sql` disallows suspended/unverified mentors reading learner request, session, rating, assignment, submission and feedback details; users still see their own data. Authorized admin access to sensitive requests/sessions now requires MFA AAL2.
- Learner and mentor wording now correctly says accepted mentorship **does not** automatically schedule a session; scheduling remains a separately confirmed action.
- Rollback-only staging smoke tests passed:
  - `supabase/tests/mentorship_learning_relationship_security_staging.sql`
  - `supabase/tests/mentorship_live_room_shutdown_staging.sql`
  - `supabase/tests/mentorship_suspended_mentor_read_staging.sql`
  - `supabase/tests/mentorship_cross_actor_spoof_staging.sql`
- Negative JWT probes are simulated role tests, **not actual authenticated two-account journeys**. Staging still has no verified mentors, requests, sessions or assignments. No production permissions or deployments were modified. Do not merge PR #96 before authentic E2E, guardian verification and privacy tests.

## 2026-10-27 — detailed scheduling and role-eligibility audit (staging)

### Confirmed defects corrected

1. **Overlapping calendar appointments.** Confirmed bookings previously did not check conflicting sessions. `20261027171000_mentorship_double_booking_guard.sql` adds a database trigger that serializes both participants' bookings using deterministic profile row locks and rejects any overlapping existing scheduled mentor/learner session. This also validates active mentor account and reasonable time/duration bounds.
2. **Published hours not enforced.** The weekly mentor availability editor did not restrict actual confirmed appointments. `20261027172000_mentorship_availability_schedule_enforcement.sql` now requires the complete appointment to fit within an active weekly window in the mentor's chosen time zone (including matching weekday and local date).
3. **Inconsistent/forged weekly availability.** `20261027173500_mentor_weekly_availability_integrity.sql` prevents unauthorized hours, invalid IANA time zones, overlap within one weekly zone/day and edits of original slot identifiers or creator timestamps. The insert/update is serialized against the verified mentor profile to reduce concurrent duplicate-slot risk.
4. **Wrong learner access controls.** Learner UI now fails closed with missing/unrecognized education stage and no longer invites Grades 11–12 to apply as adult mentors. Eligible adult university/TVET mentor applications appear only after independent age approval.
5. **Unclear calendar UI.** The learner and mentor screens now explain that published availability is required, timezone-specific, and protected against overlapping bookings.

### Verified tests
- `supabase/tests/mentorship_double_booking_staging.sql`: PASS. Verifies trigger installation, private grant, scheduling window boundaries and unauthorized direct scheduling rejection (not real two-account race).
- `supabase/tests/mentorship_availability_schedule_staging.sql`: PASS. Tests Addis Ababa timezone/calendar calculation and exercises availability trigger on a rollback-only temporary table.
- `supabase/tests/mentor_weekly_availability_integrity_staging.sql`: PASS. Tests invalid timezone, unverified mentor and identity forgery denials on a rollback-only temporary table.
- GitHub learner test suite includes regression cases for missing education stage and school-stage adult application visibility.
- Staging confirmed all 3 new guards installed, private and enabled. Security advisor showed no mentorship-specific finding for these objects. Existing unrelated project-level warnings remain.
- Staging checked after changes: 0 verified mentors, 0 requests, 0 sessions, 0 weekly slots, 0 assignments, 0 learner responses, 0 feedback, 0 age reviews and 0 mentor applications. SQL tests left no persistent records.

### Unverified and still blocking release
- No signed-in real mentor/learner booking, no genuine concurrent requests to prove race behavior, and no real weekly calendar fixture with an approved mentor. All validations are database/logic smoke tests plus frontend automated tests.
- No in-app video or approved real-time supervision, no complete age/guardian verification journey and no production migration.
- Do not present these development changes as production-deployed or a complete safeguarding certification. Both PRs remain draft; production database and payments are untouched.

## 2026-10-27: acceptance, completion and clearance audit

### Confirmed defects and fixes applied to STAGING only

- **Accepting a preferred-time request failed:** legacy `private.process_mentorship_request_status` auto-inserted a session and unapproved `call_room_id`, conflicting with the newer approved-weekly-hours and blocked-video-room triggers. `20261027174500_mentorship_acceptance_no_auto_booking.sql` removes that auto-booking; accepted requests now notify both parties to book separately. Removed duplicate RPC notifications for accept/decline/cancel; the database AFTER UPDATE trigger is the single status-notification source.
- **Premature or ineligible session completion:** previously a mentor could complete as soon as a scheduled session started, even if it had not ended or current safeguarding access had been revoked. `20261027175000_mentorship_completion_clearance_and_duration.sql` requires the full scheduled duration to have elapsed, an active verified mentor, an accepted request, a currently eligible active student, current guardian/adult clearance and an authorized mentor or MFA AAL2 admin; completion notes are capped at 2,000 characters.
- **Frontend eligibility could be stale or missing:** `20261027175500_my_mentorship_access_status.sql` adds a self-only secure eligibility status RPC that discloses neither guardian identities nor birth dates. Learner pages call it before enabling direct requests, including for Grade 11–12 guardian verification; failed verification remains closed. Adult mentor-intake visibility also uses current server clearance.
- **Misleading booking copy:** the empty sessions state now explicitly says accepted request ≠ confirmed appointment.

### Test evidence and limitations

- `supabase/tests/mentorship_acceptance_completion_staging.sql` PASSED on staging: inspects installed function bodies for no automatic room/session creation, single status-notification source, current eligibility/full-duration checks and denied completion without an authenticated identity.
- `supabase/tests/mentorship_self_access_status_staging.sql` PASSED: checks anonymous denial, self-only authenticated access and absence of exposed age/guardian identity fields, with rollback-only missing-JWT rejection.
- Expanded `tests/mentorship.test.tsx` for guardian denial and fail-closed eligibility errors. All **five learner GitHub checks** passed on the latest tested commit before this documentation update.
- Staging post-change reads still show **0 verified mentors, 0 requests, 0 sessions, 0 age reviews, 0 groups, 0 assignments, 0 submissions, 0 feedback**. No production writes, real users, payments or unapproved media were created.
- **Still NOT verified:** real signed-in mentor+learner E2E accept/schedule/complete, proper guardian and AAL2 admin verification, concurrent scheduling race test, real notifications, moderated media, and production launch readiness. SQL structural and simulated-JWT checks are not substitutes for signed-in tests.

## 2026-10-27 — integrated learner and administrator recovery audit

This pass fixes the shared feature branch; it is **not a production release**.

- Fixed malformed JSX that prevented the learner app from compiling. Session preparation and the newly added outcome-review panel now render independently of the empty-session message, so learners who actually have sessions can use them.
- Private preparation reads now fail closed with a retry action. Failed writes retain drafts; zero-row updates cannot report success. Added seven session recovery/authentication UI cases and preserved the existing session/outcome tests.
- Added learner and mentor `.ics` downloads for future confirmed appointments. UTC instants preserve timezone conversion; private notes, names, discussion topics and room references are excluded. Calendar copies explicitly do not auto-sync cancellations.
- Mentor workspace keeps a current booking ahead of old cancelled history, and completion stays disabled until the full duration has elapsed. Invalid durations fail closed. The server remains authoritative.
- Failed learner/mentor workspace refreshes no longer leave previously loaded private actions visible. Home describes the bounded directory count as mentors loaded.
- Companion Central Admin changes prevent delayed confidential history responses from appearing under another selected safeguarding case. Refresh clears cached applications, age-review details, final-verification selections, group data and suspension selections.

Validation on the integrated sources: learner **401 tests across 80 files passed** and TypeScript/Vite build passed; admin **391 tests across 45 files passed** and TypeScript/Vite build passed. Calendar privacy/time conversion and stale case-response regressions are included. A local Chromium download failed, so this pass does not claim browser/mobile verification. Existing learner bundle-size warning remains.

Read-only staging check during this pass: **0 verified active mentors, 0 requests, 0 sessions**. No database mutations were made in this pass. Existing migration checks and mock-based tests are not signed-in acceptance tests.

### Remaining work across the 16-section scope

Sections 1–7, 9–11 and 14 have connected development tools, with genuine account and permission acceptance still outstanding. Section 8 has no approved integrated call provider or supervised live delivery. Section 12 now includes the shared branch's learner outcome claims and mentor review, but this does not issue an independently verified Career Passport credential. Section 13 has program/interest administration but no delivered group meetings or verified attendance. Sections 15–16 have reporting, review and suspension tools, but real guardian/admin MFA journeys remain unverified. Translation and content review are also incomplete.

Keep the learner and admin PRs draft until approved mentor/learner/admin/guardian journeys, live-delivery design, group delivery/attendance, independent credential handling and mobile acceptance are complete. No claim of all 16 sections being finished or live is warranted.
