-- MELA account-owned settings. Every row is private to its authenticated owner.
-- Deploy this before enabling the signed-in settings editor.
-- No privileged role fields, payment controls or guardian consent are exposed here.
create table if not exists public.mela_user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('system','dark','light')),
  large_text boolean not null default false,
  high_contrast boolean not null default false,
  reduced_motion boolean not null default false,
  notify_courses boolean not null default true,
  notify_competitions boolean not null default true,
  notify_opportunities boolean not null default true,
  notify_messages boolean not null default true,
  study_reminders boolean not null default false,
  daily_study_minutes integer not null default 20 check (daily_study_minutes between 5 and 240),
  updated_at timestamptz not null default now()
);

alter table public.mela_user_settings enable row level security;
revoke all on table public.mela_user_settings from public, anon, authenticated;
grant select, insert, update, delete on table public.mela_user_settings to authenticated;
grant all on table public.mela_user_settings to service_role;

drop policy if exists "mela_user_settings_select_self" on public.mela_user_settings;
create policy "mela_user_settings_select_self"
on public.mela_user_settings for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "mela_user_settings_insert_self" on public.mela_user_settings;
create policy "mela_user_settings_insert_self"
on public.mela_user_settings for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "mela_user_settings_update_self" on public.mela_user_settings;
create policy "mela_user_settings_update_self"
on public.mela_user_settings for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "mela_user_settings_delete_self" on public.mela_user_settings;
create policy "mela_user_settings_delete_self"
on public.mela_user_settings for delete to authenticated
using (user_id = (select auth.uid()));

comment on table public.mela_user_settings is
'Personal settings owned by authenticated users. Notification preferences must also be respected by notification delivery workers before production use.';
