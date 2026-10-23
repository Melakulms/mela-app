# Adult learner staging journey — 23 October 2026

Target: https://mela-staging.vercel.app/ and Supabase `tungqfmypuwzeyrtaseh` only.
Production was not queried or changed. Payment settings were queried: collection remains disabled.

## Repairs applied

- Restored missing University and College / TVET reference rows and one explicitly synthetic test program for each.
- Restored authenticated execute access to the existing own-profile setup functions, free-course enrollment, and own-dashboard wrapper and its private implementation. Checked function bodies and existing RLS before granting access. No anonymous grant or administrative permissions.
- Updated the login instructions and removed school enrollment from the staging-only education selector. This remains an invited adult test, not general public registration.
- Reproducible SQL is adjacent to this report, deliberately outside automatic production migrations.

## Verified using real staging Auth and HTTP requests

- Single-use invitation registration: HTTP 200, account created, username correct, active student, email verification flag true.
- Password login: HTTP 200 with a real user session.
- University education setup and profile completion: HTTP 200; persisted subjects verified.
- Free synthetic course enrollment: HTTP 200.
- Both synthetic lessons readable; lesson completion writes: HTTP 201 each.
- Course enrollment reached 100% with completed_at set.
- Own dashboard: HTTP 200 after narrow permission repair.
- Reading other profiles with the learner session: HTTP 200, zero rows.
- University catalog visible to the authenticated learner.
- Sign-out returned HTTP 204; subsequent sign-in returned HTTP 200 and retained 100% course progress.
- Recovery-code password reset returned HTTP 200; old password rejected, new password login passed, old recovery code rejected after rotation.
- Three previously issued, unused invitations remain valid.
- Staging build and artifact isolation check passed; 11 targeted profile/registration tests passed.

These are live API integration checks, not a claim that the entire signed-in browser journey passed.
The public staging login page was inspected in a browser. Automated signed-in browser checks were not completed in this environment.

## Boundaries and remaining validation

- Teacher, parent, employer, mentor and admin signup journeys remain outside the currently enabled adult-student invitation flow.
- AI provider functionality, eight multiplayer Arena formats, mentorship booking, opportunity applications, full curriculum review, and all translations are not certified by this repair.
- The synthetic course is not accredited and must not be presented as approved educational content.
- Automatic approval review blocked a negative test that attempted a learner-to-admin role change. Do not claim that test passed. Read-only RLS and trigger inspection is not an equivalent end-to-end negative test.
- Security advisors retain existing warnings, including leaked-password protection disabled and intentionally exposed authenticated SECURITY DEFINER wrappers. Profile wrappers internally require the signed-in user and active verified account; no arbitrary target-user parameter is accepted.

## Tester path

1. Open staging and select Create an account.
2. Use an unused adult learner invitation, a fictional name and a new test-only password.
3. Save the recovery code privately.
4. Sign in with the beta username; choose Complete my profile.
5. Select University or College / TVET and STAGING TEST — Digital Learning Basics.
6. Open Skill Academy, enroll in STAGING QA ONLY — Digital Learning Basics, and complete both lessons.
7. Sign out and back in, then check saved progress.

Never use a production password, real student records, or payment details.
