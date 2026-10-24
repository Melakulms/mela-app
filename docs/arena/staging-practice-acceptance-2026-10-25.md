# MELA Arena — staging acceptance and remaining release gates
**Recorded:** 25 October 2026  
**Environment:** Staging only (Supabase `tungqfmypuwzeyrtaseh`)  
**Production:** Read-only, unchanged (`duizgtmbptmlbyipreqg`)  
**Release:** CLOSED BETA only. Payments, betting, cash prizes and payouts OFF.

## Owner acceptance
The product owner approved the student-facing Arena practice experience, including the Employer Challenge answer submission flow. This is **practice UX acceptance**, not certification of eight production-ready competition flows.

## Verified staging preview
Vercel deployment `dpl_J26Q8yUVr9fjRvuKYADPLp9BSi8s` was **READY** on commit `d2c3747e8ff9a53bf32d45638a43ccf2b61d2661`: 
`https://mela-staging-iy2lg594l-melakuanteneh1-gmailcoms-projects.vercel.app/?view=arena`

## Eight practice experiences
- Quiz Battle — local sample questions and points
- Speed Quiz — local timed questions
- Skill Sprint — written practice and private saved response
- Interview Practice — structured interview rehearsal, private response
- Case Sprint — practical case answer, private response
- Team Battle — **clearly simulated** team-vs-bot drill
- Employer Challenge — private saved written practice; **not sent to an employer**
- Tournament — **clearly simulated** bracket, not real advancement

Practice achievements, bot results, self-review criteria and employer-style demo submissions **MUST NOT** become verified ratings, certificates, recruiter applications, real tournament standings, or financial rewards.

## Checked after owner feedback
- Employer Challenge submit no longer requires an arbitrary 40-character minimum.
- Saving returns a server-generated receipt and shows a confirmation **only after** successful persistence.
- Students can return to a saved private practice response and edit/resubmit it.
- A failed save retains draft text for retry.
- `public.arena_practice_submissions` has RLS and one-answer-per-user/mode/exercise constraints.
- On 2026-10-25, staging inspection showed **one** saved practice submission. Do not quote or copy its content.
- Transactionally rolled-back role simulation: answer owner could SELECT their record; a different authenticated student could not SELECT that record. No personal data was changed.
- Staging Supabase security advisor still reported broader non-Arena warnings, including security-definer view/function grants and leaked-password-protection configuration. These require independent review.

## Real competition release gates — NOT PASSED
- **Quiz Battle + Speed Quiz:** verify two independent real staging Auth sessions, age eligibility, queue pairing, readiness, start, timer expiration, 8 questions, answer accuracy, draw, disconnect and recovery.
- **Skill Sprint, Interview Practice, Case Sprint:** verify live opponent matching, independent authorized MFA judge, all written responses graded, fair finalization, and the appeal/audit mechanism.
- **Team Battle:** require approved organizer, verified participants, team capacity, private join-code isolation, match scoring and safeguarding.
- **Employer Challenge:** require approved real employer, published genuine challenge, eligible entrant, official authenticated submission, employer-only review, visibility and retention rules. Demo response is **not** official submission.
- **Tournaments:** require approved host, real registrations, fairness and bracket progression test, tie-breaking and correct final standings.
- **All modes:** require real Android browser/PWA tests, identity/age checks, RLS/auth regression, moderation, safeguards and no monetary payout.
- **Release/merge:** the staging PR is a draft; do not merge or promote to production on the basis of these practice checks.

## Latest observed staging counts
At time of closeout: one privately saved practice answer; zero Arena matches, zero round submissions, zero tournaments, zero approved employers and zero approved teachers. No registered adult birthdate entries had been verified.

**Signoff:** Practice Arena staging UX accepted by owner. Real competition release is explicitly blocked pending the above gates.
