# MELA payment verification — implementation and test status

Implemented 19 October 2026. The real payment module is installed on **mela-staging** (`tungqfmypuwzeyrtaseh`) with collection disabled. Production database was not changed. No real bank account, product price, reviewer, incoming payment or entitlement has been configured.

## What is available

- `public/payment-test.html`: phone-friendly, clearly labeled **browser-only simulator**. It contacts no provider and grants no real access. Submit the sample reference, select a scenario, confirm the simulated account check, and run the agent. Reset to try another case.
- `src/pages/ManualPayments.tsx`: authenticated customer/payment-review interface, ready to mount after app login. `reviewer` only controls presentation; the backend checks permissions independently. It is now wired into the learner header and the central dashboard Payments section in the proposed code, behind `VITE_MANUAL_PAYMENTS_ENABLED=true`. The changes are not merged or enabled in production.
- `src/lib/manual-payments.ts`: typed Supabase RPC adapter.
- Migration: isolated private schema, server-priced orders, trusted receipt records, atomic reconciliation agent, entitlements and audit log. Public RPC is invoker-only; private privileged function authenticates every caller. All table access is denied to client roles.
- No LLM, paid AI API or undocumented bank scraper is used. The agent is deterministic and runs when a reference or verified record is submitted, or when a reviewer requests a recheck.

## Trust boundary

The customer submits an **untrusted claim**. It never becomes proof of payment on its own. A specifically provisioned payment reviewer, signed in with MFA (`aal2`), must inspect a successful credit in the merchant's own receiving account and confirm the buyer/order association from the order memo or an independent payer check. The reviewer enters the actual reference, recipient, amount, currency, date, and verification note. A customer's screenshot or public receipt alone is insufficient.

The cross-bank follow-up keeps the customer reference and sending bank separate from the receiving-account reference. Any sending bank can be entered for manual reconciliation; this is not a claim of automated coverage. The agent checks receiving provider/reference, exact recipient and amount, ETB currency, order association, the order's 24-hour payment window and whether a receipt was used. Receipt recording, approval, entitlement and audit are one database transaction. Order row locks and unique receipt/entitlement constraints protect retries and competing submissions. An unverified reference does not reserve a receipt, preventing a different customer from blocking its legitimate owner by claiming it first.

Accounts and prices are snapshotted in the order. The client cannot override ownership or price. Anonymous access, anonymous Auth accounts, customer admin calls and direct table mutations are denied. Order creation is limited to ten per user per 24 hours; reference submissions to ten per order. Approved/rejected states cannot be reopened by a customer. Rejection is audited; refunds/reversals need a separate audited workflow before live release.

## Tests and remaining verification

- Existing app suite: 250 tests passed; TypeScript + Vite build passed.
- Migration + SQL regression ran in isolated PGlite PostgreSQL with mock Supabase Auth functions. These tests exercise the actual SQL functions, not a rewritten matching algorithm. Synthetic users and all fixtures roll back. PGlite does not replace a real Supabase Auth/MFA/browser end-to-end test.
- Cases: unauthenticated and unauthorized calls, missing MFA, cross-user reads/submission, price/owner tampering, unverified reference, malformed reference, confirmation checks, underpayment, wrong recipient/currency, stale/future payment, approval, repeated approval, entitlement/audit uniqueness, stolen/used reference, duplicate receipt, rejection finality, expiry, RPC/table grants and RLS.
- Staging read-only check: collection disabled; zero orders, receipts and reviewers; anon cannot call RPC; authenticated cannot call internal reconciliation or insert receipt records.
- Staging security advisors: no warning/error findings. Eight informational `rls_enabled_no_policy` notices are intentional default-deny tables in a private schema with no client table grants. Do not add permissive policies to silence them.
- Staging fixture test was declined by automatic approval review with no stated reason. No synthetic Auth users were created there. Isolated local tests were used instead.
- Real telebirr/bank lookup, receiving-account settlement, Supabase MFA login, multi-connection race tests and real course access remain unverified. **Do not advertise the simulator as bank verification.**

## Run isolated tests

From the repository root:

```sh
npm install --prefix /tmp/mela-payment-test-runtime --no-save --ignore-scripts @electric-sql/pglite@0.3.14 playwright@1.58.2 @sparticuz/chromium@133.0.0
node scripts/payment-tests/run-local.mjs
node scripts/payment-tests/browser.mjs
npm test
npm run build
```

The test helper's absolute import points only to the explicitly installed temporary test dependencies. It never reads production credentials. `PAYMENT_TEST_URL` optionally tests the published simulator instead of the local HTML file.

## Before a real-money pilot

1. Confirm the permitted receiving account and provider, full account display name and identifier, and actual product/pricing. Never request or store a bank password, PIN or OTP.
2. Provision the real payment reviewer in the private allowlist through authorized backend administration, after verifying their account and MFA. An existing general admin role does not automatically grant payment authority.
3. Configure receiving account and product rows; keep collection disabled until end-to-end testing is complete.
4. Mount the customer component in the learner app and the reviewer component in the central dashboard (copy the adapter and component there, using that app's own Supabase client). Add route guards and server-side entitlement enforcement for the specific paid product. The current entitlement record **does not yet unlock an existing MELA course**.
5. Test customer login, reviewer MFA, record entry, rejection, refresh/relogin persistence and access gating on staging. Run two-session concurrent approval tests. Confirm all UI messages are translated as required.
6. For automation without manual entry, obtain a supported provider receipt API or authorized receiving-account statement feed. The feed must be authenticated, preserve provenance, reconcile successful credits/reversals, and bind a payment to an order. Do not scrape arbitrary user-submitted URLs or treat OCR as trusted evidence.
7. Enable a small real-money pilot only after the above, using a genuine received transaction. Add refund/reversal and reconciliation procedures before broader collection.

This module handles MELA's own product purchases only. It does not enable marketplace escrow, wallet balances, cash rewards or payouts.

## Follow-up: real cross-bank implementation (19 October 2026)

The owner rejected simulated payment testing as the deliverable. No additional simulator was built. Updated the actual backend and both app forms:

- The customer supplies the sending bank/wallet name and sender reference.
- The reviewer records the separately verified incoming credit reference. Sender and receiver references can differ.
- Duplicate prevention keys on the verified receiving-provider reference, so changing the sender bank/reference cannot reuse the same received payment.
- Any configured receiving bank is supported by this manual-record workflow. No universal receipt API, provider scraper, connected bank account or live settlement is claimed.
- `20261019142948_cross_bank_payment_references.sql` and cross-bank PostgreSQL tests were added. Tests passed locally. Installing this follow-up migration on staging was declined by automatic approval review without a reason; it is NOT installed. The initial staging migration remains unchanged and collection is disabled.
- Learner navigation and admin Payments UI are wired in proposed code with the frontend feature flag off. The admin backend still requires its dedicated reviewer allowlist and MFA, regardless of menu visibility.
- Real activation is blocked on the approved receiving-account details, product/price and trusted transaction evidence, plus completion of the database rollout, entitlement integration and real Auth/MFA/settlement tests. Keep production collection disabled.

The sample HTML link from the initial work remains only a simulator and is not the real-payment test URL. Do not ask the owner to transfer money through it.
