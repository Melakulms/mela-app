# MELA production registration, identity, roles and profile completion contract

Status: **Implementation specification — NOT production-ready certification**  
Date: 2026-11-01  
Scope: learner app, admin verification, data policies, guardian safety, paid-plan entitlement and referrals.

## Product rules
- One authenticated account for each person. A person can apply for multiple roles (e.g., teacher + mentor), but each role has its own profile, approval status and permissions. Primary role may select a default dashboard, never constitute authorization.
- Progressive onboarding: register → verify a supported contact → choose initial role → submit minimal role information → access appropriate **safe/free** features. Ask for verification/consent/qualifications only when relevant to a protected action.
- Make a saved, revisitable **Complete your profile** checklist. Draft fields persist. Each missing requirement names the next action, and the app distinguishes *incomplete*, *pending review*, *verified*, *rejected* and *suspended*.
- Prefer language-specific wording; default to one available language and allow change. Separate public display name from legal/full name. Hide private attributes by default.
- Never require a profile picture, national ID, paid plan or both phone and email for ordinary learners. Ask for age band first; exact DOB only if justified by safeguarding or verification requirements.
- Registration requires versioned Terms/Privacy acknowledgements. Marketing consent is separately optional and withdrawable. The server must record the policy versions and time of acceptance.
- Contact verification: at least one supported **verified phone or email**. Telegram bot control alone is NOT phone/email verification. A bot code may be a secondary proof or invitation but cannot be presented as contact/identity verification without a separately validated method.
- Public signup offers student, guardian, teacher, mentor, employer/partner; never administrator. Privileged accounts are owner-invited and require MFA and secure recovery.

## Collection by role
| Role | Essential initial information | Additional before protected activity |
|---|---|---|
| All | Full name, optional display name, selected role, supported verified contact, secure login, age eligibility, preferred language, required policy acceptance, optional referral | Optional city/region; never precise home address by default |
| Student | Education stage; grade/year where applicable; curriculum where content depends on it; subjects/field and short learning goals | Verified guardian relationship and consent where policy requires; Career Passport interests/skills later |
| Guardian | Adult eligibility; verified contact | Child invitation/link code, relationship, independent connection verification and consent before private learner access |
| Teacher | Subjects, stages taught, language, institution or independent status | Qualifications, experience, professional evidence, admin approval before question review/publishing |
| Mentor | Title, expertise, age groups, categories, languages, biography | Qualification/identity evidence, conduct agreement, verified approval, MFA, availability/timezone/session format before bookings |
| Employer/partner | Organization name/type, representative name/title, work contact, industry/location, partnership purpose | Description and evidence of organizational legitimacy and representative authority, verification before opportunity publishing |
| Administrator | **Not a public role**: owner invitation, verified work contact, scoped permissions | MFA, recovery setup, confidentiality agreement; no implicit access via self-selected metadata |

## Mandatory server-side security rules
1. Authorization must use server-controlled role memberships and approval records, NOT user-editable auth/user_metadata, a client-side role switch, or a UI visibility toggle.
2. A verified role profile never automatically verifies a separate role profile. A teacher can be pending as mentor while teaching remains approved.
3. Preserve private qualification evidence, ID material, contact, birth/age, guardian links, transaction information and payout details in access-controlled storage/tables; public profiles expose allowlisted display fields only.
4. Student grade + curriculum governs the allowed content catalog and queries on the server. Grade 1 cannot request Grade 10 materials by changing client parameters.
5. Child relationships require independent verification, consent state and auditable revocation. Knowing a learner's name/phone must not grant guardian access.
6. Teacher approval, mentor approval, employer publication rights, sensitive notes, admin review, payouts and payment confirmation require appropriate distinct privileges and MFA where specified. Test direct API calls, not just hidden buttons.
7. Do not loosen existing RLS, create privileged SECURITY DEFINER entry points without review, expose a service key to the browser, or change production security settings as part of a UI-only rollout.

## Billing and referrals: independent from basic identity
- Free access remains available without paid signup. Paid plan choices: **Pro 50 ETB** and **Premium 100 ETB** per applicable billing period; plan entitlement changes only following independently verified payment (or an explicitly authorized nonpayment grant).
- Invitation/referral source captured at registration but no commission from signup alone. Payable commission: **20 ETB** on eligible verified Pro payment or **40 ETB** on eligible verified Premium payment, subject to published conditions and duplicate/fraud/self-referral controls.
- Use ledger/idempotency tied to a unique eligible payment event. Prevent duplicate payouts, commission for declined/reversed transactions, and self-referral. Keep payout account data separate, collected only when claiming eligible earnings.
- Never request bank passwords, PINs, OTPs or Telegram login codes. Receipts may redact unrelated details.
- Payment collection / activation remains explicitly out of scope for this specification PR.

## Observed current state (read-only, 2026-11-01)
- GitHub default branch includes email signup and Telegram/one-time-invitation signup; public UI offers student, parent, teacher and company, not mentor/partner.
- Current invite mode uses a username + bot/invite code with no mandatory verified email or phone, so it does not satisfy the required verified-contact condition.
- Existing profile tables include students, parents, teachers, mentors, companies, guardians and partner-related entities. Existing profile flow is primarily based on one assigned `profiles.role`. Multi-role account selection is not established.
- The frontend has grade/stage validation and conditional access for some learning features, but this is not proof of server-side safeguarding across every feature.
- Current profile hub gates access on full profile completion for certain roles; revise it to allow safe features earlier while keeping privileged actions blocked.
- Both production and staging databases have subscription plan records; production `free` record is inactive, staging has no `free` plan row in the inspected query. Pro uses `normal_monthly` in production versus `pro_monthly` in staging. Existing client deliberately accepts both. Investigate before changing any plan keys or flags.
- Teacher/mentor/employer admin review functions exist, but functioning end-to-end review and user-facing role transitions must be separately verified.
- None of these findings certify production readiness. This PR is documentation only and has no runtime or database changes.

## Required acceptance tests before production rollout
| Test scenario | Acceptance criteria |
|---|---|
| Email signup | Real confirmation completed; no protected access for unverified address |
| Phone signup | Genuine provider-backed OTP verified; rate limiting/abuse controls and recovery checked |
| Telegram invite | Possession of bot code does not substitute for phone/email verification |
| Role setup | Resume incomplete profile, preserve saved values, show correct missing items, no false 100% status |
| Two roles | One account can hold independently approved teacher + pending mentor profiles; role switch cannot elevate privilege |
| Grades | Grade 1 sees and can fetch only permitted grade/curriculum materials; missing grade cannot bypass filters |
| Child/guardian | Link and consent authorized, other guardians denied, revocation effective server-side |
| Professional approval | Applicant teacher cannot review questions; unverified mentor cannot accept booking or write privileged notes; unverified employer cannot publish |
| Storage/privacy | Other user cannot read private contacts, verification evidence, payments or child relationships |
| Paid plans | Free account works, Pro/Premium entitlement granted only after verified event, wrong/reversed payments do not unlock |
| Referrals | 0 on registration; exactly 20/40 ETB from eligible verified Pro/Premium event; duplicate/reversed/self-pay protection |
| Admin | No public signup, MFA enforced for sensitive actions, safe recovery audited |
| Mobile/languages | Android registration, logout/login, role dashboards, translations, weak connectivity and profile resumption verified |

## Rollout order
1. Audit policies, existing functions and any live payment/role migrations on **staging**, using nonproduction accounts and representative child/guardian cases.
2. Implement verified-contact + required policy acceptance and resumable onboarding without changing live data.
3. Add server-authorized multi-role memberships and isolated role profiles; build applicant/review flows.
4. Enforce guardian/grade/document boundaries and MFA at backend, with adversarial integration tests.
5. Verify paid entitlements and referral ledger independently; no automatic payouts or new collection until separately approved.
6. Run CI, staging end-to-end tests and real Android checks; release incrementally with rollback and monitoring.

**Hard release gate:** production migration or live deployment is not authorized by merging this specification document. Require tested code, security verification and an explicit release decision.
