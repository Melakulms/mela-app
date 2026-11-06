-- STAGING ONLY; explicit rollback for 2026-11-05 anon opportunity access change.
-- WARNING: This restores the original anonymous-read permission defect.
-- Review real users and test rollback in a transaction before applying.
drop policy if exists "Opportunities readable to anon safely" on public.opportunities;
drop policy if exists "Opportunities readable to authenticated" on public.opportunities;
create policy "Opportunities readable" on public.opportunities
for select to anon, authenticated
using (
  (
    status = 'open' and verified_active = true and moderation_status = 'approved'
    and deadline >= current_date
    and (
      employer_id is null
      or exists (
        select 1 from public.employers e where e.id=opportunities.employer_id
        and e.verified=true and e.verification_status='verified'
      )
    )
  )
  or exists (select 1 from public.employers e
    where e.id=opportunities.employer_id and e.owner_id=(select auth.uid()))
  or exists (select 1 from public.employer_members m
    where m.employer_id=opportunities.employer_id
    and m.user_id=(select auth.uid()) and m.status='active')
  or private.is_admin_user()
);
revoke all on function private.mela_public_opportunity_employer_verified(uuid)
  from public, anon, authenticated;
drop function if exists private.mela_public_opportunity_employer_verified(uuid);
