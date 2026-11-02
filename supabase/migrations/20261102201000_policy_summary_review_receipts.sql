-- Record user-initiated review of MELA's currently displayed policy summaries.
-- These records are NOT final Terms acceptance, informed privacy consent,
-- guardian authorization or legal certification. Keep them separate from
-- public.user_policy_acknowledgements until complete approved policies exist.
create table if not exists public.policy_summary_review_receipts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  policy_key text not null check (policy_key in ('terms','privacy')),
  policy_version text not null,
  review_kind text not null default 'draft_summary' check (review_kind='draft_summary'),
  reviewed_at timestamptz not null default now(),
  primary key(user_id,policy_key,policy_version,review_kind),
  foreign key(policy_key,policy_version)
    references public.policy_documents(policy_key,version) on update cascade on delete restrict
);
alter table public.policy_summary_review_receipts enable row level security;
revoke all on public.policy_summary_review_receipts from public,anon,authenticated;
grant select,insert on public.policy_summary_review_receipts to authenticated;
grant all on public.policy_summary_review_receipts to service_role;
drop policy if exists policy_summary_self_read on public.policy_summary_review_receipts;
create policy policy_summary_self_read on public.policy_summary_review_receipts
for select to authenticated
using(user_id=(select auth.uid()));
drop policy if exists policy_summary_self_create on public.policy_summary_review_receipts;
create policy policy_summary_self_create on public.policy_summary_review_receipts
for insert to authenticated
with check (
  user_id=(select auth.uid()) and review_kind='draft_summary'
  and exists (select 1 from public.policy_documents p
    where p.policy_key=policy_summary_review_receipts.policy_key
      and p.version=policy_summary_review_receipts.policy_version and p.status='active')
  and exists (select 1 from public.profiles u where u.id=(select auth.uid())
    and u.account_status='active' and u.deleted_at is null)
);
