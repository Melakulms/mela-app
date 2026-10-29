# MELA Mentorship 16-card production visibility release

**2026-10-29 — production learner:** https://melakulms.github.io/mela-app/

PR #107 (merged as `924bfe701867876ae7dd72db18becc641125d0c6`) replaces the hidden accordion and dropdown with sixteen immediately visible, numbered, responsive section cards. Each opens a local-only worksheet without private data access. The service-worker cache name changes to `mela-shell-v14-mentorship-16-cards`.

GitHub CI passed on PR #107. The full release is not verified until GitHub Pages `deploy.yml` build, deploy and smoke checks pass and the published `mela-release.json` matches the `main` commit. This documentation commit is also a direct `main` push to request Pages publishing after a connector-initiated PR merge produced no visible Pages run.

Private mentor verification, live sessions, guardian approvals, payment collection and MFA-protected administrator functions remain gated.
