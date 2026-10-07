# Frontend usability update

## Changes

- Responsive login and registration layout, password visibility, accessible errors, and local font fallbacks without a blocking external font request.
- Responsive dashboard with searchable tools, visible loading/retry states, and separate badge-load failures.
- URL-backed learner navigation that preserves the GitHub Pages base path and auth parameters, supports refresh and browser history, and keeps navigation available while feature bundles load.
- Screen titles, skip link, current-page navigation, larger touch targets, reduced-motion support, and actual browser connectivity status.
- Visible logout and language-preference failures; changing language no longer reloads the active lesson. The shell, learner dashboard/module catalog, bottom navigation and profile controls now react to English, Amharic, Afaan Oromo, Tigrinya and Somali. Deeper feature copy and curriculum content remain a separate translation/certification backlog.
- Question-bank loading, retry and empty states; readable selected answers; written-answer labels; answered progress; rejection of blank answers; disabled editing while submitting.

## Verified

- 28 Vitest regression tests pass (22 existing plus six new tests).
- TypeScript and Vite production build pass.
- Chromium public screens: login, password visibility, reset validation, registration navigation. No page JavaScript errors.
- Isolated browser fixtures: dashboard, tool search, question-bank start/answer controls, refresh, Back navigation and offline message. Widths 320, 360, 768 and 1366 have no horizontal overflow. No page JavaScript errors.
- Visually inspected desktop login/dashboard and mobile login/question-bank screenshots.

## Limits

The browser fixture checks intercept Supabase requests and do not verify live authentication, email delivery, database authorization, or saving real answers. No real accounts or production records were created or modified. Full authenticated role journeys, live Arena play, financial settlement and teacher workflows remain separate release work. Financial feature flags were not changed. This update changes the consumer repository only; the central admin frontend was inspected but not modified.

## Teacher refresh follow-up (3 October)

On current main, classroom creation, joining, learner rosters and observation entry are already implemented. Earlier unmerged classroom work was not reapplied.

Fixed teacher classroom loading failures displaying stale roster/creation controls or misleading empty/unverified states. Refresh now clears the selected roster and educator status until loading succeeds. Education stages display their published titles; inactive rooms do not advertise a join code. A successful creation stays visibly confirmed even when its subsequent refresh fails, discouraging accidental duplicate creation.

45 regression tests and the production build pass. Three new regressions cover initial load recovery, hiding stale roster/controls after a failed permission refresh, and distinguishing creation success from refresh failure. These are mocked UI regressions, not live teacher-account verification.


## 7 October language and dashboard-color repair

- Fixed the dashboard color regression where a later high-specificity CSS rule replaced every module gradient with the same dark surface.
- Added distinct accessible accents for Career Passport, Safety, Opportunity Hub, Skill Academy, Challenges, AI Coach, Practice, Question Bank, Arena, Study Materials, Scholarships, Mentorship, Mastery, Future Map, Mela Next, Wallet, Assessments and Earn & Work.
- Extended the five-language UI dictionary through the learner dashboard/module catalog and profile controls; localized search now matches translated module names and descriptions.
- Added pure translation regression coverage so launch-critical labels cannot silently fall back to English in Amharic, Afaan Oromo, Tigrinya or Somali.
- Educational content is not claimed translated. The backend contains multilingual learning/assessment structures, but the current learner course/practice readers still fetch English source records without language-aware translation joins.
