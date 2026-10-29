# MELA production delivery watchdog — 29 October 2026

**Target:** The existing, canonical MELA learner GitHub Pages site at `https://melakulms.github.io/mela-app/`. Production Supabase `duizgtmbptmlbyipreqg` is unchanged.

## Why
The safe 16-section preparation release merged as `397347e646373c40d95ef296b93d24ba72156794`, but the connected GitHub Actions API did not show a publish run for that merge. A successful merge must not be represented as an on-device deployment without the exact release marker and a successful Pages smoke check.

## Operation
`.github/workflows/mela-production-release-watchdog.yml` runs only on the default `main` branch, by explicit owner workflow dispatch or on a 6-hour UTC schedule (37 minutes after an even UTC hour).

It makes a read-only HTTP GET of the canonical `/mela-release.json` marker, checks its exact 40-character Git commit against `github.sha`, and:
- if the live SHA matches, exits without deploying;
- if the server returns HTTP 200 with a different marker, or 404, dispatches the **existing** `deploy.yml` workflow for `main`;
- if the site is unreachable or returns a surprising status, fails closed rather than deploying blindly.

GitHub's built-in `GITHUB_TOKEN` with narrowly scoped `actions: write` triggers `workflow_dispatch`; no deploy tokens or Supabase secrets are added.

The existing `deploy.yml` handles npm tests, explicit public-config build, UI presence checks, GitHub Pages upload, exact-SHA publication verification, Auth and privacy smoke tests, and practice-archive checks. The watchdog does not bypass any of those gates.

## Before declaring live
Confirm that GitHub Actions `Deploy to GitHub Pages` has all build/deploy/smoke jobs green and that its **exact** SHA matches the new `main` HEAD. Test the phone-facing app after refreshing the installed PWA.

## Explicit product boundaries
Only six published guides and 16 preparation tools are currently approved. User data stays private. PRs #96 and #98, along with Admin PR #65, stay draft and are **not** released as live 16-section mentorship backend functionality until real authorized account/MFA, mentor credentials, child protection, and signed-in E2E tests pass.

Do not enable payment collection, video calls, or automatic approvals.
