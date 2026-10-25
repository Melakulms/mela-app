# School enrollment and academic stream hardening — STAGING verification

## Scope and release gate

- Database modified only: Supabase **staging** project `tungqfmypuwzeyrtaseh`.
- Supabase **production** project `duizgtmbptmlbyipreqg` remains unchanged by this work.
- Learner-app changes are on `security/staging-school-enrollment-lock-20261025`; **not deployed to production**.
- Staging migrations applied: `school_subject_stream_integrity_v38_20261025` (20261025164200) and `allow_locked_stream_in_profile_upsert_v38_20261025` (20261025165012).
- No payment settings, teacher approvals, real learner rows or application entitlements were changed.

## Verified test outcomes

All scenarios used synthetic auth/profile/subject/program records in single transactions with a final `ROLLBACK` and did not persist test data.

1. Verified Grade 11 Natural Sciences profile: explicit first stream selection succeeded; profile completion saved the catalog's 11 Natural Sciences subjects.
2. Grades 11–12 stream switch after lock: blocked by the stream RPC.
3. Direct client UPDATE of `student_profiles.subjects`: permission denied.
4. Attempt to submit `history` (Social Sciences) via profile-completion RPC while assigned to Natural Sciences: rejected by database trigger.
5. Grade 11 question/material program access: Natural Sciences Biology allowed; Social Sciences History blocked.
6. Grade 12 Social Sciences profile completed with 11 corresponding subjects; the question assertion accepted the Social Sciences program and rejected Natural Sciences Biology.
7. Grade 1 enrollment completed with the valid common-stage catalog; unrelated out-of-grade subject submission rejected.
8. Verified `authenticated` role has no direct INSERT/DELETE or subject/stream UPDATE on student profiles; other student preferences cannot be inferred as writable from those two fields.
9. Confirmed zero synthetic auth users, profiles, or program rows remained.

The profile RPC needed a follow-up trigger fix: PostgreSQL executes INSERT triggers before `ON CONFLICT DO UPDATE`. The second migration preserves a previously locked stream for the upsert and still blocks an unauthorized stream change.

## Design controls

- Grade and school stage must match.
- Grades 1–10 use the common academic track.
- Grades 11–12 explicitly select Natural Sciences or Social Sciences; no default.
- The selected senior stream is locked for subsequent student RPC calls.
- Enrolled subjects must exist in the active school catalog for saved stage and stream, must be unique, and include mandatory subjects.
- Question access, material access, and the frontend all use the saved stream, not just the subject array.
- Existing incomplete production student rows must be reviewed, not silently cleared.

## Remaining release checks

- Confirm all GitHub PR checks green, including Vitest/TypeScript build and newly added stream onboarding tests.
- Deploy a staging learner app pointing only at staging before enabling senior-grade registration for external users.
- Perform a real staging Auth session acceptance test on Android, not only synthetic claims.
- Review and reconcile staging/production catalog differences and legacy school enrollment records.
- Apply the migrations to production **only after separate owner-approved production release and staged regression tests**.
