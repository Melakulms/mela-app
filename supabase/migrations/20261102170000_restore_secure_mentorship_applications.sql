-- Restore the missing production mentor application intake.
-- A stricter mentor application table already exists on staging.
-- Never alter that schema or its MFA/independently-verified adult policies.
do $migration$
begin
  if to_regclass('public.mentorship_applications') is null then
    execute $table$
      create table public.mentorship_applications (
        id uuid primary key default gen_random_uuid(),
        applicant_id uuid not null unique references public.profiles(id) on delete cascade,
        headline text not null check (char_length(btrim(headline)) between 6 and 140),
        expertise text[] not null default '{}'::text[] check (cardinality(expertise) between 1 and 12),
        languages text[] not null default '{}'::text[] check (cardinality(languages) between 1 and 10),
        background text not null check (char_length(btrim(background)) between 30 and 3000),
        status text not null default 'pending_review'
          check (status in ('pending_review','reviewed_eligible','rejected')),
        review_notes text,
        reviewed_by uuid references public.profiles(id),
        reviewed_at timestamptz,
        submitted_at timestamptz not null default now()
      )
    $table$;
    execute 'create index mentorship_applications_review_queue_idx on public.mentorship_applications(status,submitted_at)';
    execute 'alter table public.mentorship_applications enable row level security';
    execute 'revoke all on public.mentorship_applications from public, anon, authenticated';
    execute 'grant select, insert on public.mentorship_applications to authenticated';
    -- Only MFA-approved admins may update review fields. No update to applicant data.
    execute 'grant update(status,review_notes,reviewed_at,reviewed_by) on public.mentorship_applications to authenticated';
    execute 'grant all on public.mentorship_applications to service_role';

    execute $read$
      create policy mentorship_applications_self_or_admin_read on public.mentorship_applications
      for select to authenticated
      using (applicant_id = (select auth.uid()) or (select private.is_admin_user()))
    $read$;

    execute $submit$
      create policy mentorship_applications_eligible_adult_submit on public.mentorship_applications
      for insert to authenticated
      with check (
        applicant_id = (select auth.uid())
        and status = 'pending_review'
        and reviewed_by is null and reviewed_at is null and review_notes is null
        and exists (
          select 1 from public.profiles p
          where p.id = (select auth.uid()) and p.account_status = 'active'
            and p.deleted_at is null
            and (
              (p.role = 'teacher'::public.user_role and exists (
                select 1 from public.teacher_profiles t
                where t.user_id = p.id and t.verification_status in ('approved','verified')
              ))
              or
              -- Submission only, not evidence of adulthood or permission to mentor.
              -- Reviewer must independently check age and qualifications before approval.
              (p.role = 'student'::public.user_role
                and p.education_stage_key in ('university','college_tvet')
                and exists (
                  select 1 from public.student_profiles sp
                  where sp.user_id = p.id
                    and sp.date_of_birth <= current_date - interval '18 years'
                ))
            )
        )
      )
    $submit$;

    execute $review$
      create policy mentorship_applications_admin_review on public.mentorship_applications
      for update to authenticated
      using ((select private.is_admin_user()) and (auth.jwt()->>'aal') = 'aal2')
      with check ((select private.is_admin_user()) and (auth.jwt()->>'aal') = 'aal2')
    $review$;
  end if;
end
$migration$;
-- Application review never updates a role, approves a mentor profile, or creates a booking.
