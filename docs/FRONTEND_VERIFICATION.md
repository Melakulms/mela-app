# Frontend usability update

## Changes

- Responsive login and registration layout, password visibility, accessible errors, and local font fallbacks without a blocking external font request.
- Responsive dashboard with searchable tools, visible loading/retry states, and separate badge-load failures.
- URL-backed learner navigation that preserves the GitHub Pages base path and auth parameters, supports refresh and browser history, and keeps navigation available while feature bundles load.
- Screen titles, skip link, current-page navigation, larger touch targets, reduced-motion support, and actual browser connectivity status.
- Visible logout and language-preference failures; changing language no longer reloads the active lesson. Language preference does not translate the interface.
- Question-bank loading, retry and empty states; readable selected answers; written-answer labels; answered progress; rejection of blank answers; disabled editing while submitting.

## Verified

- 28 Vitest regression tests pass (22 existing plus six new tests).
- TypeScript and Vite production build pass.
- Chromium public screens: login, password visibility, reset validation, registration navigation. No page JavaScript errors.
- Isolated browser fixtures: dashboard, tool search, question-bank start/answer controls, refresh, Back navigation and offline message. Widths 320, 360, 768 and 1366 have no horizontal overflow. No page JavaScript errors.
- Visually inspected desktop login/dashboard and mobile login/question-bank screenshots.

## Limits

The browser fixture checks intercept Supabase requests and do not verify live authentication, email delivery, database authorization, or saving real answers. No real accounts or production records were created or modified. Full authenticated role journeys, live Arena play, financial settlement and teacher workflows remain separate release work. Financial feature flags were not changed. This update changes the consumer repository only; the central admin frontend was inspected but not modified.
