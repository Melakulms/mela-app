-- Applied and audited on MELA staging as migration 20261101194547.
-- Separate, non-sensitive onboarding drafts; they never confer approval, consent,
-- role membership, payment entitlement or professional privileges.
create table if not exists public.profile_onboarding_drafts (
 user_id uuid not null references public.profiles(id) on delete cascade,
 role text not null check (role in ('parent','teacher','company')),
 draft jsonb not null default '{}'::jsonb
   check (jsonb_typeof(draft)='object' and octet_length(draft::text) <= 8192),
 updated_at timestamptz not null default now(),
 primary key(user_id,role)
);
alter table public.profile_onboarding_drafts enable row level security;
revoke all on public.profile_onboarding_drafts from public, anon;
grant select,insert,update,delete on public.profile_onboarding_drafts to authenticated;
drop policy if exists profile_onboarding_drafts_self_read on public.profile_onboarding_drafts;
create policy profile_onboarding_drafts_self_read on public.profile_onboarding_drafts for select to authenticated
 using (user_id=(select auth.uid()) and exists (
   select 1 from public.profiles p where p.id=(select auth.uid()) and p.role::text=profile_onboarding_drafts.role and p.account_status='active'
 ));
drop policy if exists profile_onboarding_drafts_self_insert on public.profile_onboarding_drafts;
create policy profile_onboarding_drafts_self_insert on public.profile_onboarding_drafts for insert to authenticated
 with check (user_id=(select auth.uid()) and exists (
   select 1 from public.profiles p where p.id=(select auth.uid()) and p.role::text=profile_onboarding_drafts.role and p.account_status='active'
 ));
drop policy if exists profile_onboarding_drafts_self_update on public.profile_onboarding_drafts;
create policy profile_onboarding_drafts_self_update on public.profile_onboarding_drafts for update to authenticated
 using (user_id=(select auth.uid()) and exists (
   select 1 from public.profiles p where p.id=(select auth.uid()) and p.role::text=profile_onboarding_drafts.role and p.account_status='active'
 ))
 with check (user_id=(select auth.uid()) and exists (
   select 1 from public.profiles p where p.id=(select auth.uid()) and p.role::text=profile_onboarding_drafts.role and p.account_status='active'
 ));
drop policy if exists profile_onboarding_drafts_self_delete on public.profile_onboarding_drafts;
create policy profile_onboarding_drafts_self_delete on public.profile_onboarding_drafts for delete to authenticated
 using (user_id=(select auth.uid()) and exists (
   select 1 from public.profiles p where p.id=(select auth.uid()) and p.role::text=profile_onboarding_drafts.role and p.account_status='active'
 ));
