# Browser storage inventory — initial review, 2026-11-05

Source inspection of learner app default branch identified:
- \`src/lib/device-preferences.ts\`: localStorage for accessible device preferences.
- \`src/i18n.tsx\`: localStorage for preferred interface language (\`mela_language\`).
- \`public/offline-progress.js\`: localStorage for public offline resume.
- \`src/components/MentorshipGuidanceResources.tsx\`: localStorage caching public guidance.
- \`src/lib/coach-history.ts\`: sessionStorage for short-lived personal coach conversation history.
- \`src/lib/auth.ts\`: attempts localStorage/sessionStorage cleanup on logout.
- No direct \`document.cookie\` use returned by the repository code search, but browser, Supabase, hosted assets and other SDK storage use still require runtime validation.

Pending: browser/device inspection with consent disabled; accurate essential/nonessential classification; cookie/SDK disclosure, privacy/storage notice, and shared-phone logout verification. This list is a code-search snapshot, **not** proof of complete cookie compliance.
