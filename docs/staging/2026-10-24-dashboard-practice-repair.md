# Dashboard and practice repair

The staging database had only the invitation feature flag. The dashboard treats missing feature flags as disabled, hiding the Start practicing action and disabling Practice and Skill Academy. Enabled those two verified learning features only.

Adult profiles no longer receive school Question Bank shortcuts from Practice or the dashboard. Practice load failures now offer retry and a link to education profile setup. Topic and recommendation loads ignore results after unmount.

Validation: frontend build passed. Existing suite: 254 tests passed; school dashboard test updated to supply its school stage, then all 8 tests in the affected navigation/recovery suites passed, including two new regression tests. No production changes or permissions widened.

Live staging verification under authenticated role using the existing synthetic QA student: dashboard flags true, own profile readable, one adult topic and three questions readable, badges query succeeds. A rollback-only transaction started practice with the frontend's default count of five (three available), submitted the three answers, completed the session, and confirmed dashboard totals of one session, three correct answers and a one-day streak. QA transaction rolled back. This is a database integration check, not signed-in browser E2E. Payments remain disabled. Test curriculum remains explicitly synthetic; other platform features are not certified by these checks.
