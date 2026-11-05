-- STAGING ONLY. Already applied to staging Supabase on 2026-11-05.
-- Do not deploy to production via generic migration automation.
-- Anon opportunity reads previously failed because a joined employers table had no anon SELECT grant.
-- Fix without exposing private employer records to the anonymous role.

create or replace function private.mela_public_opportunity_employer_verified(p_employer_id uuid)
returns boolean language sql stable security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.employers e
    where e.id = p_employer_id
      and e.verified is true
      and e.verification_status = 'verified'
  );
$function$;

revoke all on function private.mela_public_opportunity_employer_verified(uuid) from public, anon, authenticated;
grant execute on function private.mela_public_opportunity_employer_verified(uuid) to anon, authenticated;

drop policy if exists "Opportunities readable" on public.opportunities;
create policy "Opportunities readable to anon safely"
on public.opportunities for select to anon
using (
  status = 'open' and verified_active is true
  and moderation_status = 'approved' and deadline >= current_date
  and (employer_id is null
       or private.mela_public_opportunity_employer_verified(employer_id))
);

create policy "Opportunities readable to authenticated"
on public.opportunities for select to authenticated
using (
  (
    status = 'open' and verified_active is true
    and moderation_status = 'approved' and deadline >= current_date
    and (employer_id is null
         or exists (
           select 1 from public.employers e
           where e.id=opportunities.employer_id
             and e.verified is true
             and e.verification_status='verified'
         ))
  )
  or exists (
    select 1 from public.employers e
    where e.id=opportunities.employer_id and e.owner_id=(select auth.uid())
  )
  or exists (
    select 1 from public.employer_members m
    where m.employer_id=opportunities.employer_id
      and m.user_id=(select auth.uid()) and m.status='active'
  )
  or private.is_admin_user()
);
