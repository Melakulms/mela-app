-- Registration/employer security hardening: only verified employers may create/update opportunities.
drop policy if exists "Employer teams create opportunities" on public.opportunities;
create policy "Employer teams create opportunities"
on public.opportunities
for insert to authenticated
with check (
  posted_by = (select auth.uid())
  and employer_id is not null
  and (
    exists (
      select 1 from public.employers e
      where e.id = opportunities.employer_id
        and e.owner_id = (select auth.uid())
        and e.verified = true
        and e.verification_status = 'approved'
    )
    or exists (
      select 1
      from public.employer_members m
      join public.employers e on e.id = m.employer_id
      where m.employer_id = opportunities.employer_id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
        and m.member_role = any(array['recruiter','hiring_manager','admin'])
        and e.verified = true
        and e.verification_status = 'approved'
    )
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  )
);

drop policy if exists "Employer teams update opportunities" on public.opportunities;
create policy "Employer teams update opportunities"
on public.opportunities
for update to authenticated
using (
  exists (
    select 1 from public.employers e
    where e.id = opportunities.employer_id
      and e.owner_id = (select auth.uid())
      and e.verified = true
      and e.verification_status = 'approved'
  )
  or exists (
    select 1
    from public.employer_members m
    join public.employers e on e.id = m.employer_id
    where m.employer_id = opportunities.employer_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.member_role = any(array['recruiter','hiring_manager','admin'])
      and e.verified = true
      and e.verification_status = 'approved'
  )
  or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.employers e
    where e.id = opportunities.employer_id
      and e.owner_id = (select auth.uid())
      and e.verified = true
      and e.verification_status = 'approved'
  )
  or exists (
    select 1
    from public.employer_members m
    join public.employers e on e.id = m.employer_id
    where m.employer_id = opportunities.employer_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.member_role = any(array['recruiter','hiring_manager','admin'])
      and e.verified = true
      and e.verification_status = 'approved'
  )
  or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  )
);