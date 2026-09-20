# MELA — Student/Employer App

The main MELA frontend (separate from the Central Admin Dashboard repo).

## What's real right now

- Registration for all four roles (student, parent, teacher, employer), matching the
  database's actual `handle_new_auth_user` trigger contract exactly
- Email confirmation flow, wired to real Supabase Auth
- Login, logout, password reset
- Student dashboard rendering live data from `get_my_dashboard_v36`
- Practice: real topic browser, live questions, immediate feedback, mastery scoring
- Opportunity Hub: browse and apply to real opportunities
- Skill Academy: browse and enroll in real courses
- Mentorship: browse verified mentors, send real requests
- Career Passport: real verified skills and achievements
- Study Materials: real subject-organized resources
- Employer Portal: company registration -> admin approval -> post opportunities -> view real applicants
- AI Career Coach: real chat wired to the AI agent execution pipeline
- Arena: real matchmaking (join/cancel/status), leaderboard, and a live match screen
  (verified against the actual function source; the live-match UI itself has not been
  exercised against a real second player yet, since none has existed to test with)

Parent/teacher accounts can register, verify, and log in, but land on an honest
"not built yet" screen — no fake data, no mocked screens.

## Stack

React 19 + Vite + TypeScript + `@supabase/supabase-js`, same pattern as the Central
Admin Dashboard repo.

## Local development

```
cp .env.example .env.local   # fill in your real publishable key
npm install
npm run dev
```
