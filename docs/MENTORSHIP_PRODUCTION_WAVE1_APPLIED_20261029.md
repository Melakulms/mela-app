# Production mentorship release wave 1 — applied October 29, 2026

Production Supabase project: `duizgtmbptmlbyipreqg`.
Status: **wave 1 migration APPLIED, verified; full 16-section frontend NOT promoted**.

Applied migration: `mentorship_request_decline_timezone_compat_prod_20261029`.
Source: `supabase/production-review/mentorship_wave1_request_compatibility_REVIEW.sql`.
Rollback: `supabase/production-review/mentorship_wave1_request_compatibility_REVIEW.down.sql`.

This additive migration added decline reason/note and preferred IANA timezone
fields on `public.mentorship_requests`, an IANA validation trigger, and a
guarded `public.respond_mentorship_request_with_reason` RPC (private
implementation not directly executable by clients).

## Production checks performed
- Forward, security assertions, unauthenticated negative call, down and
  outer ROLLBACK passed in the real production schema before applying.
- Post-apply CHECK script passed.
- Existing production: **1 session and 1 active verified mentor**, unchanged.
- Existing `private.process_mentorship_request_status` acceptance auto-booking
  trigger is **preserved**. Accepting a request with preferred time may still
  create a session. This differs from staging's newer explicit scheduling.
- Anonymous EXECUTE on new public RPC is false.
- Authenticated EXECUTE on new private RPC is false.
- Production notes/recovery tables and all later 14 missing foundation tables
  are **NOT** installed by this wave.
- No production Vercel/frontend promotion.
- No payments enabled.

## Do not confuse this with an overall release
The production DB still lacks significant foundation schema:
14 tables, 35 RPC signatures and 27 triggers available in staging.
This was a safe *first* additive database step only. There are still
unverified older production table-wide UPDATE/INSERT grants on
`mentorship_requests`. This wave does not claim to close them.
Direct guardian eligibility and signed AAL2 role acceptance still require
separate real-user testing, privacy-safe backup and controlled migration.
Do not copy staging migrations blindly or auto-run the review SQL as a new
migration if it has already been applied.
