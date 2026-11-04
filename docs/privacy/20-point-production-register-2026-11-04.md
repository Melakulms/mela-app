# MELA 20-point privacy and user-protection production register

**Evidence date:** 2026-11-04 (Africa/Addis_Ababa). **Current decision: NOT CLEARED for unrestricted privacy/compliance launch.** This is a read-only engineering review; no user data was exported or erased and no payment setting was modified.

## Control-level status

| # | Control | Status | Production closure evidence required |
|---|---|---|---|
| 1 | Privacy notice | Partial | Controller/operator details, lawful purpose, recipients, retention, data geography and Ethiopian legal approval; published final version |
| 2 | Terms of service | Partial | Counsel-approved complete terms and versioned acceptance of final text |
| 3 | Refund policy | Partial | Accurate paid-service terms, provider reconciliation and operator approval before any collection |
| 4 | Cookies and device storage | Unverified | Real browser inventory: auth/session tokens, localStorage, IndexedDB, offline caches and external tools |
| 5 | Tracking consent | Unverified | Either prove no optional tracking exists, or demonstrate opt-in blocking before optional trackers load, plus withdrawal |
| 6 | Form consent | Present in code, not certified | Authenticated records of real final policy/version acceptance; distinct voluntary marketing; denial/withdrawal tests |
| 7 | Data minimization | Partial | Field-by-field role register and retention/erasure owner decisions, including children |
| 8 | Third-party SDKs | Unverified | Reviewed processor inventory/contracts and actual production network calls/transfer locations |
| 9 | Fair design | Unverified | Independent Android usability audit of joining, decline, cancellation and reporting |
| 10 | Transparent fees | Partial | Real Pro 50 ETB and Premium 100 ETB plan/period/fees; verified refund and commission disclosures (20/40 ETB on verified paid referrals only) |
| 11 | Authentic ratings | Unverified | Real-activity provenance and abuse-report/moderation E2E |
| 12 | Accurate claims | Unverified | Publisher sign-off for jobs, scholarships, mentors, qualifications, verified assessments and certificates |
| 13 | Accessible images | Partial | Screen reader audit across image assets, icons and alternative descriptions |
| 14 | Visual contrast | Partial | Test contrast, low vision, high contrast, 360px Android, font scaling and themes |
| 15 | Keyboard & focus | Unverified | Keyboard-only and assistive-technology audit of all navigation, dialogs and forms |
| 16 | Business details | Partial | Verified legal operator identity, supported contact and registration/complaint information |
| 17 | Children and guardian protection | Partial | Real authenticated child/guardian enrollment, identity/relationship verification, age and consent revocation E2E |
| 18 | Marketing unsubscribe | Unverified | Production email sends must check opt-out; one-click unsubscribe and functional owner-facing preference withdrawal |
| 19 | Rights to content | Unverified | License provenance and permissions for all images, fonts, books, questions, lessons and user content |
| 20 | Access/export/deletion requests | Partial | Live user E2E: request → MFA-gated reviewer → identity proof → retention map/hold → secure export or deletion → audit/notification |

## Evidence from connected production services

- Supabase project **duizgtmbptmlbyipreqg**: status ACTIVE_HEALTHY but hosted in **eu-west-1**. The Ethiopian Personal Data Protection Proclamation 1321/2024, Article 22, raises a **data sovereignty blocker** for personal data collected locally; an authorized Ethiopian legal/regulatory determination and compliant infrastructure path are required.
- Production metadata verifies `public.data_subject_requests` and `public.privacy_review_checkpoints` exist with row-level security enabled. This is intake/review infrastructure, **not** proof that verified export or erasure has occurred.
- Production Security Advisor 2026-11-04: 1 anonymous and 110 authenticated executable SECURITY DEFINER warnings (require individual audit), 46 RLS-enabled/no-policy informational notices (some may be deliberately private), and leaked-password protection disabled. **Never apply blanket EXECUTE grants or permissive RLS policies to suppress warnings.**
- Recent live admin deployment at main `e14fd4d`: read-only privacy data footprint and unresolved fulfillment gates. The live learner release SHA and authenticated multi-role end-to-end flow are **not confirmed by this record**.
- No payment collection state was changed by this review; do not infer collection status from UI tier prices. No existing payouts were affected.

## Release decision gates

1. **Operator/legal:** verify real business identity and counsel-approved policies; determine registration, DPO, children, cross-border and Ethiopia-local storage requirements with the regulator where required.
2. **Engineering and security:** review privileged RPCs case by case, keep least-privilege RLS and private data protected, enable eligible leaked-password prevention after sign-in usability review, inventory providers/storage, and test retention/marketing preference enforcement.
3. **Children:** demonstrate real, independently verified guardian consent with child data access isolation and recovery.
4. **Rights:** simulate authorization with disposable accounts on staging, then use a separate owner-approved production acceptance account; never erase real user records for testing.
5. **Release:** require green GitHub Pages build/deploy/smoke, exact `mela-release.json` SHA parity, Android screen-reader/keyboard checks, and authorized evidence for each listed control. **No status becomes “complete” merely because code exists.**

### Core references

- Existing public learner draft: `public/legal/mela-protection-plan.html`.
- Learner privacy workflow: `src/components/DataRightsPanel.tsx`; account: `src/pages/AccountOverview.tsx`.
- Admin review: `Melakulms/Mela-central-dashboard-` main commit `e14fd4d`.
- Ethiopian law: https://pdp.eca.et/pdp-proclamation
- Supabase advisor remediation: https://supabase.com/docs/guides/database/database-linter
