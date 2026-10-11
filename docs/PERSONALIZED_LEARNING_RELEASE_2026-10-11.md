# MELA personalized learning — delivery checklist
Date: 2026-10-11 · Status: draft code under GitHub PR #30; NOT deployed live.

## Changes in this round
- Skill Academy: selects and orders *published, content-available* free courses by the saved user's interest/learning goal. In-progress enrolled courses surface first. Paid enrollment remains unavailable; a draft course does not appear as completed.
- Study Materials: groups the server-approved, grade/stage-filtered programs by the student's selected curriculum keys, with an explicit "Show all" control. No entitlements are granted by this client preference.
- Practice: combines existing backend practice recommendations with chosen subject titles from the matching grade catalogue. Sessions still use existing grade-limited `fetchTopics`, `start_practice_session` and teacher-moderated question workflows.
- Student dashboard: shows optional discovery profile-readiness steps; real course-enrollment counts; recorded practice sessions, questions and answer accuracy; saved daily study minutes; course matches; actionable next steps; and opt-in in-app scholarship deadline notices from existing verified listings.
- User notification preferences: the dashboard hides deadline notices unless the signed-in account has `notify_opportunities=true`. **No email, SMS, push, or scheduled background alert has been implemented.**
- Audience: hides career coaching for Grades 1–6 and school Question Bank for university/TVET learners. App deep-link routing uses the same checks; these are not server authorization.
- Existing tests extended for matching, profile preparation, grade/audience, and date-based deadline calculation.

## Source of truth
- `get_mela_academy_catalog` + `course_enrollments`: course availability and actual learner progress.
- `get_my_dashboard_v36`: recorded practice metrics and teacher-approved practice recommendations.
- `get_mela_learning_library`: curriculum material authorization.
- `public.mela_learner_discovery_preferences`: optional private learner interests, school program preferences and degree/country selection.
- `public.mela_user_settings`: notification choices and daily study target.
- The app does **not** auto-complete lessons, confirm grants or scholarships, or claim external application status.

## Deployment blockers / verification before merge
1. Supabase project connected to ChatGPT was previously found INACTIVE and not the production project used by the MELA frontend. **Do not apply these migrations to the wrong backend.**
2. Apply `20261011120000_mela_user_settings_rls.sql` and `20261011133000_mela_learner_discovery_rls.sql` to an appropriate MELA staging environment, examine table conflicts and existing policies, and verify RLS for two unrelated students, a teacher, parent and an anonymous request.
3. Run current CI `npm ci`, `npm test`, `npm run build`; verify there are no TypeScript errors or broken previous navigation tests.
4. Test grade and subject changes (all Grades 1–12, tracks Grade 11–12), including published course links and teacher-reviewed assessments.
5. Verify the opt-out of discovery personalization, notification preferences, and screen-reader labeling.
6. Test three edge cases: profile/preferences not yet deployed, empty course catalog, and no scholarship matches. Dashboard must remain usable.
7. Replace broad UI-only audience restrictions with verified server-side age, guardian, role, and opportunity eligibility checks before enabling any restricted action.
8. Complete translations for Amharic, Afaan Oromo, Tigrinya, Somali and quality review for educational content.
9. Review performance and cache behavior for mobile data use; scholarship and course catalogs currently require separate API requests. The new dashboard recommendations should not delay core dashboard load.
10. Perform an Android PWA/browser smoke test. Merge and release only after all gates pass.

## Known limitations
- Recommendation matches are based on self-reported interests, not verified eligibility, age, nationality, grades or demonstrated competency.
- Personalization is deterministic, rule-based sorting, not a trained recommendation model.
- In-app upcoming-deadline notices are not guaranteed notifications; no background monitoring or push integration.
- Enrollment data gives completion status at course level, not an independent grade score.
- A proper teacher-reviewed personalized study sequence, daily time tracking, scholarship alert delivery, school/guardian data governance and administrator review consoles are not yet completed.
