# Profile, grade–subject separation, and targeted recommendations
Draft implementation — 11 October 2026

## What was changed

### Grade and subject separation
- Registration onboarding still saves the existing core `student_profiles.subjects` subject **keys** for backward compatibility. It now attempts to show only school-stage subjects appearing in the exact grade's published curriculum; when that reference catalogue is incomplete, it visibly labels the stage-level fallback rather than hiding all subjects and blocking registration.
- School grade can be edited/resubmitted from Profile. Grade is preserved separately in `profiles.grade_level` and `profiles.education_stage_key`. The existing Question Bank already matches `mela_learning_programs.grade_level`; it now defaults to the user's preferred grade-specific program keys (if any).
- Students in Grades 11–12 can select academic streams. These are **preferences**, not verified institutional records or new course permissions.
- Academic subjects must ultimately be reviewed against Ethiopian curriculum source data; publishing and scoring still require qualified educators.

### Usable learner profile
- Profile → Academic profile → Edit grade and core subjects
- Profile → My learning & opportunity preferences → select exact-grade programs, interests, study countries, degree goal, career/learning goal, recommendation opt-in
- Save confirmation and fetch-on-reopen; private preferences persisted in `public.mela_learner_discovery_preferences`. This requires the new migration and live RLS tests.
- Optional fields are not used as eligibility, age-verification, teacher-approval or authorization claims.

### Targeted features
- Student UI and deep links now hide/disallow wallet and paid work while financial release is deferred; lower grades do not see formal career assessments.
- School learners browsing opportunities see education-focused opportunities rather than unrestricted employment, gigs or internships. Other roles continue to use their own role dashboards.
- **These are navigation safeguards only.** The backend must still independently verify legal age, student/guardian consent, role eligibility, financial feature availability and opportunity/application permissions. UI gates are never sufficient security.

### Recommendations and tracking
- Scholarship results rank verified, currently open listings by declared interests, preferred country and preferred degree; each positive match displays an explicit reason.
- Opportunity Hub similarly ranks educational/work listings by interests; it does not claim eligibility.
- Student dashboard shows up to three matching verified scholarships when matching preferences exist.
- "My preparation" lists checklist progress for **both** internal applications and independently tracked external submissions. It does **not** claim provider-side application status.
- "My Applications" continues to show only applications recorded through the MELA database.

## Security and privacy
- RLS permits only the authenticated owner with a student profile to read/write the preferences row. No anonymous access or sensitive admin permissions.
- User-entered preferences and grade/subjects are self-reported. Minor identity and consent requirements remain independently server-managed.
- Scholarship recommendation scores are sorting hints only. They cannot be interpreted as confirmed citizenship, GPA, eligibility, or funding.
- Never send sensitive profile details to external scholarship websites automatically.

## Release blockers
1. Run `supabase/migrations/20261011120000_mela_user_settings_rls.sql` and `supabase/migrations/20261011133000_mela_learner_discovery_rls.sql` in staging for the **actual MELA Supabase project**; the currently connected project does not match the application's configured production backend.
2. Test authenticated user A cannot read/update user B preferences; verify anon denied; test parent/teacher identities are rejected by student-only RLS.
3. Verify exact grade subjects, grade 1–12, and both Grade 11–12 tracks against authoritative programme records, including how historic subject keys map to programme identifiers.
4. Check profile resubmission and stage transition; verify no stale curriculum access remains. Prefer a single server transaction for profile + subject updates before a wider rollout.
5. Test recommendations with no preferences, opt-out, empty scholarship supply, external application tracking, stale deadlines, and changed studies.
6. Add server-enforced audience checks and verified adult/guardian gates where legally required. The client-side navigation changes are not authorization boundaries.
7. Finish localization of these new controls across MELA languages.
8. Run automated tests/build, deploy a preview, manually test on phone, and only then merge and release.

Status: branch/PR implementation only, not deployed live.
