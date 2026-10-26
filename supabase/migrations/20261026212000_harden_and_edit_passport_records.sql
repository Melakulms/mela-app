-- Career Passport self-reported record integrity (staging-first rollout).
-- Creation/update is owner-scoped by existing RLS policies. Verification is reviewer-only.
create or replace function private.enforce_passport_record_integrity()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare
  reviewer boolean := coalesce(private.is_admin_user(), false);
  verification_changed boolean;
begin
  if tg_table_schema <> 'public' or tg_table_name not in ('profile_education','profile_experience') then
    raise exception 'unsupported passport record';
  end if;
  if tg_op = 'INSERT' then
    if not reviewer and (
      new.verified or new.verification_source is not null or
      new.verification_notes is not null or new.verified_at is not null or new.verified_by is not null
    ) then
      raise exception 'passport verification is reviewer managed' using errcode='42501';
    end if;
    if reviewer and new.verified and auth.uid() is not null then
      new.verified_by := auth.uid(); new.verified_at := now();
    end if;
  elsif tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id or new.id is distinct from old.id then
      raise exception 'passport record ownership cannot be changed' using errcode='42501';
    end if;
    verification_changed := row(new.verified,new.verification_source,new.verification_notes,new.verified_at,new.verified_by)
      is distinct from row(old.verified,old.verification_source,old.verification_notes,old.verified_at,old.verified_by);
    if not reviewer then
      if verification_changed then
        raise exception 'passport verification is reviewer managed' using errcode='42501';
      end if;
      if old.verified and
        (to_jsonb(new) - array['is_public','updated_at']) is distinct from
        (to_jsonb(old) - array['is_public','updated_at'])
      then
        raise exception 'verified passport records require reviewer correction' using errcode='42501';
      end if;
    elsif verification_changed and auth.uid() is not null then
      new.verified_by := auth.uid(); new.verified_at := now();
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$function$;

revoke all on function private.enforce_passport_record_integrity() from public, anon, authenticated;

drop trigger if exists trg_passport_record_integrity on public.profile_education;
create trigger trg_passport_record_integrity before insert or update on public.profile_education
  for each row execute function private.enforce_passport_record_integrity();

drop trigger if exists trg_passport_record_integrity on public.profile_experience;
create trigger trg_passport_record_integrity before insert or update on public.profile_experience
  for each row execute function private.enforce_passport_record_integrity();

-- New records must not be implicitly advertised to employers.
alter table public.profile_education alter column is_public set default false;
alter table public.profile_experience alter column is_public set default false;
alter table public.profile_projects alter column is_public set default false;

-- A record is shareable only for a confirmed adult learner who is no longer
-- in a Grade 1-12 profile. Missing birth dates fail closed, including TVET/university.
create or replace function private.passport_is_adult(p_user_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $function$
  select exists (
    select 1 from public.profiles p
    join public.student_profiles s on s.user_id = p.id
    where p.id = p_user_id and p.role::text = 'student'
      and coalesce(p.education_stage_key::text, '') in ('university','college_tvet')
      and (p.grade_level is null or p.grade_level not between 1 and 12)
      and s.date_of_birth is not null
      and s.date_of_birth <= (current_date - interval '18 years')::date
  )
$function$;
revoke all on function private.passport_is_adult(uuid) from public, anon, authenticated;
grant execute on function private.passport_is_adult(uuid) to authenticated;

create or replace function private.prevent_school_passport_publication()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  if tg_table_schema <> 'public' or tg_table_name not in
      ('profile_education','profile_experience','profile_projects') then
    raise exception 'unsupported portfolio record';
  end if;
  if new.is_public and exists (
    select 1 from public.profiles p
    where p.id = new.user_id and p.role::text = 'student'
      and not private.passport_is_adult(new.user_id)
  ) then
    raise exception 'Age-unconfirmed and school learners cannot publish Career Passport records'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;
revoke all on function private.prevent_school_passport_publication() from public, anon, authenticated;

drop trigger if exists trg_passport_school_privacy on public.profile_education;
create trigger trg_passport_school_privacy before insert or update on public.profile_education
  for each row execute function private.prevent_school_passport_publication();
drop trigger if exists trg_passport_school_privacy on public.profile_experience;
create trigger trg_passport_school_privacy before insert or update on public.profile_experience
  for each row execute function private.prevent_school_passport_publication();
drop trigger if exists trg_passport_school_privacy on public.profile_projects;
create trigger trg_passport_school_privacy before insert or update on public.profile_projects
  for each row execute function private.prevent_school_passport_publication();

-- Existing public legacy rows for children must also be hidden from employers.
-- Keep owner access, and retain the previously permitted admin public review path.
drop policy if exists "Education readable by owner or employer" on public.profile_education;
create policy "Education readable by owner or employer" on public.profile_education
for select to authenticated
using (
  user_id = (select auth.uid())
  or (is_public and exists (
    select 1 from public.profiles viewer
    where viewer.id = (select auth.uid()) and
      (viewer.role::text = 'admin' or
       (viewer.role::text = 'employer' and private.passport_is_adult(profile_education.user_id)))
  ))
);

drop policy if exists "Experience readable by owner or employer" on public.profile_experience;
create policy "Experience readable by owner or employer" on public.profile_experience
for select to authenticated
using (
  user_id = (select auth.uid())
  or (is_public and exists (
    select 1 from public.profiles viewer
    where viewer.id = (select auth.uid()) and
      (viewer.role::text = 'admin' or
       (viewer.role::text = 'employer' and private.passport_is_adult(profile_experience.user_id)))
  ))
);

drop policy if exists "Projects readable by owner or employer" on public.profile_projects;
create policy "Projects readable by owner or employer" on public.profile_projects
for select to authenticated
using (
  user_id = (select auth.uid())
  or (is_public and exists (
    select 1 from public.profiles viewer
    where viewer.id = (select auth.uid()) and
      (viewer.role::text = 'admin' or
       (viewer.role::text = 'employer' and private.passport_is_adult(profile_projects.user_id)))
  ))
);

-- UPDATE is needed for the owner editor, with verification columns still protected by triggers.
-- Existing SELECT/UPDATE RLS restricts both the old and new user_id to auth.uid().
grant update (institution,qualification,field_of_study,start_year,end_year,is_current,grade,description,is_public)
  on public.profile_education to authenticated;
grant update (organization,title,experience_type,start_date,end_date,is_current,description,is_public)
  on public.profile_experience to authenticated;
