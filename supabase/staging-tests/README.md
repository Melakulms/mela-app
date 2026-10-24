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
- 200 university website records, 43 official funding research leads; **zero verified published scholarship opportunity records**.
- Three current staging Auth profiles; no registered staging super-admin, no verified guardian relationships, no guardian decisions.
- No staging learner has date-of-birth or adult eligibility attestation. The `adult_work_eligibility` policy document is not present; do not bypass consent/age requirements.
- New child registration is deliberately **disabled** in the adult-only staging learner preview until real guardian approval and safeguarding tests succeed.

## Test instructions

Run `supabase/staging-tests/guardian_scholarship_security_smoke.sql` on staging only. It verifies catalog, restrictive application gate, anonymous permissions, private audit privilege, and simulated ordinary-user denial. The SQL is transactional and ends with ROLLBACK.

The smoke test does **not** prove actual MFA sign-in, guardian identity verification, real student application submission, or individual Ethiopian scholarship eligibility. Those require authorized staging accounts and monitored E2E testing.

## Review

- Learner: https://github.com/Melakulms/mela-app/pull/59
- Guardian reviewer: https://github.com/Melakulms/Mela-central-dashboard-/pull/62

Do not publish 43 official funding research pages as 43 verified scholarships. Review every national eligibility rule, current application link, funding coverage, and deadline before promoting an individual award.
