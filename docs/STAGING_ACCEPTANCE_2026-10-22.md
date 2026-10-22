# MELA staging acceptance gate — 22 October 2026

**Scope:** Supabase `tungqfmypuwzeyrtaseh` and isolated staging-only deployment branches. **Never apply this file to production** (`duizgtmbptmlbyipreqg`). Payments are OFF.

## Confirmed from direct staging queries

- Database `ACTIVE_HEALTHY` in `eu-west-1`; 266 public, 9 admin and 13 payment tables, all with RLS enabled.
- Supabase Auth health: HTTP 200. Test Auth endpoint `mela-staging-auth-test` deliberately returns HTTP 410.
- Auth users **0**; self-owned student profiles **0**. Do not report successful real sign-in, MFA, parent consent or cross-account isolation until actual test identities exist.
- 53 existing published course *catalog entries* have no `course_lessons` in staging. These are not 53 finished courses.
- Staging QA fixture migration `staging_qa_sample_course_lessons_and_unreviewed_questions_only` added exactly one explicitly labelled synthetic free course with two sample lessons. Course ID `a1e00722-2026-4722-8000-000000000001`.
- Three synthetic Grade 12 math review questions are **inactive and Unreviewed** under program key `mela_staging_qa_g12_math`. They are **not** the 140,000-question production review backlog. Client access to `mela_question_bank` is denied by RLS.
- No production student, employer, teacher, guardian, bank, Auth or profile data has been copied.
- Payment collection `mela_payments.settings.enabled=false`; no bank/wallet account configured.

## Learner app gate (draft [PR #57](https://github.com/Melakulms/mela-app/pull/57))

- Safe staging branch `staging/learner-20261020`, never merge without separate launch authorization.
- `MELA STAGING Learner Security and Build` workflow runs baseline unit tests, explicit Vite staging build, bundle staging-only checks, read-only Auth/anonymous privacy HTTP checks, and Android-sized local Chromium UI smoke.
- Direct tests prior to mobile step: 250 / 250 pass; staged build passes; Auth health 200; anonymous profile listing returns no records; disabled test function 410.
- Existing isolated Vercel project `mela-staging` has a READY deployment tied to the staging learner branch as of 2026-10-20, but authenticated Android interaction and latest CI branch code have not been verified at the public URL. The Vercel project lacks a Git repository connection for branch-scoped preview environment variables; creating a new Git-backed Vercel project returned 403. Do not reuse production App hosting to bypass this.
- Android browser smoke status: see most recent GitHub workflow. A failing/in-progress test is NOT a pass.

## Administrator gate (draft [PR #61](https://github.com/Melakulms/Mela-central-dashboard-/pull/61))

- Staging-only scholarship Admin preview is READY at [Vercel staging preview](https://mela-central-dashboard-jjrq-39mc7vzi3.vercel.app).
- 385 unit/UI tests and six live anonymous security checks passed for the tested staging Admin commit.
- Real signed-in `aal2` reviewer MFA, two concurrent scholarship approvals, revocation and cleanup are **not verified**. The protected staging GitHub environment requires a secret available only from the staging Supabase Auth Admin service. Never post a key, OTP, password or seed in chat/repo.
- Keep PR unmerged and payment collection OFF. Read-only production checks are permitted; no production writes.

## Release blockers that **must** be closed before broad beta

1. **Auth & email:** Staging invite-only test identities for adult student, teacher, guardian, employer, mentor, reviewer/admin using secure Auth Admin provisioning; first login, MFA and recovery from real sessions. No public anonymous signup bypass and no fake successes.
2. **Role segregation / child safeguarding:** Actual profiles and documents, student grade/school saving, parent linkage/consent, educator/employer approval, mentor permissions; explicit cross-account and underage-denial tests.
3. **Course substance:** Populate/approve lessons, source links and projects for all intended courses; do not treat catalog titles as approved educational courses.
4. **Question bank:** Import only authorized, non-personal educational material into staging, then segregate and verify teacher assignment/review/approval; 3 draft QA samples are not a functional 140k-bank copy.
5. **Features:** Practice/mastery (0 current approved items); all 8 Arena experiences and scoring, legitimate opportunity links/eligibility, mentor booking, languages/settings persistence and offline restoration.
6. **AI Coach/Admin AI:** Confirm provider health and allowed free quotas; no payment card/API secret in frontend. Current external AI service is not certified working.
7. **Android & PWA:** Validate real Android browser and installs for separate user/admin origins, Settings → Home, logout/login, password recovery and update behavior.
8. **Operational & security:** Confirm adult-only closed invitations, backup/restore, auditable admin changes, admin MFA recovery, teacher review security and a clean staged-to-live release gate.

**Release rule:** Green builds are necessary but insufficient. Each item above needs real, recorded tests. No production merge, hosting promotion, real payment or access expansion automatically follows staging QA success.
