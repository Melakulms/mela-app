# Phase 1 learner frontend baseline audit

Date: 2026-11-09
Base: main @ c3ed85509645d989ac4a0f93bbe13fb221247e31
Branch: phase-1/learner-repair-20261109

## Confirmed from source
- Login and registration are separate React screens; login reports mapped authentication and connection errors.
- Registration supports email and invitation modes, records age band and policy acceptance, and preserves the recovery-code flow.
- The registration screen currently exposes student, parent, teacher and company in the email-role selector. The production registration specification describes mentor and employer/partner onboarding as supported role journeys; role coverage must be reconciled before calling registration complete.
- Role-specific profile persistence uses the complete_my_profile_v37 RPC and then reads back profile completion and the role-specific table. This is a useful verification pattern.
- Profile save errors are sanitized and form entries are retained on failure.
- Frontend verification documentation explicitly says mocked browser fixtures do not verify live authentication, email delivery, database authorization or real saved answers.
- The registration specification explicitly states that a Telegram invitation code is not proof of verified email/phone, public users cannot self-register as administrators, and privileged permissions must be server-authorized.

## Phase 1 repair work
- Reproduce authenticated sign-in and registration using non-production accounts.
- Verify email confirmation and invitation registration without treating the invite code as contact verification.
- Verify role coverage and independent profile completion/review states.
- Verify profile draft persistence, refresh/resume and failure recovery.
- Verify student grade/curriculum segregation at both UI and server query boundaries.
- Verify Android navigation, route refresh/history and all primary dashboard destinations.

## Release safety
- Do not change production Supabase, production records, RLS, Auth settings, payment flags or payout settings in this phase.
- Do not add public administrator registration or client-side privilege elevation.
- Mark a workflow verified only with live staging evidence and a recorded test result.
