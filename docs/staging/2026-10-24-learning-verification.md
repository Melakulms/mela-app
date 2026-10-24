# Staging verification — 24 October 2026

Scope: Supabase tungqfmypuwzeyrtaseh only. Production unchanged; payment collection disabled, verified by query.

The stable address https://mela-staging.vercel.app/ now points to deployment dpl_DJfw8XdepVM996EJbb91drSbvBXC, commit 8103461eb4672b586e028be471e1ab606376f9e2. Vercel reports READY. Browser inspection confirmed the new adult-test instructions at both preview and stable addresses.

Added synthetic, explicitly labelled staging study material for University and College/TVET, and three synthetic adult practice questions. Restored authenticated execute on the specific library/material and practice functions after inspecting their implementations. Session creation requires an active student profile and matching education stage; answer submission and completion require ownership of an in-progress session. No anonymous grants, administrative access, production content copying, or payment activation.

## Real HTTP integration checks
A newly generated test account completed invitation signup, password login, University stage selection, and profile saving: HTTP 200 throughout.

- Library RPC: 200 and a published test unit returned.
- Material RPC: 200, unlocked synthetic content returned.
- Adult practice topics: 200.
- Start practice: 200.
- Read session questions with joined question text/choices: 200, three questions returned.
- Submit each of three answers: 200, correct grading verified.
- Complete practice: 200; three answered, three correct, score 100%.
- Independent database query confirmed one completed synthetic session with score 100%.

These are real authenticated API checks, not a full signed-in browser E2E claim. Public login UI was checked in the browser. The preceding report records course completion, session restoration, and password recovery checks.

## Remaining scope
Signup remains adult-student invitation only. Teacher, parent, company, mentor and admin journeys are not certified. AI Coach cannot operate on staging: mela-ai-execution-v2 is absent from deployed functions. Provider configuration is not verified. Arena multiplayer, opportunity application/approval, mentorship booking, full reviewed curriculum and all-language coverage remain unverified. No claim of full platform readiness.

Security advisors retain warnings about intentionally authenticated SECURITY DEFINER functions and disabled leaked-password protection; internal ownership checks were inspected. The earlier role-escalation mutation test was blocked by automatic approval review and remains unverified.
