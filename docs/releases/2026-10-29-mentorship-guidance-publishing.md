# Production mentorship guidance — release verification

Release date: 2026-10-29

- Merged free, read-only mentorship learning resources as commit `e89363e711e26cd70e11cf6f35bf475986c469bb`.
- Release verification commit `e96b22912bcb87ab31604b8a0c926f10e12c6bf0` requires the panel and offline fallback text in the GitHub Pages build artifact.
- Branch tests passed: 345 tests, TypeScript, and Vite build for the learner guidance release.
- Production database has six published `mentorship_resources` with signed-in SELECT, RLS, no direct user editing, and protected existing mentor/session records.
- The GitHub Pages publishing workflow must separately finish its `deploy` and `smoke` jobs, including `mela-release.json` matching the final main commit, **before anyone claims the phone-facing URL is updated**.
- Mentor session booking changes, lost-TOTP recovery, full 16-section foundation and payment collection are **not** part of this public guidance release.
- Production student app: https://melakulms.github.io/mela-app/
