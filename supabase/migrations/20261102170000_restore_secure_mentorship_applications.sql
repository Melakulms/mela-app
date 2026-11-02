-- Restore mentor application intake without granting mentor privileges.
-- Applications are private, owned by the applicant, and await independent review.
create table if not exists public.mentorship_applications (
  applicant_id uuid primary key references public.profiles(id) on delete cascade,
  headline text not null check (char_length(btrim(headline)) between 6 and 140),
  expertise text[] not null check (cardinality(expertise) between 1 and 12),
  languages text[] not null check (cardinality(languages) between 1 and 10),
  background text not null check (char_length(btrim(background)) between 30 and 3000),
  status text not null default 'pending_review'
    check (status in ('pending_review','under_review','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mentorship_applications_review_queue_idx
  on public.mentorship_applications(status,created_at);

alter table public.mentorship_applications enable row level security;
revoke all on public.mentorship_applications from public, anon, authenticated;
grant select, insert on public.mentorship_applications to authenticated;
grant all on public.mentorship_applications to service_role;

drop policy if exists mentorship_applications_self_read on public.mentorship_applications;
create policy mentorship_applications_self_read on public.mentorship_applications
  for select to authenticated
  using (applicant_id = (select auth.uid()) or (select private.is_admin_user()));

drop policy if exists mentorship_applications_self_submit on public.mentorship_applications;
create policy mentorship_applications_self_submit on public.mentorship_applications
  for insert to authenticated
  with check (
    applicant_id = (select auth.uid())
    and status = 'pending_review'
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.account_status = 'active'
        and (p.role in ('parent'::public.user_role, 'teacher'::public.user_role,
                       'company'::public.user_role, 'employer'::public.user_role)
             or (p.role = 'student'::public.user_role
                 and p.education_stage_key in ('college_tvet','university')))
    )
  );
-- No UPDATE or DELETE grant/policy to applicants: users cannot approve themselves.
-- Admin reviewers must use a separate privileged and audited approval workflow.
