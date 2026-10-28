# MELA Mentorship Section 2 — staging release and MFA recovery operation

**Status (2026-10-28): CODE COMPLETE IN DRAFT PR #98; NOT RELEASED.**
Companion admin draft: `Melakulms/Mela-central-dashboard-` PR #68.
Separate existing RPC privilege tightening: `Melakulms/mela-app` PR #99.

## Non-negotiable deployment sequence

1. Read Supabase staging function definitions and compare them to the
   `private.complete_mentorship_session` and
   `private.notify_mentorship_session_change` definitions in the
   `section2_notes_mfa_REVIEW.sql` forward migration.
2. Run database migrations in a disposable clone or transaction on STAGING,
   then structural permissions, draft/privacy, real callback/notification and
   rollback tests. Verify rollbacks with populated drafts, published revisions,
   recorded timezones, and approved MFA recovery cases (rollback must stop).
3. Verify `public.*` wrappers are the only Data API entry points for notes,
   `private.*` functions have no authenticated/anon execute grant, and
   the earlier unsafe participant UPDATE policy remains absent.
4. The existing three private RPC permission correction is independently
   proposed in PR #99, with its own real signed-in tests before rollout.
5. Obtain authorized verified mentor and learner staging accounts through
   standard signup, email verification, adult/guardian reviews, and mentor
   qualification review; **do not fabricate status changes**.
6. Enroll two distinct authorized staff with independent MFA authenticator
   factors. Use AAL2 at every staff action. Test AAL1 and AAL2 with signed Auth
   tokens rather than SQL-injected JWT claims. Verify notification preference.
7. Apply reviewed migrations ONLY to Supabase staging
   `tungqfmypuwzeyrtaseh`; deploy the matching learner/admin branch to
   isolated staging Vercel projects; deploy the server-side
   `mentor-mfa-recovery-execute` Edge function ONLY to staging.
8. Test Android: first and second authenticator enrollment, session drafts,
   visible-text publication, notes audit redaction, accepted requests,
   scheduling and cancellation, offline/online recovery, back navigation.
9. **No production release, service key in frontend, payment collection,
   forged users, guardian bypass or auto-reset.**

## Account recovery procedure

Preferred prevention: while signed in at AAL2, a mentor enrolls **a second
TOTP factor on an independent device**. Both are genuine Supabase-verified
factors. The gate lets the mentor select the backup. MELA does not create
single-use recovery codes.

When every authenticator is lost:

1. Mentor signs in with their primary credentials (AAL1) and selects
   **Request lost-device recovery**. Only their own `auth.uid()` can start
   a request, and repeat requests are rate-limited (one per 7 days).
2. Support conducts *out-of-band* identity proofing based on the established
   onboarding record. Do not accept password possession, knowledge of OTP
   codes, an unverified email alone, or a photograph submitted in chat as
   sufficient evidence.
3. Two **different** authorized MELA staff independently verify the person
   using independent evidence and record distinct case references. Both
   administrators must have signed JWTs with `aal2`. Neither may be the mentor.
4. A **24-hour cooling-off window** after the original request is enforced by
   the DB. The target mentor must remain active and verified, and the request
   must be no older than 14 days when claimed. All review, claim and completion
   transitions create `admin_audit_logs` entries without passwords, note
   text or identity document contents.
5. A verified staff executor triggers the **server-only** Edge function.
   Only that function uses the server service key to call Supabase
   `auth.admin.mfa.listFactors({ userId })` and
   `auth.admin.mfa.deleteFactor({ userId, id })`.
   The target is sourced from the DB-approved request, **not** from a browser
   user ID. Supabase invalidates Auth sessions when verified factors are removed.
6. The privileged finalize RPC refuses success if verified factors remain;
   the mentor must sign in again and enroll a new factor, and should then
   enroll a backup. A failure after partial factor removal leaves the
   request in `processing` for **manual security reconciliation**. It must
   never be reported as successful or automatically retried.
7. Staff should notify the mentor independently using a trusted previously
   recorded channel after successful reset and monitor account activity.

## Test evidence vs outstanding verification

- Connected staging schema compatibility: notes/timezone forward + structural
  checks + both rollback scripts executed inside explicit
  `BEGIN/ROLLBACK` transactions.
- Populated guard test: temporary session/request/draft/revision/timezone rows
  added inside a rolled-back transaction. Fixture creation used
  `SET LOCAL session_replication_role=replica` briefly to bypass relationship
  triggers; normal trigger mode was restored before guard assertions.
  Unpublished drafts, revision history and timezone rollback each blocked
  before explicit acknowledgement. Fixtures did not persist.
- MFA recovery forward/check/down tests also passed in a staging transaction.
  A temporary recovery request made the down script refuse to destroy audit
  history, and no request/table remained after rollback.
- These are **schema and rollback tests**, NOT signed-in client authorization,
  actual lost-device deletion, human identity proofing or Android tests.
- At last staging check: 3 Auth users, 0 enrolled MFA factors, 0 verified
  active mentor profiles and 0 mentorship sessions. Genuine multi-party
  enrollment/test must be authorized and performed through working Auth.
- Current release status: **DRAFT; DO NOT AUTO-APPLY OR DEPLOY**.
