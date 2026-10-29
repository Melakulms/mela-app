# MELA Mentorship production release gate — 2026-10-28

## Scope and status

**NOT APPROVED FOR PRODUCTION.** Owner requested progress toward a live release.
The isolated staging frontend preview is READY at:
https://mela-staging-c1ydo95pw-melakuanteneh1-gmailcoms-projects.vercel.app

The stable **STAGING ONLY** alias https://mela-staging.vercel.app was
intentionally reassigned and verified to resolve to the same READY deployment
(`dpl_DXrHktucoKrCv5U1rEXyJo2S7d3r`). This is not the production
domain and does not authorize production traffic to use staging credentials.

PR #96 (foundation, 126 changed files) and PR #98 (Section 2 additions) are
still DRAFT and based on separate branch layers. Admin recovery UI PR #68 is
STAGING-only. Existing RPC grant fix PR #99 differs between prod/staging.

## Verified deployment/database topology

- Staging Vercel project: `mela-staging`. The preview for PR #98 commit
  `8d407e57076c37088af49add79dc5ab3c6aa70d6` is READY and is **not**
  a production-domain assignment.
- Older Vercel project `mela-web` has a production deployment, but its
  source/targets are not established as the current learner app. Do not promote
  a staging-configured preview to it or any live domain.
- Supabase STAGING: `tungqfmypuwzeyrtaseh`.
- Supabase PRODUCTION: `duizgtmbptmlbyipreqg`.
- No payment collection has been enabled; do not enable it in this release.

## Already installed to staging after review

Four staging-only schema migrations were applied and checked:
1. `mentorship_section2_timezone_staging_20261028`
2. `mentorship_section2_notes_mfa_staging_20261028`
3. `mentorship_private_rpc_grants_staging_20261028`
4. `mentorship_section2_recovery_staging_20261028`

The server-side Edge Function `mentor-mfa-recovery-execute` was deployed on
STAGING, version 1, **verify_jwt=true**. Do not use it without real approved
administrator factors and the manual identity-verification procedure.

Structural checks passed:
- RLS on notes drafts; no direct authenticated SELECT on that table.
- No direct authenticated EXECUTE on private notes publish or on the three
  staging preexisting private session/request operations.
- Anonymous users have no notes publish or recovery queue execute privileges.
- The previously removed permissive participant UPDATE policy remains absent.
- Simulated AAL1 notes-read denial and simulated AAL2 nonparticipant
  publish denial were exercised inside a rolled-back transaction.
- Populated rollback guards for drafts, published revisions, request timezone
  and recovery audit cases passed. Test fixtures did not persist.

**Not yet passed:** real, signed Supabase Auth AAL1/AAL2/mentor/learner/admin
end-to-end tests, actual factor-deletion/re-enrollment recovery, or Android
manual acceptance. Staging has 0 enrolled MFA factors, 0 active verified
mentors and 0 mentorship sessions as last verified.

## Critical production schema differences (read-only inventory)

As of this check:
- Production: 5 public `mentor%/mentorship%` tables.
- Staging: 19 such tables (**14 staging-only**).
- Production has 24 matched public/private mentor functions; staging has 59
  (**35 staging-only function signatures**).
- Production has 12 mentorship-table triggers; staging has 39
  (**27 staging-only**).
- Production lacks `public.respond_mentorship_request_with_reason` and
  its private implementation, used by the PR #98 mentor workflow.
- Production also lacks `mentorship_session_note_drafts`,
  `public.publish_mentorship_session_notes`, and mentor MFA recovery tables.
- The currently installed production state has 1 verified active mentor and
  1 mentorship session; **preserve that live data**.
- Production has old private complete/schedule EXECUTE grants, but it lacks
  the third request-response function referenced by staging PR #99. Do not
  blindly copy the PR #99 staging SQL into production.

Staging foundation migration history includes ~29 mentor-specific migrations
dated Oct 27–28 absent from production. Compare and reconcile the original
`supabase/migrations/*mentorship*.sql` files on PR #96 in dependency order,
with the actual production constraints, grants, existing data and rollback
guards. Do not copy the full staging database or test users to production.

## Production promotion conditions

- [ ] Verify the actual production **learner** and **admin** Vercel project
      IDs, domains, git integration, build branch, and production Supabase
      URL/key configuration. Production environment must never point to staging.
- [ ] Reconcile 14 missing tables, 35 function signatures, 27 triggers with
      an additive, reviewed, versioned production migration plan.
- [ ] Capture pre-release production schema and backup/restore proof. Test
      migration over a privacy-safe copy with existing sessions/mentors.
- [ ] Verify existing production workflows in both pre- and post-migration
      forms, including grade/guardian restrictions, notification preferences,
      RLS and signed MFA authorization.
- [ ] Perform real staging learner/mentor account onboarding and AAL1/AAL2
      Auth tests through authorized invitation, verification and MFA screens.
- [ ] Enroll two distinct qualified MFA administrators and test independently
      approved recovery; never simulate staff identity proofing as actual.
- [ ] Run production-targeted CI, deploy to an isolated **production-config**
      candidate without assigning the live domain, smoke-test that exact build,
      then promote the tested artifact only when all gates pass.
- [ ] Confirm rollback plan preserves existing session notes, status, mentor
      verification, and any posted recovery audit records.
- [ ] Payment collection remains OFF in all environments.

**Release decision: HOLD** until these non-negotiable conditions are met.
The staging preview exists to close them safely, not as evidence they passed.
