-- STAGING ONLY. Read-only regression. Run as one complete transaction.
-- No eligible public opportunity rows existed on 2026-11-05; these checks
-- establish error-free queries, RLS restrictions and grants, not real Android listings.
-- The private helper is deliberately not directly callable from anon's schema.
begin;
set local role anon;
select count(*) as anon_opportunities_should_not_error from public.opportunities;
select count(*) as anon_screening_questions_should_not_error from public.opportunity_screening_questions;
select count(*) as incorrectly_visible
  from public.opportunities
 where status <> 'open' or verified_active is distinct from true
    or moderation_status <> 'approved' or deadline < current_date;
select has_table_privilege(current_user,'public.employers','SELECT') as must_be_false;
rollback;

begin;
set local role authenticated;
select count(*) as auth_opportunities_should_not_error from public.opportunities;
rollback;

-- Privileged structural test: unknown employer IDs must never verify.
select private.mela_public_opportunity_employer_verified(
 '00000000-0000-0000-0000-000000000000'::uuid
) as unknown_employer_must_be_false;
