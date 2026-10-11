-- Optional learner discovery settings. Avoids mixing marketing preferences with the
-- verified academic profile or existing student_profiles.subjects contract.
create table if not exists public.mela_learner_discovery_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferred_program_keys text[] not null default '{}'::text[],
  interest_fields text[] not null default '{}'::text[],
  preferred_study_countries text[] not null default '{}'::text[],
  target_degree_level text not null default 'any'
    check (target_degree_level in ('any', 'high_school', 'diploma', 'bachelor', 'master', 'doctorate')),
  learning_goal text not null default '' check (char_length(learning_goal) <= 300),
  enable_suggestions boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint limited_programs check (cardinality(preferred_program_keys) <= 30),
  constraint limited_interests check (cardinality(interest_fields) <= 15),
  constraint limited_countries check (cardinality(preferred_study_countries) <= 10)
);
alter table public.mela_learner_discovery_preferences enable row level security;

revoke all on public.mela_learner_discovery_preferences from public, anon, authenticated;
grant select, insert, update, delete on public.mela_learner_discovery_preferences to authenticated;
grant all on public.mela_learner_discovery_preferences to service_role;

create policy "learner_discovery_select_own"
on public.mela_learner_discovery_preferences for select to authenticated
using (user_id = (select auth.uid()) and exists
  (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'student'));

create policy "learner_discovery_insert_own"
on public.mela_learner_discovery_preferences for insert to authenticated
with check (user_id = (select auth.uid()) and exists
  (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'student'));

create policy "learner_discovery_update_own"
on public.mela_learner_discovery_preferences for update to authenticated
using (user_id = (select auth.uid()) and exists
  (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'student'))
with check (user_id = (select auth.uid()) and exists
  (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'student'));

create policy "learner_discovery_delete_own"
on public.mela_learner_discovery_preferences for delete to authenticated
using (user_id = (select auth.uid()) and exists
  (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'student'));

comment on table public.mela_learner_discovery_preferences is
'Optional private learner interests and exact grade curriculum selection; not eligibility verification. Never use as an authorization source.';
