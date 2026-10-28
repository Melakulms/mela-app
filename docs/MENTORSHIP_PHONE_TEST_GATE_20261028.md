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
