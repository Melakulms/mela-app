# MELA Mentorship — phone testing and release gate (28 October 2026)

**Scope:** Learner staging only (Supabase `tungqfmypuwzeyrtaseh`); production remains unchanged. The development PR is #96 and MUST remain draft until real, authorized sign-in tests pass. Never activate payments, live unsupervised calls or automatic credentials for this verification.

## Changes in this continuation

1. Added an accessible, non-persistent, local practice worksheet to every one of the 16 learner subsections (`MentorshipPracticeLab.tsx`). These worksheets are not messages, approvals or database records.
2. Isolated verified-mentor directory, request history and session history loads using `Promise.allSettled` so one unavailable endpoint no longer hides the others. Errors are reported independently and retry is available. No failed read is shown as an empty authoritative history.
3. Removed unrelated learner-only resource/group queries from the verified mentor task workspace. Accepted-learner lookup errors no longer erase already loaded assignments; the assignment creation UI remains blocked without an accepted relationship.
4. Added regression coverage for independent loader outages, scope-limited workspace queries and all 16 practice tools.

## What phone testers can exercise on the current feature branch (once actually deployed)

| Area | Action | Pass condition |
|---|---|---|
| All 16 destinations | Open each card and return | Relevant panel and local practice worksheet appear; no blank view |
| Resources (#10) | Search guide title/category, open guide | Published content displays even with no verified mentors |
| My Mentorship (#9) | Save private goal, change status, refresh | Own record returns and no unrelated data is shown |
| Mentor discovery (#2–5) | Search/filters/compare | Only genuine verified, active profiles show |
| Requests (#6) | Submit / cancel | Requires approved learner eligibility and real verified mentor |
| Booking (#7) | Mentor confirms separately | Valid weekly hours, future date and overlap checks enforced |
| Assignments (#11) | Mentor assigns → learner answers → mentor reviews | Participant-specific RLS, one answer/review, progress counts |
| Group (#13) | Express interest / withdraw | Approved adult and real published group required |
| Safety (#15) | Submit own report and view own status | Confidential notes remain admin-only and MFA-protected |
| Mentor/Admin (#14/#16) | Use separate role workspace | Direct learner app cannot impersonate either role |

## Current evidence and blockers

- CI passed on the initial worksheet version and independently on later changes. Use the exact PR head commit's GitHub checks for final verification.
- Published staging Vercel bundle still does not contain the latest subsection UI: the publish-check fails, while the staging root HTTP check passes.
- The connected Vercel deployment tool returned HTTP 403 for both Preview and Production deployment attempts against **mela-staging**, including an explicit target. Do not route around deployment authorization, alter the production app, or claim the feature is publicly visible.
- Staging data verification on 28 October: zero verified mentors, requests, sessions and saved goals; six mentorship resources. Do not fabricate actors, sessions or identity evidence.
- Authenticated, real two-account mentor–learner journey, guardian consent, real admin MFA, scheduling concurrency, safeguarding moderation and real Android/PWA smoke tests are still required. Real video/audio and automatic credential awards are OFF.

## Safe tester sequence after permission is restored

1. Publish the PR head only to **staging** with the explicit staging publishable key and staging Supabase URL. Validate the release SHA and that no production Supabase host is present.
2. Open the staging learner app on Android; verify all 16 destinations, Resource Library (#10), local worksheets and independent error recovery.
3. With approved, genuinely verified adult/guardian/mentor/admin staging accounts, run invitation → acceptance → weekly availability → confirmed booking → completion → assignment → feedback and negative cross-account privacy checks.
4. Verify MFA-only admin reviews and real safety escalation before considering any production release.

**Release decision: NOT APPROVED for production or unrestricted beta.** Practice simulator is not an authenticated backend test.

## Additional Android and partial-outage work (28 October, later revision)

- Android/browser Back now uses validated `?view=mentorship&mentorship_section=1..16` navigation entries. Invalid/deep-linked IDs are ignored. Leaving Mentorship clears the subsection parameter. Authentication and role checks are unchanged; a URL parameter cannot unlock private data.
- Mentorship Home remains available when one of request or session history fails, but unavailable counts are explicitly labeled `Unavailable`, rather than deceptively showing a confirmed zero.
- When request or session history is unavailable, new mentor requests fail closed until Retry obtains real history, to prevent accidental duplicate requests.
- Only mounted subsections fetch their private safety report history, age review, or profile recommendations. Optional practice worksheets are collapsed, keeping real section controls first on phones.
- Tests include the full 1–16 URL range, invalid subsection parameters, Android Back restoration, history-failure request gating, and partial-dashboard unavailable-state labels.
- **Vercel:** permission was rechecked. The deployment listing operation now also returned HTTP 403; no deployment has been performed. GitHub CI green is NOT equivalent to published staging/production verification.

## Additional improvements — goal lifecycle, mentor reliability and category discovery

- **Mentor inbox** reads incoming requests and scheduled-session history independently. If sessions are unavailable, incoming requests remain visible but scheduling is disabled until the calendar can be checked; a failed request read is never labeled a truly empty inbox.
- **Goals (section 9)** have age-appropriate suggested starting plans that only fill the input form; the learner must explicitly save. Removing a goal requires a second confirmation and the database must report an actual deleted row before the UI claims success.
- **Home (section 1)** independently loads actual active `mentorship_goals` saved through section 9, alongside profile goals; goal titles can inform text-based mentor recommendations, without overriding verification and safeguarding restrictions.
- **Categories (section 3)** includes selectable guidance cards linking to actual filtered verified mentor profiles. Visible totals reflect **loaded** approved profiles only and are not presented as all mentors.
- **Assignments (section 11)** can be filtered by awaiting learner response, submitted/awaiting mentor feedback, and reviewed status. Assignment due times reject invalid or past dates before insertion.
- **Progress (section 12)** displays active goals, goals past their target dates, assignments requiring response, overdue assignments and tasks waiting on mentor feedback. Duplicate response/review rows never inflate task counts or completion percentages. These are activity indicators, not mastery scores or automatic certificates.
- Added regression tests for partial mentor inbox outages, action summary accuracy, saved-goal cross-section visibility, category filtering, confirmation before deletion and assignment-status filters.
- This remains a **DRAFT** PR. Real staging publishing is blocked by Vercel 403. Continue to require genuine signed-in role and MFA tests before live production.

## Additional learner tools — 28 October

- **Section 4, Mentor Profiles:** Compare up to three real, server-returned verified mentor profiles by published expertise, language, organization, experience, ratings and weekly availability. Unknown IDs are excluded; no credentials or session slots are invented. Comparison never grants permission.
- **Section 6, Mentorship Requests:** Track and filter pending, accepted and closed real requests. The counts reflect returned records and an accepted request is never described as a booked session. Session status messages are suppressed when the calendar service cannot be checked.
- **Section 9, My Mentorship:** Edit title, plan and target date of a saved private goal, with explicit Save and Discard. Failed saves preserve the editor draft for retry; the Supabase update includes both goal ID and signed-in learner ID and must return a row. Invalid dates and unauthenticated changes fail closed.
- Added React interaction tests and RLS-scoped API unit tests. Tests and builds must pass at the exact final PR head before staging validation.
- **No staging release** as of this revision; published bundle smoke is expected to fail while the older staging deployment stays in place. Production remains unchanged.

## Additional real subsection tools — final October 28 pass

- Section 4: multi-profile comparison uses only existing verified profiles from the directory, limited to three. Includes published language, expertise, experience, completed-session ratings, and weekly time windows. It does **not** approve a request, infer verified credentials or schedule a session.
- Section 5: an optional, unsaved goal-based matching form searches only the fetched verified directory; respects learner education stage, excludes pending/accepted requested mentors, and pauses matches if private request history cannot be checked. It is ordinary textual profile matching, not AI credentialing.
- Section 6: pending, accepted and closed request counters and filters; acceptance never equates to booking. A failed calendar query must never create a false unbooked status.
- Section 9: securely edit saved private goal title/plan/target date. Invalid calendar dates and empty/unauthorized update results fail; failed save keeps unsaved editor values for retry.
- Added component and integration tests for all four areas, including the three-profile cap, guardian gating, RLS-scoped goal edits, and matching exclusion on existing active requests.
- CI must pass at the exact PR head and published staging bundle must be updated. Public staging still serves older code; Vercel access was last checked as HTTP 403. Production has not been changed.

## October 28 follow-up — group interest, mentor hours, safety history and future bookings

- **Section 13 (Group Mentorship):** pending applications/withdrawals are disabled until authenticated group-interest history loads. A failed read is not interpreted as no membership; a failed/zero-row delete is not presented as a successful withdrawal. Retry status keeps the user on the relevant screen.
- **Mentor weekly availability:** an unreadable existing schedule blocks addition/removal, preventing stale checks from creating duplicate or overlapping windows. Old slots are cleared at refresh; responses from earlier reads cannot reappear after a newer refresh/unmount. Deletions require a returned row.
- **Section 15 (Safety):** private submitted-report history read failures are distinguished from a confirmed empty history, without preventing a separate new report to the existing moderated RPC. This remains **not an emergency hotline**.
- **Section 7 (Scheduling):** the mentor scheduler validates a future appointment in device-local time before calling the backend; server-side age, active verified mentor, published availability and overlap checks remain authoritative.
- Regression tests cover the above partial-outage behavior, zero-row deletes, recovery after retry, protection against stale availability, and future-time validation.
- No payments, mentor approvals, guardian privileges, public meeting links or production deployments were activated. Deployment permission and full signed-in role tests are still release blockers.

## Further subsection reliability and practical testing (28 October)

**Section 7 — Session preparation and reflection**
- Preparation and completed-session reflections use independent, authenticated reads. Failure in one endpoint no longer hides the other; each affected write is disabled until its own history can be verified.
- The selected session still must be a real scheduled or completed session. Unsent in-memory form values are preserved through retry, without storing private notes on an untrusted device or creating an offline server claim.
- Four optional guided starters are available for academic study, scholarship planning, career exploration and project review. Choosing a starter fills editable form inputs only; explicit learner submission is still required.
- New regression tests cover split-read failures, retry draft retention and no automatic writes from preparation starters.

**Section 12 — Learning outcomes and evidence**
- A failed personal outcomes read cannot be treated as a confirmed empty history. New learner claims and mentor evidence decisions are blocked until the authenticated records load, preventing misleading duplicate action paths.
- A separate administrator-verification read may fail while the user's actual claims still load. Existing claims remain visible; administrative verification is clearly marked unavailable and no approval or credential is invented.
- Regression tests cover fail-closed claim submission, pending load, duplicate-category rejection and independent verification-read failure.

This remains an unmerged development PR. Only source code and tests were changed; no staging or production deployment, payments, live calls, guardian privilege, administrator MFA or mentor verification state was activated. The published 16-section bundle check still requires an authorized staging deploy.

## Additional verified session-note write protection

- Updating an existing private preparation now scopes both the stored note identifier and current signed-in learner ID, in addition to Supabase RLS.
- New preparation and completed-session reflection inserts require a database-returned saved row before the learner sees a success message. Empty returned results are not treated as confirmation.
- Tests cover authenticated owner-scoped updates and zero-row insert responses, plus the unchanged no-certificate behavior.
- The latest GitHub CI revision remains authoritative for source quality. A passing source test does **not** imply that this version is deployed to the staging phone URL.

## October 28 — cross-section learning actions and persistence integrity

- **Resources (section 10)** now offers **Plan to study this guide** on each real published resource. Selecting it creates only an editable draft (goal title, practical next steps and optional target date); a real private row is written to `mentorship_goals` only after the learner explicitly selects **Save as my learning goal**. Failed writes keep the draft. A successful save offers **View saved learning goal** linking to section 9.
- **Progress (section 12)** provides direct one-tap navigation to private goals (section 9) and real assignments (section 11); mentor progress links to assignment review.
- **Goals, assignments, submissions and feedback:** inserts require a returned database record before success is announced; invalid goal calendar dates and overlong goal plans are rejected rather than silently truncated. A feedback row without a matching submitted assignment no longer inflates reviewed progress.
- **Learning evidence:** new outcome claims require database confirmation; mentor decisions are scoped to the signed-in mentor in the query as well as server-side policies. Failed writes preserve drafts.
- **Shared device safety:** learner/mentor mode changes clear private unsent draft state instead of carrying it into another role.
- Added regression tests for the genuine guide-to-goal flow, offline retry, role switching, navigation, calendar validation, authenticated write confirmations and accurate progress.

**Release criteria remain unchanged:** PR #96 stays DRAFT, no new staging or production publication is claimed. GitHub code checks are per-commit; verify them at the exact final head. Staging continues to publish an older bundle and the 16-section published-bundle smoke is expected to fail until an authorized Vercel deployment. No payments or real calls activated.

## Additional assignment workflow testing — October 28

- **Mentor assignments (section 11):** four optional editable starters for weekly study reflection, career research, official scholarship eligibility checking, and small portfolio projects. A starter fills the form but does not choose a learner or write anything. Assignment creation still requires an accepted mentorship request and an explicit submit.
- **Due dates:** reject a past or invalid device-local deadline before sending; the backend remains authoritative for access checks and accepted relationships.
- **Learner and mentor task lists:** offer newest, earliest-deadline and needs-attention ordering using persisted assignments and submissions. Past-due warnings only apply to tasks without a recorded learner response.
- **Constructive feedback:** mentors can insert a structure for observed evidence, one improvement and next action; every bracketed prompt must be replaced before the Send feedback action becomes enabled. No template feedback is automatically saved, and no ratings or credentials are invented.
- **Testing:** added independent React tests for an actual accepted learner, template-only draft behavior, future deadlines, failed-network retry preserving edits, task ordering, and blocking unedited feedback templates. An initial ordering-test selector included a nested "Learner response" label; corrected to select only direct assignment titles. Confirm the entire final PR head is green before changing the release gate.

No production release, mentor certification, live session, payment activation, or permission change was made. The public staging site still lacks the latest Mentorship bundle. The published-bundle smoke remains an unresolved deployment blocker.

## Section 6: structured programs and genuine requests (28 October)

- Section 6 now contains **Mentorship Programs & Requests**, retaining the real private pending/accepted/closed request tracker without inventing a confirmed mentor, booked session or enrollment.
- Learners can choose a **Starter (2 weeks), Standard (4 weeks), or Intensive (8 weeks)** self-guided track, with explicit weekly milestones for academic study, career exploration, scholarship preparation or practical projects. Grades 1–10 receive academic study only; Grades 11–12 and adults receive additional self-directed topic plans, without granting unrestricted mentor contact.
- Learners may append a short next step and optional date. **Save my personal program plan** writes only an authenticated private `mentorship_goals` row through the existing owner-scoped RLS-backed API, with database confirmation. Saved plans are shown with a self-reported status selector (planned, in progress, paused, completed). Duplicates within the readable history are blocked. If private history is unavailable, saving is disabled and a retry is offered.
- Learners can jump from the program planner to section 9 (edit private plan) and section 11 (real mentor assignments). Self-reported completion is not a verified achievement or certificate.
- New isolated tests cover eligibility and age-appropriate topics, 2/4/8-week milestone lists, persistence and error retry, client-side duplicate prevention, progress status updates and section navigation. The existing Mentorship UI test mocks the program planner so unrelated directory tests stay independent.
- **Limitations:** This is a saved learner planning feature, not an administrator-approved program catalog, institutional enrollment, mentor-assignment automation, or per-week independently verified outcomes. Production and staging deployment remain separate from source commits.

## October 28 — outcome and mentor safety account isolation

- Outcome claims, independent review results, learner drafts and mentor review notes now clear on session boundaries and learner/mentor mode changes. Late reads and save responses cannot restore old account state. A save still waiting for authentication stops before writing when its originating session changes.
- Mentor safety report targets clear and reload on the same session boundary; delayed participation reads cannot restore previous-account request topics or sessions.
- Validation: all 497 learner tests passed; TypeScript/Vite build passed. Five added regression cases cover stale outcome reads/saves, role changes, mentor target clearing and late mentor reads. These are component tests, not signed-in end-to-end verification.
- Current external checks: staging has zero mentor profiles and zero mentorship sessions. Connected Vercel team listing confirms the expected team, but project lookup for `mela-staging` returns 404 and the team's project search for `mela` returns no projects. No new deployment was performed.
- Remaining completion gates: authorized staging publication, legitimate verified test participants, authenticated learner/mentor/guardian/MFA workflows, supervised session delivery and independent credential validation. PR remains draft; production and payments unchanged.
