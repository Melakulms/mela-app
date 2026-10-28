-- STAGING ONLY: independently reviewed mentorship outcomes, NOT certificates
-- and not Career Passport awards. One claim per session per category.
create table if not exists public.mentorship_outcome_claims(
 id uuid primary key default extensions.gen_random_uuid(),
 session_id uuid not null references public.mentorship_sessions(id) on delete cascade,
 learner_id uuid not null references public.profiles(id) on delete cascade,
 mentor_id uuid not null references public.profiles(id) on delete cascade,
 category text not null check(category in
   ('academic','career','technical','business','research','other')),
 outcome_text text not null check(char_length(btrim(outcome_text)) between 20 and 2000),
 status text not null default 'submitted' check(status in
   ('submitted','mentor_supported','not_supported')),
 review_notes text,
 reviewer_id uuid references public.profiles(id),
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 unique(session_id,category),
 check(learner_id<>mentor_id),
 constraint mentorship_outcome_review_state_consistent check (
   (status='submitted' and reviewer_id is null and reviewed_at is null and review_notes is null)
   or (status in ('mentor_supported','not_supported') and reviewer_id=mentor_id
      and reviewed_at is not null and char_length(btrim(coalesce(review_notes,''))) between 20 and 2000)
 )
);
create index if not exists mentorship_outcome_by_learner_idx
 on public.mentorship_outcome_claims(learner_id,created_at desc);
create index if not exists mentorship_outcome_pending_by_mentor_idx
 on public.mentorship_outcome_claims(mentor_id,created_at desc)
 where status='submitted';
alter table public.mentorship_outcome_claims enable row level security;
revoke all on public.mentorship_outcome_claims from public,anon,authenticated;
grant select on public.mentorship_outcome_claims to authenticated;
grant insert(session_id,learner_id,mentor_id,category,outcome_text)
  on public.mentorship_outcome_claims to authenticated;
grant update(status,review_notes,reviewer_id,reviewed_at)
  on public.mentorship_outcome_claims to authenticated;

create policy mentorship_outcome_claim_participants_read
on public.mentorship_outcome_claims for select to authenticated using(
  learner_id=(select auth.uid())
  or (mentor_id=(select auth.uid()) and exists (
    select 1 from public.mentor_profiles m
    where m.user_id=mentorship_outcome_claims.mentor_id
      and m.verified and m.active))
);
create policy mentorship_outcome_learner_create
on public.mentorship_outcome_claims for insert to authenticated with check(
  learner_id=(select auth.uid()) and status='submitted'
  and review_notes is null and reviewed_at is null and reviewer_id is null
  and exists(
    select 1 from public.mentorship_sessions s
    join public.mentorship_requests r on r.id=s.request_id
    where s.id=mentorship_outcome_claims.session_id
      and s.status='completed' and s.completed_at is not null
      and r.status='accepted'
      and s.mentee_id=mentorship_outcome_claims.learner_id
      and s.mentor_id=mentorship_outcome_claims.mentor_id
      and r.mentor_id=s.mentor_id and r.mentee_id=s.mentee_id
  )
);
create policy mentorship_outcome_verified_mentor_review
on public.mentorship_outcome_claims for update to authenticated
using(
  mentor_id=(select auth.uid()) and status='submitted'
  and exists(select 1 from public.mentor_profiles m
    where m.user_id=mentorship_outcome_claims.mentor_id
    and m.verified and m.active)
)
with check(
  mentor_id=(select auth.uid()) and status in ('mentor_supported','not_supported')
  and reviewer_id=(select auth.uid())
  and exists(select 1 from public.mentor_profiles m
    where m.user_id=mentorship_outcome_claims.mentor_id
    and m.verified and m.active)
);

create or replace function private.guard_mentorship_outcome_claim()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare
  v_actor uuid := (select auth.uid());
begin
 if v_actor is null then raise exception 'signed-in mentorship participant required';end if;
 if tg_op='INSERT' then
   if v_actor is distinct from new.learner_id or new.status<>'submitted'
      or new.reviewed_at is not null or new.reviewer_id is not null
      or new.review_notes is not null then
      raise exception 'only the learner can submit an unreviewed outcome';
   end if;
 elsif tg_op='UPDATE' then
   if v_actor is distinct from old.mentor_id or old.status<>'submitted'
     or new.status not in ('mentor_supported','not_supported')
     or new.id is distinct from old.id
     or new.session_id is distinct from old.session_id
     or new.learner_id is distinct from old.learner_id
     or new.mentor_id is distinct from old.mentor_id
     or new.category is distinct from old.category
     or new.outcome_text is distinct from old.outcome_text
     or new.created_at is distinct from old.created_at
     or new.reviewer_id is distinct from v_actor
     or new.reviewed_at is null
     or char_length(btrim(coalesce(new.review_notes,''))) not between 20 and 2000 then
     raise exception 'only assigned verified mentor may review an unchanged learner claim once';
   end if;
 end if;

 if not exists (
   select 1 from public.mentorship_sessions s
   join public.mentorship_requests r on r.id=s.request_id
   join public.mentor_profiles m on m.user_id=s.mentor_id
   join public.profiles p on p.id=s.mentee_id
   where s.id=new.session_id
     and s.status='completed' and s.completed_at is not null
     and s.mentor_id=new.mentor_id and s.mentee_id=new.learner_id
     and r.status='accepted' and r.id=s.request_id
     and r.mentor_id=s.mentor_id and r.mentee_id=s.mentee_id
     and m.verified and m.active
     and p.role='student' and p.account_status='active' and p.deleted_at is null
 ) or not private.user_has_guardian_or_adult_clearance(new.learner_id) then
   raise exception 'completed accepted mentorship with current verified learner clearance required';
 end if;
 return new;
end;
$fn$;
revoke all on function private.guard_mentorship_outcome_claim()
 from public,anon,authenticated;
create trigger trg_guard_mentorship_outcome_claim
 before insert or update on public.mentorship_outcome_claims
 for each row execute function private.guard_mentorship_outcome_claim();
