# MELA Mentorship Section 2: Implementation Handoff (PR #98)

**GitHub:** https://github.com/Melakulms/mela-app/pull/98
**Head branch:** `work/mentorship-section2-recovery-20261028`
**Base:** `feature/mentorship-foundation-20261027`
**Environment:** STAGING ONLY `tungqfmypuwzeyrtaseh`; production is out of scope.
**Status:** Draft / not deployed; payment collection unchanged.

## Purpose

Claude's environment has read-only GitHub access and the original 20-file
patch from the ChatGPT discussion was not in the repository. This branch
contains a new, corrected implementation of the primary Section 2 flows.
It is **not** the original 20-file patch reproduced verbatim.

Use this branch directly via `git fetch origin work/mentorship-section2-recovery-20261028`.
You do not need a GitHub credential to read a public branch. To request
updates when push access is unavailable, produce a unified diff and ask the
repo owner/connected ChatGPT GitHub tool to commit it, without putting tokens
in chat. Do not claim tests were run unless they actually were.

## Implemented

- `src/lib/mentor-mfa.ts`: AAL, TOTP enrollment, challenge, step-up and restart.
- `src/components/MentorMfaGate.tsx`: QR/manual enrollment and cancel UI.
- `src/components/MentorNotesEditor.tsx`: server MFA gate **before** draft fetch,
  draft save, exact-visible-body publish, optimistic revision, logout clearing.
- `src/lib/mentorship-notes.ts`: draft/save/publish RPC contract.
- `src/components/MentorLifecycle.tsx`: session note editor and gated completion.
- `src/lib/mentorship.ts` + `src/pages/Mentorship.tsx`: IANA timezone
  preference on new request, with UTC instant unchanged.
- `supabase/staging-only/section2_notes_mfa_REVIEW.sql`: draft, RPCs, AAL2,
  ownership/guardian, preferences, redacted audit, revised completion.
- `supabase/staging-only/section2_timezone_REVIEW.sql`: zone storage and trigger.
- `supabase/staging-only/section2_*REVIEW.down.sql`: guarded down scripts.
- `supabase/staging-only/section2_security_checks_REVIEW.sql`: after-apply checks.
- `tests/mentor-section2-*.test.*`: primary publication and UI guard contract.

All SQL files are **deliberately outside** `supabase/migrations` to prevent
automatic deployment to production.

## Verification already performed by connected ChatGPT

- Supabase STAGING: both draft SQL files executed inside `BEGIN ... ROLLBACK`
  successfully against the current schema; afterward, draft table and publish
  RPC were confirmed absent (not persisted).
- A second staging transaction ran forward SQL plus structural security checks,
  then rolled back, without a persistent table.
- A third transaction executed forwards plus guarded down scripts and rolled
  back; no persistent draft table was left.
- These were **transactional schema checks**, not local 39/39 behavioral checks,
  not real Supabase signed-in AAL1/AAL2 tests, not mobile testing.
- The initial base branch's 193 passing mentorship tests are reported by Claude
  and **do not test this PR**.
- No TypeScript/Vitest/Vite build success has yet been verified for this branch.
- Zero verified active mentor profiles and zero mentorship sessions in staging.

## Required before releasing to staging

1. Run `npm ci`, `npx tsc --noEmit`, `npx vitest run`, `npm run build`.
   Fix any new test/API contract failures and report real counts.
2. Run a real local PostgreSQL migration + rollback test, including data-loss
   guards with occupied draft/revision rows and a diff of all changed functions
   and table grants. Run negative cases for anon, AAL1, other mentor, suspended
   accounts, a learner lacking guardian/adult clearance and old note revisions.
3. Confirm new public security-definer wrapper owners and EXECUTE privileges.
   Private functions should not be directly executable by authenticated/anon;
   no PUBLIC EXECUTE default should remain.
4. Audit `complete_mentorship_session` and notifications against the actual
   live definitions to preserve all preexisting functionality.
5. Build secure lost-TOTP recovery through separately verified admin approval,
   independent evidence, audit, rate limits and notification. Do not bypass MFA.
6. Acquire authorized staging test identities/invites through existing admin
   policy. No fabricated accounts, fake guardian review or copied live users.
7. After explicit stage release gate, apply reviewed migrations only to
   staging, deploy matched frontend to staging, verify authentic two-account
   journey on Android. Do not deploy or enable payments in production.

Keep PR #96 and PR #97 intact, with no merge into main/production until
all required acceptance checks are completed.
