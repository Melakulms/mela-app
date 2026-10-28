# MELA Mentorship Section 2 — security review / release gate (2026-10-28)

Environment: **STAGING only**, Supabase `tungqfmypuwzeyrtaseh`. Production MUST NOT be changed through this review.

## Verified on connected staging

- No verified and active mentor profiles; no mentorship requests or sessions.
- `public.mentorship_session_note_drafts` and `public.publish_mentorship_session_notes(uuid)` do **not** exist. The supplied 20-file patch has not been applied.
- Existing `private.complete_mentorship_session(uuid,text)` and `private.notify_mentorship_session_change()` exist and match the pre-Section-2 baseline in the supplied patch.
- Removed dormant `Mentorship sessions update by participants` UPDATE policy on staging. Verified the policy is absent, SELECT policy remains, `authenticated` still lacks table UPDATE, and completion RPC exists.

## Blockers to bringing the supplied patch into the branch

1. **Published text can be stale or absent.** `MentorNotesEditor.tsx` lets the user edit `body` and click Publish but calls only `publishNotes(sessionId)`; the server consumes the *last saved draft*, not `body`. Fix by requiring/performing a successful private-draft save of the exact visible text before publish. Ensure a double click or failure cannot publish a prior version. Prefer one guarded server RPC that saves and publishes atomically with an expected revision if concurrent editors are supported.
2. **AAL1 mentor cannot load editor as coded.** `getNotesDraft(sessionId)` runs on mount before the MFA gate even though the private RPC requires `aal2`. Gate the fetch and show a clear onboarding/step-up UI before requesting private notes. Do not surface the database error as a generic notes error.
3. **Structural test calls wrong function.** `supabase/tests/mentorship_section2_staging.sql` checks `public.update_mentorship_session_notes(uuid,text)` and its `private` counterpart. The proposed patch creates `get_mentorship_notes_draft`, `save_mentorship_notes_draft` and `publish_mentorship_session_notes` instead. This test would fail with function-not-found. Replace with checks for the exact three new signatures and verify anon denial/authenticated execute privileges.
4. **No request writer stores timezone.** SQL adds `preferred_timezone`, but the supplied frontend changes do not populate it. Connect the request creation form to a validated IANA value, handle missing device zone, preserve UTC appointment storage, and clearly show unset zones for old requests.
5. **Not ready for live participant acceptance.** Create authorized staging-only verified mentor and learner accounts through the normal identity and age/guardian review path, enroll real TOTP, and run signed-in flows for draft/privacy/notification preferences, accept/schedule/complete and Android navigation. Never fabricate approvals or bypass guardian checks.
6. **Migration/rollback verification** must run against the current staging definitions before applying: privilege inventory, function definitions, trigger diff, guard behavior, no direct writable notes, success with real AAL2 and denial under AAL1.
7. **Keep all production deployments, payment collection and real users unchanged.** Do not count stubs or mocked JWT claims as a successful real Auth E2E test.

## Acceptance checks

- Visible text at confirmation equals text the learner sees after publication.
- Unpublished drafts stay private; AAL1, anon, unrelated mentors and unapproved mentors cannot access or publish.
- No notice on Save Draft, and exactly one notice per meaningful published revision when preferences permit; completion notices are not duplicated.
- Suspended account and guardian/adult clearance checks fail closed.
- Draft rollback refuses data loss; migration and rollback are reproducible.
- Latest staging Vercel build points to a commit containing all required files, and genuine Android sign-ins work.

The policy fix is independent; it **does not** complete or install the notes workflow. Keep the Section 2 feature unshipped until the blockers are addressed.
