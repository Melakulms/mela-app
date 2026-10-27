# MELA Mentorship — 16-section implementation ledger

Updated: 2026-10-27. The code in this document is on draft PR #96, **not production**.

## Execution rule
Complete and verify one section at a time. Existing functionality is counted as partial until authenticated, role-specific staging tests pass. Do not bypass guardian safeguards, enable payments, or grant broad database permissions to make a demo pass.

| # | Section | Current state | Required next proof |
|---|---------|---------------|---------------------|
| 1 | Mentorship Home | **Implemented in draft PR #96**: real stats, next upcoming meeting, profile goals, profile-based suggestions, private mentorship notifications, published audience-filtered announcements, clear empty/error states | Browser test with signed-in adult student and populated profiles; test offline/retry |
| 2 | Find a Mentor | Initial verified directory and category/language search in PR #96 | Populated staging mentor search; empty/fallback tests |
| 3 | Mentorship Categories | Initial descriptive category filtering in PR #96 | Taxonomy, localized labels, age/experience applicability |
| 4 | Mentor Profiles | Existing verified cards; expertise/language/availability in PR #96 | Evidence/qualification review, safe fields |
| 5 | Smart Mentor Matching | Rule-based suggestions (NOT automated eligibility) in PR #96 | Matching accuracy, no minor eligibility bypass |
| 6 | Mentorship Requests | Existing request UI and backend restrictions | Review least-privilege staging grants and authenticated request/deny tests |
| 7 | Booking and Scheduling | Existing session lifecycle | Authenticated scheduling/cancellation/conflict tests |
| 8 | Live Mentorship | Not built | Safeguarded live-session provider and moderation |
| 9 | My Mentorship | Requests/sessions exist; plans and goals remain incomplete | Dedicated verified outcome and goal lifecycle |
| 10 | Mentorship Resources | Preparation guidance only | Curated, teacher-reviewed library and permissions |
| 11 | Challenges and Assignments | Not built | Mentor-created tasks, safe submissions, feedback |
| 12 | Progress and Achievements | Home shows real session counts; awards not built | Evidence-based reviews and Career Passport integration |
| 13 | Group Mentorship | Not built | Cohorts, supervision and permissions |
| 14 | Mentor Workspace | Request/session management exists; new weekly hours editor in PR #96 | Mentor authentication, proof of controlled writes |
| 15 | Guardian and Safety Center | Existing safety entry and audience trigger | End-to-end guardian/safeguarding review |
| 16 | Mentorship Administration | Not completed | Approved-mentor workflow, moderation and audit trail |

## Section 1: explicit behavior
- Source of truth: verified active mentor profiles, mentorship requests/sessions, student_profiles goals/interests, user-scoped notifications, published audience-filtered announcements.
- No invented recommendations or announcements; empty states are expected where data is absent.
- Recommendations are textual suggestions, not permission to send a mentorship request.
- Section 1 reads existing tables only; **no Supabase schema/data modification in this PR**.
- When supplementary profile/update queries fail, mentors and sessions remain accessible and the failure is visible.
- No paid provider, wallet, recording, or in-app video claim.

## Before any production release
1. GitHub TypeScript/build/test suite green for the final commit.
2. Create safely controlled, adult-only staging test accounts/approved mentors using authorized provisioning (no real user's data copied).
3. Verify authenticated browser request/session journeys, guardian constraints, and denied cross-user access.
4. Audit the existing mentorship DB privileges: the staging read-only audit found that authenticated roles lack INSERT on mentorship_requests and EXECUTE on several lifecycle RPCs. Keep deny-by-default until a separate least-privilege fix is reviewed.
5. Verify mobile responsive behavior, appropriate languages, and staging deployment against staging Supabase.
6. Obtain explicit release review before promoting a production change.
