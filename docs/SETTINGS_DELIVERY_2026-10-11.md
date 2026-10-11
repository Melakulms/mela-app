# MELA Settings System — delivery tracker (2026-10-11)

This document tracks the full settings inventory requested for the learner application and Central Admin. It explicitly distinguishes **implemented in a review branch**, **already present**, and **not yet implemented**. A draft PR does not equal a production release.

## 1. User settings

| Capability | Current implementation | Launch acceptance criterion |
|---|---|---|
| Registration-first entry | Existing App defaults to registration | New users see registration first; authentication required before private screens |
| Name, role, account summary | Added in Settings | Displays own account only; role cannot be self-edited |
| Language | Existing profile update reused in Settings | All enabled languages render across every section (translation coverage still needs audit) |
| Theme | Added in Settings and pre-auth device controls | Light/dark/system selection persists, WCAG contrast validated for every module |
| Large text / reduced motion / high contrast | Added and applied immediately | Screen-reader and mobile tests; layout never clips content |
| Password reset | Existing auth reset function linked | Emails tested for real email accounts; beta recovery uses separate established flow |
| Global sign-out | Added with confirmation | Existing refresh tokens revoked and new login required; short JWT expiry reviewed |
| User MFA and session-device inventory | Not yet implemented | Verified Supabase MFA flows with enrollment/recovery and per-device revocation |
| Course, Arena, opportunities, message notification preferences | Added account preferences schema and Settings form | Notification producers must filter deliveries by each saved choice |
| Daily study target | Added account preferences schema and Settings form | Target available to dashboard/study planner; progress backed by verified records |
| Profile visibility | Not yet implemented | Enforced server-side in profile and public API queries; minors default private |
| Data export and deletion | Not yet implemented | Verified request, retention/legal hold, download/delete fulfillment, audit |
| Guardianship and child safety | Existing Safety Center linked | Guardian review and consent workflow remains server-authoritative |
| PWA install and handbook download | Existing install bar + added Settings handbook link | Android/iOS browser testing; clear difference between install and file download |
| Parent controls | Existing parent dashboard references | Parent can change only explicitly authorized child settings |
| Teacher review | Existing Educator Content Review / verification workflow | Verified subject teacher alone can approve question for publication |
| Mentor availability | Existing mentor workflow | Availability/preferences persist and access is authorized |
| Employer listing | Existing employer portal | Verified employer can only control its own listings |
| Help/support and issue reporting | Safety reports exist | Support tickets, user-visible status, response routing and reporting SLA |
| Offline content storage limits | Not yet implemented | Download manager with cache quota and purge, clear offline indicator |

**Account settings backend:** `public.mela_user_settings` stores low-risk preferences per authenticated user, with owner-only SELECT/INSERT/UPDATE/DELETE RLS. No admin role, guardian permission, personal document, payment or payout controls are available to users through this table.

**Deployment dependency:** Apply `supabase/migrations/20261011120000_mela_user_settings_rls.sql` to the actual MELA Supabase project, then verify grants, RLS and a two-user isolation test. The currently connected Supabase project is INACTIVE and does not match the production API URL referenced by the app build. DO NOT apply this migration to an unrelated project and assume MELA is updated.

## 2. Central Admin settings

| Module | Current state | Required remaining work |
|---|---|---|
| Admin MFA and permission gate | Existing Central Admin backend/frontend | End-to-end MFA/session and restricted-role penetration tests |
| Feature switches | New editable feature-panel draft | Deploy updated Edge Function; verify audit trail and actual write guards for each flag |
| Financial controls | Deliberately deferred | Preserve disabled payouts, escrow releases and referral cash; separate audited release decision |
| Registration rules | Existing registration flows | Configure role/age/consent requirements with audited server-side controls |
| Users and permissions | Existing Users and Authorization panels | Cross-role tests, account recovery and role-change approval policy |
| Teacher verification and subject review | Existing moderation / content studio | Approve/reject queue for every curriculum question; reason + reviewer identity required |
| AI Academy and 53 fields | Existing draft courses/content studio | One-year complete content, approval/versioning, exercises and certified publishing |
| Arena 8 competition types | Existing Arena + integrity controls | Explicit configuration for all eight formats, scoring, eligibility and question approval |
| 2,000 external resources | Existing source-health migrations and directory | Scheduled URL checks, reviewer dashboard, provenance/verified source metrics |
| Practice, books, Q&A | Existing learner modules | Versioning, publication rules and teacher approval |
| Career Passport and certificates | Existing credential flows | Review identity/provenance and revocation controls |
| Mentor verification/scheduling | Existing mentorship modules | Approval, scheduling policy, safeguarding and disputes |
| Marketplace/moderation | Existing operations/disputes | Moderation rules and disabled financial settlement until payment release |
| Coins/referrals | Existing ledgers/invariants | Editable reward policy only via audited, server-enforced admin operation |
| Languages/translations | Existing platform_languages + i18n | Translation coverage audit and workflow with independent reviewers |
| Appearance / branding | Not yet admin-editable | Server-authoritative brand/style configuration with safe palette tokens |
| Notification templates | Not yet admin-editable | Template approval, batching, unsubscribe enforcement, delivery audit |
| Analytics/reporting | Existing overview/audit panels | Status, failure alerts, retention rules and export permissions |
| App installations and versions | Existing manifest, service worker | Verified install, rollback and offline-content settings |
| Backups / disaster recovery | Existing recovery documentation | Actual backup restore drill and recovery objectives |
| Integration settings | Not yet admin-editable | Secrets restricted to server/environment, never shown to browser |
| Maintenance/system messages | New feature flag editor | Verify messages are honored at relevant user surfaces |
| Content localization | Partial | Every enabled language complete across every user-facing screen |

## 3. Release gates

1. Apply migrations in staging, not directly to a live project before verification. Ensure no existing `mela_user_settings` table conflicts.
2. Verify `anon` has no access and authenticated users can access only their own settings row. Test two separate users, plus update attempts to change `user_id`.
3. Run `npm ci && npm test && npm run build` in the app and admin repositories.
4. Deploy the revised `mela-admin-api` Edge Function after verifying its authorization and audit RPC dependencies.
5. Verify `system.manage` role is necessary and MFA AAL2 is enforced. Test optimistic concurrency conflict.
6. Verify deferred finance flags cannot be re-enabled through the updated API.
7. Test app settings on small Android screens, light/dark modes, keyboard and screen-reader navigation.
8. Check login → Settings → save → reload → sign out → sign back in, and verify consistent preferences.
9. Test the lesson file download separately from PWA installation.
10. Only then merge PRs, deploy the frontend, and repeat smoke tests against the live user application and Central Admin.

## 4. Explicit known gaps

- Notification preferences are saved but delivery systems are not yet wired to honor them.
- The new settings screen itself still requires complete Amharic, Afaan Oromo, Tigrinya and Somali translations.
- Profile visibility is not exposed as an editable control until existing read APIs enforce its effects.
- User MFA, verified account export/deletion, and private session-device lists require additional server operations.
- All eight Arena formats and teacher question coverage require dedicated operational QA; a feature toggle does not create this functionality.
- AI lesson drafts do not equal a teacher-approved year-long certified curriculum.

The settings UI should never display a false success for any of these unimplemented processes.
