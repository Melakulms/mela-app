-- Production user information. Self-reported answers never confer authorization.
create function public.user_information_valid(p_role text, p_details jsonb, p_complete boolean)
returns boolean language plpgsql immutable security invoker set search_path = '' as $fn$
declare
  spec jsonb := $spec${"student": {"age_group": {"required": true, "max": 250, "options": ["Under 13", "13–17", "18 or older"]}, "preferred_language": {"required": true, "max": 250, "options": ["English", "Amharic", "Afaan Oromo", "Tigrinya", "Somali"]}, "display_name": {"required": false, "max": 100}, "accessibility": {"required": false, "max": 500}, "notice_acknowledged": {"required": true, "max": 250, "options": ["Yes"]}, "learning_goal": {"required": true, "max": 250, "options": ["Improve school results", "Prepare for exams", "Build practical skills", "Explore careers", "Prepare for scholarships"]}}, "parent": {"age_group": {"required": true, "max": 250, "options": ["18 or older"]}, "preferred_language": {"required": true, "max": 250, "options": ["English", "Amharic", "Afaan Oromo", "Tigrinya", "Somali"]}, "display_name": {"required": false, "max": 100}, "accessibility": {"required": false, "max": 500}, "notice_acknowledged": {"required": true, "max": 250, "options": ["Yes"]}, "guardian_relationship": {"required": true, "max": 250, "options": ["Parent", "Legal guardian", "Other family member"]}}, "teacher": {"age_group": {"required": true, "max": 250, "options": ["18 or older"]}, "preferred_language": {"required": true, "max": 250, "options": ["English", "Amharic", "Afaan Oromo", "Tigrinya", "Somali"]}, "display_name": {"required": false, "max": 100}, "accessibility": {"required": false, "max": 500}, "notice_acknowledged": {"required": true, "max": 250, "options": ["Yes"]}, "teaching_languages": {"required": true, "max": 250}}, "company": {"age_group": {"required": true, "max": 250, "options": ["18 or older"]}, "preferred_language": {"required": true, "max": 250, "options": ["English", "Amharic", "Afaan Oromo", "Tigrinya", "Somali"]}, "display_name": {"required": false, "max": 100}, "accessibility": {"required": false, "max": 500}, "notice_acknowledged": {"required": true, "max": 250, "options": ["Yes"]}, "organization_type": {"required": true, "max": 250, "options": ["Business", "School or university", "Nonprofit", "Government", "Independent professional", "Other organization"]}, "representative_title": {"required": true, "max": 250}, "operating_location": {"required": true, "max": 250}, "partnership_purpose": {"required": true, "max": 250, "options": ["Jobs and internships", "Scholarships", "Training", "Sponsorship", "Multiple opportunities"]}}, "employer": {"age_group": {"required": true, "max": 250, "options": ["18 or older"]}, "preferred_language": {"required": true, "max": 250, "options": ["English", "Amharic", "Afaan Oromo", "Tigrinya", "Somali"]}, "display_name": {"required": false, "max": 100}, "accessibility": {"required": false, "max": 500}, "notice_acknowledged": {"required": true, "max": 250, "options": ["Yes"]}, "organization_type": {"required": true, "max": 250, "options": ["Business", "School or university", "Nonprofit", "Government", "Independent professional", "Other organization"]}, "representative_title": {"required": true, "max": 250}, "operating_location": {"required": true, "max": 250}, "partnership_purpose": {"required": true, "max": 250, "options": ["Jobs and internships", "Scholarships", "Training", "Sponsorship", "Multiple opportunities"]}}, "partner": {"age_group": {"required": true, "max": 250, "options": ["18 or older"]}, "preferred_language": {"required": true, "max": 250, "options": ["English", "Amharic", "Afaan Oromo", "Tigrinya", "Somali"]}, "display_name": {"required": false, "max": 100}, "accessibility": {"required": false, "max": 500}, "notice_acknowledged": {"required": true, "max": 250, "options": ["Yes"]}, "organization_type": {"required": true, "max": 250, "options": ["Business", "School or university", "Nonprofit", "Government", "Independent professional", "Other organization"]}, "representative_title": {"required": true, "max": 250}, "operating_location": {"required": true, "max": 250}, "partnership_purpose": {"required": true, "max": 250, "options": ["Jobs and internships", "Scholarships", "Training", "Sponsorship", "Multiple opportunities"]}, "organization_name": {"required": true, "max": 250}, "industry": {"required": true, "max": 250}, "organization_description": {"required": true, "max": 1500}}, "mentor": {"age_group": {"required": true, "max": 250, "options": ["18 or older"]}, "preferred_language": {"required": true, "max": 250, "options": ["English", "Amharic", "Afaan Oromo", "Tigrinya", "Somali"]}, "display_name": {"required": false, "max": 100}, "accessibility": {"required": false, "max": 500}, "notice_acknowledged": {"required": true, "max": 250, "options": ["Yes"]}, "professional_title": {"required": true, "max": 250}, "expertise": {"required": true, "max": 250}, "qualification": {"required": true, "max": 250}, "experience": {"required": true, "max": 1500}, "languages": {"required": true, "max": 250}, "learner_groups": {"required": true, "max": 250, "options": ["Adults only", "School learners with safeguarding approval", "Both, subject to safeguarding approval"]}, "biography": {"required": true, "max": 1500}, "availability": {"required": true, "max": 250}, "timezone": {"required": true, "max": 250, "options": ["Africa/Addis_Ababa", "UTC", "Other — confirm with MELA before booking"]}, "session_format": {"required": true, "max": 250, "options": ["Online", "In person through an approved program", "Both"]}, "conduct_agreement": {"required": true, "max": 250, "options": ["Yes"]}}}$spec$::jsonb -> p_role;
  field record;
  val text;
begin
  if spec is null or p_details is null or jsonb_typeof(p_details) <> 'object' or p_complete is null then return false; end if;
  if octet_length(p_details::text) > 20000 then return false; end if;
  for field in select key,value from jsonb_each(p_details) loop
    if not (spec ? field.key) or jsonb_typeof(field.value) <> 'string' then return false; end if;
  end loop;
  for field in select key,value from jsonb_each(spec) loop
    val := btrim(coalesce(p_details->>field.key,''));
    if p_complete and (field.value->>'required')::boolean and val = '' then return false; end if;
    if length(val) > (field.value->>'max')::integer then return false; end if;
    if val <> '' and field.value ? 'options' and not ((field.value->'options') ? val) then return false; end if;
  end loop;
  return true;
end
$fn$;
revoke all on function public.user_information_valid(text,jsonb,boolean) from public, anon;
grant execute on function public.user_information_valid(text,jsonb,boolean) to authenticated, service_role;

create table public.user_information (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 role text not null check (role in ('student','parent','teacher','company','employer','mentor','partner')),
 details jsonb not null default '{}'::jsonb,
 completed boolean not null default false,
 notice_version text not null check (notice_version = '2026-11-01-v1'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 completed_at timestamptz,
 constraint user_information_valid_answers check (public.user_information_valid(role,details,completed))
);
alter table public.user_information enable row level security;
revoke all on public.user_information from public, anon, authenticated;
grant select on public.user_information to authenticated;
grant insert (user_id,role,details,completed,notice_version) on public.user_information to authenticated;
grant update (user_id,role,details,completed,notice_version) on public.user_information to authenticated;
grant all on public.user_information to service_role;
create policy user_information_read_own on public.user_information for select to authenticated
 using (user_id = (select auth.uid()));
create policy user_information_insert_own on public.user_information for insert to authenticated
 with check (user_id = (select auth.uid()) and exists (
 select 1 from public.profiles p where p.id = (select auth.uid()) and p.role::text = user_information.role and p.account_status = 'active'));
create policy user_information_update_own on public.user_information for update to authenticated
 using (user_id = (select auth.uid()))
 with check (user_id = (select auth.uid()) and exists (
 select 1 from public.profiles p where p.id = (select auth.uid()) and p.role::text = user_information.role and p.account_status = 'active'));
create function public.user_information_timestamps() returns trigger language plpgsql security invoker set search_path = '' as $fn$
begin
 new.updated_at := now();
 new.completed_at := case when new.completed then now() else null end;
 return new;
end
$fn$;
revoke all on function public.user_information_timestamps() from public,anon,authenticated;
create trigger user_information_timestamps before insert or update on public.user_information for each row execute function public.user_information_timestamps();
comment on table public.user_information is 'Private, self-reported onboarding data. Never use completion, age group or selected expertise as verification or permission grants.';
