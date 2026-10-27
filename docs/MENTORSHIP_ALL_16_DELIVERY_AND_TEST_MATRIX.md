# MELA Mentorship — 16-section delivery, safeguards & acceptance matrix

**Environment:** STAGING `tungqfmypuwzeyrtaseh`; production `duizgtmbptmlbyipreqg` is READ-ONLY and unchanged.
**Development branches:** learner PR #96, Central Admin PR #65. **Neither may be merged or claimed production-ready until real signed-in testing passes.**
**Verification labels:** *implemented* means code + staging schema exist; *CI tested* means automated checks were run; *E2E unverified* means no real approved mentor/learner credentials and sessions were exercised.

| # | Section | Current implementation | Explicit remaining acceptance check |
|---|---|---|---|
| 1 | Mentorship Home | Personalized dashboard, actual goal/request/session counts, verified suggestions | Real learner session restore, Android navigation and authenticated data |
| 2 | Find a Mentor | Verified-only server results, mobile paging with Load more, real availability weekday filters | Verify scale with 51+ vetted mentor profiles, pagination while searching |
| 3 | Categories | Eight filterable guidance areas, no invented mentors | Independent category/content classification and complete translations |
| 4 | Mentor Profiles | Real verified profile text, languages, weekly hours, only actual learner ratings | Authentic professional evidence, privacy and reviewed profile updates |
| 5 | Smart Matching | Rule-based interests, keyword relevance and real rating/experience ordering; NOT automated eligibility | Test relevance on diverse verified mentors with guardian/adult server access |
| 6 | Mentorship Requests | Scoped create/cancel/accept/decline, acceptance sends notifications without auto-booking | Adult & guardian real sign-in; cross-account denials, repeated requests |
| 7 | Booking & Scheduling | Accepted-request booking, published timezone hours, overlap locking, 15–180 minute bounds | Genuine mentor/learner simultaneous booking race, UTC/local browser checks |
| 8 | Live Mentorship | Safe scheduled-session status and preparation guidance; unknown call rooms/recordings rejected | **Video/audio NOT ACTIVE**: select vetted provider, consent, moderation, emergency response and verified room access before launch |
| 9 | My Mentorship | Private goals and plans; request/session history & mentor follow-up | Sign-in/out restore, guardian restrictions and read-after-write on Android |
| 10 | Resource Library | Six originally authored staging guides with keyword and category search; unpublished content excluded | Expert editorial review, translated resources, learning-level validation |
| 11 | Assignments | Accepted-request mentor task, one learner submission, one mentor feedback, strict relationship RLS | Authenticated active mentor/adult/guardian E2E, suspension denial |
| 12 | Progress & Achievements | Activity counts and transparent reviewed-task percentage; self-reported goals clearly marked | **Certificates and Career Passport awards NOT LIVE**, need independent evidence approval and fraud controls |
| 13 | Group Mentorship | Adult-only interest, withdraw, MFA group review and published facilitator approval with capacity lock | Actual approved groups, concurrency, group attendance, moderated communications |
| 14 | Mentor Workspace | Verified-mentor request/session/availability/task workflow; verified teachers retain dual dashboard | Real onboarding, publishing hours, lifecycle sign-in and mobile task flow |
| 15 | Guardian & Safety | Guardian access RPC, adult age review, learner/mentor specific incident reports, confidential reporter status | Real verified guardian/child journey, safety escalation SLAs, external help procedures, confidential investigation checks |
| 16 | Central Admin | Mentor application and credential review, adult identity review, group review, oversight counts, emergency suspension, MFA report triage with private notes | Real AAL2 sessions, distinct reviewers, audit integrity and complete incident management |

## New safety/reporting and directory work
- `20261027183000_mentorship_safety_reporting_mfa.sql`: participant-bound learner/mentor concern reports; report IDs are returned only to the submitting user; reads are restricted to the reporter or MFA admin; case decisions require signed-in MFA AAL2 moderation.
- `20261027184500_mentorship_case_private_review_notes.sql`: store confidential investigation notes under unexposed `private` schema. Reporter-visible status is deliberately generic; historical notes require MFA AAL2 and are viewed from the admin panel.
- `src/components/MentorshipSafetyReporting.tsx` and `MentorshipMentorSafetyReporting.tsx`: submit incident reports tied to real approved mentors/owned interactions; clear emergency-help guidance; private status history. No made-up cases, emergency-response or automoderation claims.
- `src/components/MentorshipLearningWorkspace.tsx`: searchable and filterable published guidance; recorded assignment feedback percentage is an activity indicator, **not** a certificate.
- `src/lib/mentor-discovery.ts` and `src/pages/Mentorship.tsx`: weekday/availability/rating/experience filters with honest loaded-only result counts.
- `src/lib/mentorship.ts`: mobile-friendly paged verified mentor discovery, 50 loaded at a time, no hard global directory ceiling.

## Staging evidence (must be updated after actual signed-in validation)
- Rollback-only database negative tests: `supabase/tests/mentorship_safety_reporting_staging.sql`, `supabase/tests/mentorship_private_review_notes_staging.sql`, request/scheduling/assignment age+guardian tests. Passing these **does not** prove production behavior under signed Auth sessions.
- UI unit tests: `tests/mentorship-safety-reporting.test.tsx`, `tests/mentorship-directory-pagination.test.ts`, `tests/mentor-discovery.test.ts`, `tests/mentorship.test.tsx`.
- Admin UI tests: `tests/mentorship-safety-cases.test.tsx` in admin PR #65.
- All production writes, payment collection, artificial credential verification, public beta opening, live video and unsupervised child communications remain forbidden.

## Real signed-in release gate: not yet done
1. Invite or use **legitimate** controlled staging adults, verified teacher-mentor, a Grade 11–12 learner+verified guardian, MFA admin and unrelated observer without bypassing staging registration protections.
2. Verify a genuine applicant's identity/evidence with authorized administrator. Test applicant not visible before final approval; teacher role preserved.
3. Test own-only guardian/adult access and negative tests for minors, unrelated users and suspended mentors.
4. Mentor publishes time zone hours; adult student requests with preferred time; mentor accepts (does not book); schedules a separately confirmed time, rejects overlap and nonexistent hours; cancels/reschedules/completes after full duration.
5. Mentor assigns task; learner submits; mentor reviews; confirm submitted progress counts accurately and cannot issue a false Career Passport credential.
6. Submit mentorship safety report; read own status; MFA administrator reviews confidential case notes; check reporter cannot fetch internal notes; suspend mentor and verify task/session/incident access restriction.
7. Publish a genuine supervised group and test eligible adult interest, approval, capacity collision, withdrawal, expiration and audit log.
8. Test Android/PWA offline/online transitions, accessibility, Amharic and other approved language coverage, login/session recovery, audit logs and privacy.
9. Keep provider video **off** until it meets explicit child safety and consent requirements. No launch certification until those tests pass.

**Status:** All 16 sections have defined implementations or safe disabled-state behavior on development branches. They are **not all functionally complete or production-ready**.
