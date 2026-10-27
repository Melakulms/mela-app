-- Mentor applications are not verified mentor profiles.
-- Applications contain self-reported information; separate credential review remains mandatory.
create table if not exists public.mentorship_applications (
  id uuid primary key default extensions.gen_random_uuid(),
  applicant_id uuid not null unique references public.profiles(id) on delete cascade,
  headline text not null check (char_length(btrim(headline)) between 6 and 140),
  expertise text[] not null default '{}'::text[] check (cardinality(expertise) between 1 and 12),
  languages text[] not null default '{}'::text[] check (cardinality(languages) between 1 and 10),
  background text not null check (char_length(btrim(background)) between 30 and 3000),
  status text not null default 'pending_review' check (status in ('pending_review','reviewed_eligible','rejected')),
  review_notes text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  submitted_at timestamptz not null default now()
);
create index if not exists mentorship_applications_status_idx on public.mentorship_applications(status,submitted_at desc);
alter table public.mentorship_applications enable row level security;
create policy mentorship_applications_self_or_admin_read on public.mentorship_applications
  for select to authenticated using (applicant_id=(select auth.uid()) or private.is_admin_user());
create policy mentorship_applications_eligible_adult_submit on public.mentorship_applications
  for insert to authenticated with check (
    applicant_id=(select auth.uid()) and status='pending_review'
    and reviewed_by is null and reviewed_at is null and review_notes is null
    and exists (select 1 from public.profiles p
      where p.id=applicant_id and p.deleted_at is null and p.account_status='active'
      and ((p.role='student' and p.education_stage_key in ('college_tvet','university') and public.is_adult(p.id))
        or (p.role='teacher' and exists (
          select 1 from public.teacher_profiles tp
          where tp.user_id=p.id and tp.verification_status in ('approved','verified')))))
  );
create policy mentorship_applications_admin_review on public.mentorship_applications
  for update to authenticated using (private.is_admin_user() and (auth.jwt()->>'aal')='aal2')
  with check (private.is_admin_user() and (auth.jwt()->>'aal')='aal2');
revoke all on public.mentorship_applications from anon,authenticated;
grant select on public.mentorship_applications to authenticated;
grant insert (applicant_id,headline,expertise,languages,background) on public.mentorship_applications to authenticated;
grant update (status,review_notes,reviewed_by,reviewed_at) on public.mentorship_applications to authenticated;
-- Approval is only permission to proceed to credential verification, NOT a verified mentor listing.
