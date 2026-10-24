# MELA Staging scholarship and guardian safety — 24 October 2026

**Environment boundary:** This work is only for Supabase project `tungqfmypuwzeyrtaseh`. Production project `duizgtmbptmlbyipreqg` must remain read-only. Payments remain OFF. Do not merge staging test fixtures or provisional school subjects into production.

## Database changes applied to staging

1. `staging_guardian_and_minor_application_security_v3`: guardian request/decision RPC and restrictive application gate; protects student age/grade updates.
2. `staging_learner_guardian_clearance_safety_v4`: verifies live guardian link rather than trusting a cached approval flag.
3. `staging_official_university_funding_research_sources`: research-only funding link table, RLS public read and no public writes.
4. `staging_remove_anonymous_minor_security_rpc_access`: revoke anonymous eligibility function execution.
5. `staging_restore_missing_school_stages_and_opportunity_gates_20261024`: restore school stage definitions and conservative 12 audience rules.
6. `staging_seed_provisional_school_subject_options_20261024`: 55 provisional subject options based on older Ethiopian MoE national curriculum framework; all are `pending_review`.
7. `staging_audit_guardian_decisions_with_immutable_evidence_20261024`: private append-only guardian decision audit with mandatory administrator note and RLS.
8. `staging_close_unverified_university_adult_clearance_bypass_20261024`: higher-education label alone never grants adult-sensitive access.
9. `staging_prevent_primary_school_university_profile_classification_20261024`: grade classification reads the actual education profile.

## Verified staging snapshot

- Six education stages; 12 stage/opportunity rules; 55 provisional subject/track options.
- 200 university website records, 43 university funding-page leads; **12 individual source-checked programme and financial-aid schemes**, with date, nationality, funding and level evidence.
- Zero administrator-approved programmes, zero published MELA scholarship opportunity records. Distinguish official institutional financial aid from a separately competed scholarship.
- Three current staging Auth profiles; no registered staging super-admin, no verified guardian relationships, no guardian decisions.
- No staging learner has date-of-birth or adult eligibility attestation. The `adult_work_eligibility` policy document is not present; do not bypass consent/age requirements.
- New child registration is deliberately **disabled** in the adult-only staging learner preview until real guardian approval and safeguarding tests succeed.

## Source-checked scholarship research catalogue

- `staging_source_checked_scholarship_program_catalog_v1`: dedicated read-only source-check table and user-owned saved-programmes RLS.
- `staging_mfa_scholarship_research_review_and_private_audit_v1`: MFA-only administrative review, withdrawal and private decision audit.
- `staging_remove_scholarship_eligibility_paywall_and_false_guarantees_v2`: eliminates premium requirement and replaces misleading GPA-only `eligible:true` claims with explicit preliminary criteria explanations.
- [Versioned public research entries](../../research/mela_official_scholarship_programs_2026_10_24.json) include five UK/Canada programme examples, five US need-based aid opportunities and two PKU international scholarship programmes.
- Only source-checked research appears in the initial staging learner view; university-only links remain a separate directory and must not imply a verified award.
- Admissions, school nomination and scholarship deadlines are distinct. Toronto Pearson is **not open to new nominations** as of Oct 24, 2026 even though already nominated candidates have a November submission deadline.
- A change in institution funding rules must trigger re-verification and a new version of the research record. This is ongoing operational work; scholarships cannot be accurately verified once for all time.

## Test instructions

Run `supabase/staging-tests/guardian_scholarship_security_smoke.sql` and `supabase/staging-tests/scholarship_catalog_security_smoke.sql` on staging only. It verifies catalog, restrictive application gate, anonymous permissions, private audit privilege, and simulated ordinary-user denial. The SQL is transactional and ends with ROLLBACK.

The smoke tests include role-simulated negative RLS and fake cross-account save denial. They do **not** prove successful real-account bookmarking or Android rendering. There is no registered staging administrator, so MELA source approvals cannot be executed until a real authorized MFA admin joins staging. The smoke tests do **not** prove actual MFA sign-in, guardian identity verification, real student application submission, or individual Ethiopian scholarship eligibility. Those require authorized staging accounts and monitored E2E testing.

## Review

- Learner: https://github.com/Melakulms/mela-app/pull/59
- Guardian reviewer: https://github.com/Melakulms/Mela-central-dashboard-/pull/62

Do not publish 43 official funding research pages as 43 verified scholarships. The 12 research programmes must be checked again before academic-year changes or a real application. Review every national eligibility rule, current application link, funding coverage, and deadline before promoting an individual award.
