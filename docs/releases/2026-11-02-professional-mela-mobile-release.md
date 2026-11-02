# Professional MELA mobile interface — production release checklist

Date: 2026-11-02. Learner app: https://melakulms.github.io/mela-app/

## Included

- PR #145 merged as `e7bd3f9000885ddf2151552d32ba61aa82b4d588`.
- PR #146 merged as `95854db2326cc4c9dffed2cad96d555820146399`.
- Unified purple MELA app styling, responsive login/registration presentation, accessible signed-in header, learner dashboard hero, progress cards using `get_my_dashboard_v36`, working shortcuts and the existing 18 learning/career tool routes.
- Mobile-first layout at 360 px, with the hero correctly stacking.
- Reduced-motion and low-data accommodations. No change to Supabase authorization, payments, payouts, production records, referral balances or grading.
- PR #146 passed MELA main CI, build, learner change checks, practice checks and mentorship UI verification.

## Publishing and acceptance (must be separately confirmed)

1. The `Deploy to GitHub Pages` workflow must pass build, deploy and smoke jobs from a main-branch push.
2. The public `mela-release.json` marker must report the **latest main commit** that was deployed. A merged GitHub PR alone does not prove phone visibility.
3. The `MELA Android mobile browser smoke` workflow must pass on Pixel Chromium, including actual signed-in style checks, 18 module tiles, 360px layout and the screenshot `professional-mela-home.png`.
4. An authorized Android user should confirm login, registration, Home, module drilldown/back navigation, Settings return and offline-safe UI without entering private credentials in a public report.

## Operational boundaries

The new design represents real UI routes, **not** a claim that every module or financial workflow is fully operational. Do not switch on Earn & Work, payouts, or any money collection solely because this UI deploys. Verify protected content, professional approvals and funds reconciliation separately.

This documentation change is an intentional direct main-branch push to trigger the existing GitHub Pages release workflow after API-merged PRs, which have not always produced a visible Pages run.
