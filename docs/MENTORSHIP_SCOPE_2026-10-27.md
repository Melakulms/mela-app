# MELA mentorship: approved scope and implementation status

The owner's specification is a 16-section guidance and learning system with separate learner, mentor, guardian and administrator experiences. This release advances the foundation; it does not complete the entire specification.

| Section | Current implementation and remaining work |
| --- | --- |
| Home | Own saved goal, plan-step count, requests and session summaries. Announcements remain. |
| Find a Mentor | Verified active directory; text/category/language/weekly-availability filters. Educational-level-specific mentor qualification remains. |
| Categories | Thirteen guidance categories with real profile-match counts. Matches are descriptive, not certification of qualifications. Categories without mentors do not imply an open program. |
| Profiles | Biography, organization, experience, listed expertise/languages, ratings and recurring availability. Per-qualification review history remains. |
| Matching | Deterministic goal-keyword and preferred-language ranking with explanations; manual search remains available. No paid AI dependency. |
| Requests | Existing submission, preferred time, status, cancellation and mentor acceptance/decline. Invitations/waitlists remain. |
| Scheduling | Existing accepted-request scheduling, cancellation/replacement and notifications, plus recurring availability editor and EAT session display. Collision prevention and automated reminders remain. |
| Live | Not enabled. No nonfunctional Join button or arbitrary external meeting links. Approved delivery and safeguarding require further work. |
| My Mentorship | Own requests, sessions, shared follow-up notes and saved MELA Next goals. Formal agreements and relationship closure/renewal remain. |
| Resources | Six usable worksheets, on-screen prompts, offline text downloads and navigation to existing MELA tools. Mentor-assigned resources remain. |
| Assignments | Not implemented by this release. Requires private submissions, reviewer feedback, revisions and permission tests. |
| Progress | Real completed sessions and self-tracked plan steps; Career Passport navigation. Automatic verified mentorship credentials are not implemented. |
| Groups | Not enabled. Requires qualified hosts, participant consent, moderated delivery and eligibility checks. |
| Mentor Workspace | Existing request/session lifecycle and shared follow-up notes; new persisted weekly availability editor. Learner plans are not automatically shared. |
| Guardian & Safety | Existing safety center and guardian-consent flow linked. Grades 1–10 direct-contact restriction retained. Supervised child mentoring and guardian-specific session summaries remain. |
| Administration | Existing verification and permission controls retained. Dedicated program analytics, disputes and quality oversight remain to be completed. |

## Validation

- Full local regression suite: 352 tests passed (70 files).
- TypeScript and production build passed.
- New tests cover matching, language aliases, time zones, filtered discovery, availability ownership filters and zero-row failures, failed-save recovery, hub navigation and goal linkage.
- Production schema/availability grants inspected read-only. No database migrations or payment changes in this release.
- Browser layout checks use mock data, if completed; they are not a real authenticated acceptance test.
- Real learner/mentor/guardian/admin acceptance and physical Android testing remain outstanding. Core user-facing additions are English; do not claim validated translations in the other four languages.

## Next implementation priorities

1. Secure mentor applications and qualification review, learner goal sharing by explicit permission, and server-enforced scheduling conflicts.
2. Private assignments/submissions/feedback, formal closure, guardian oversight and safe session delivery.
3. Moderated groups and verified outcome issuance into Career Passport, with MFA review and audit records.
4. Validated translations, low-data communication and institutional programs. Payments remain disabled.
