# Real-user readiness check — 15 October 2026

## Verdict

Unrestricted production readiness is **not established**. Existing users should
be treated as a supervised test group until production backend access and the
authenticated acceptance gates below are resolved. This is a targeted check,
not a complete penetration test or content certification.

## Verified this session

- Live Pages release marker matches source commit `4e4c776591e33535fbf1f6e1c66867a2e363b9b2` before this patch.
- Public registration loads and offers student, parent, teacher and company roles.
- Live Settings exposes the matching release marker; Home exits Settings.
- Auth status reports email enabled, signup enabled and autoconfirm disabled.
  This does not prove message delivery or correct email template URLs.
- Invitation endpoint reports enabled/invite-only/no-email mode. This describes
  the separate invitation route; standard email signup is also enabled.
- Public language Data API smoke passes.
- Anonymous requests to profiles, student_profiles, parent_profiles,
  teacher_profiles, company_profiles, mela_question_assignments and
  mela_question_reviews each return HTTP 401. No private records were printed.
  These checks do not establish isolation between signed-in accounts.
- Isolated Vercel Admin responds HTTP 200 with CSP `frame-ancestors 'none'`,
  X-Frame-Options DENY, nosniff, no-referrer and no-store headers.
- Learner regression suite: 236 tests across 47 files pass with this patch.

## Repair

Session restoration previously had no deadline: an unresolved initial Auth
request could leave the app on Loading indefinitely. It now surfaces the existing
retryable session error after 15 seconds, ignores a late stale snapshot and still
accepts subsequent Auth events. Timers are cancelled on success and unmount.
Regression tests cover timeout, late snapshots, event recovery and cleanup.

## Unresolved acceptance gates

- Connected Supabase account lists only inactive `rztqmkklqsspchenjijh`; access
  to production `duizgtmbptmlbyipreqg` is denied. Production SQL, Auth config,
  advisors and pending Edge Function deployments could not be verified or fixed.
- Verify actual email signup, inbox delivery, confirmation and password reset.
- Verify saved profiles, role permissions, signed-in account isolation, suspended
  accounts and storage access using dedicated test users against production.
- Validate physical Android installed-app navigation and session restoration.
  The local mobile Playwright runner could not start because its browser binary
  is absent; desktop cloud-browser checks are not physical-phone evidence.
- Complete teacher/content approval, multiplayer scoring, mentorship booking,
  moderation and operational restore/incident checks recorded in the Admin
  repository's 14 October diagnostic. Do not enable deferred financial features
  on the strength of this frontend check.

Some initial public requests experienced proxy timeouts; independent requests
confirmed the endpoint results listed above. No customer accounts or records
were changed during these checks.
