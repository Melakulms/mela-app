-- RELEASE CANDIDATE, NOT AUTO-MIGRATED. MELA Mentorship Section 11.
-- Production: NO EXECUTION until authentic user, guardian and MFA review gates pass.
-- Do not reapply to STAGING: it already has the established Section 11 tables.
-- No payment collection, video or professional certification changes.
-- Requires existing public.mentor_profiles, mentorship_requests, profiles,
-- student_profiles and guardian_relationships.
-- All operations are additive; previous mentorship records are untouched.

create table public.mentorship_assignments (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.mentorship_requests(id) on delete cascade,
 mentor_id uuid not null references public.mentor_profiles(user_id),
 learner_id uuid not null references public.profiles(id) on delete cascade,
 title text not null check(char_length(btrim(title)) between 3 and 160),
 instructions text not null check(char_length(btrim(instructions)) between 10 and 4000),
 due_at timestamptz,
 created_at timestamptz not null default now(),
 constraint mentorship_assignments_distinct_actors check(mentor_id<>learner_id)
);
create index mentorship_assignments_by_learner on public.mentorship_assignments(learner_id,created_at desc);
create index mentorship_assignments_by_mentor on public.mentorship_assignments(mentor_id,created_at desc);

create table public.mentorship_submissions (
 id uuid primary key default gen_random_uuid(),
 assignment_id uuid not null references public.mentorship_assignments(id) on delete cascade,
 learner_id uuid not null references public.profiles(id) on delete cascade,
 response text not null check(char_length(btrim(response)) between 2 and 4000),
 created_at timestamptz not null default now(),
 constraint mentorship_one_original_response unique(assignment_id,learner_id)
);
create index mentorship_submissions_by_assignment on public.mentorship_submissions(assignment_id);

create table public.mentorship_feedback (
 id uuid primary key default gen_random_uuid(),
 assignment_id uuid not null unique references public.mentorship_assignments(id) on delete cascade,
 mentor_id uuid not null references public.mentor_profiles(user_id),
 feedback text not null check(char_length(btrim(feedback)) between 2 and 4000),
 created_at timestamptz not null default now()
);

alter table public.mentorship_assignments enable row level security;
alter table public.mentorship_submissions enable row level security;
alter table public.mentorship_feedback enable row level security;

revoke all on public.mentorship_assignments from public,anon,authenticated;
revoke all on public.mentorship_submissions from public,anon,authenticated;
revoke all on public.mentorship_feedback from public,anon,authenticated;
grant select on public.mentorship_assignments to authenticated;
grant select on public.mentorship_submissions to authenticated;
grant select on public.mentorship_feedback to authenticated;
grant insert(request_id,mentor_id,learner_id,title,instructions,due_at) on public.mentorship_assignments to authenticated;
grant insert(assignment_id,learner_id,response) on public.mentorship_submissions to authenticated;
grant insert(assignment_id,mentor_id,feedback) on public.mentorship_feedback to authenticated;

create policy mentorship_assignments_actors_read on public.mentorship_assignments for select to authenticated
using (
 learner_id=(select auth.uid()) or
 (mentor_id=(select auth.uid()) and exists(select 1 from public.mentor_profiles m
   where m.user_id=mentorship_assignments.mentor_id and m.active and m.verified))
);
create policy mentorship_assignments_mentor_insert on public.mentorship_assignments for insert to authenticated
with check (
 mentor_id=(select auth.uid()) and learner_id<>mentor_id
 and exists(select 1 from public.mentor_profiles m where m.user_id=mentorship_assignments.mentor_id and m.active and m.verified)
 and exists(select 1 from public.mentorship_requests r where r.id=mentorship_assignments.request_id
   and r.mentor_id=mentorship_assignments.mentor_id and r.mentee_id=mentorship_assignments.learner_id and r.status='accepted')
);

create policy mentorship_submissions_actors_read on public.mentorship_submissions for select to authenticated
using (
 learner_id=(select auth.uid()) or exists(
  select 1 from public.mentorship_assignments a
  join public.mentor_profiles m on m.user_id=a.mentor_id and m.verified and m.active
  where a.id=mentorship_submissions.assignment_id
  and a.mentor_id=(select auth.uid())
 )
);
create policy mentorship_submissions_learner_insert on public.mentorship_submissions for insert to authenticated
with check (
 learner_id=(select auth.uid())
 and exists(select 1 from public.mentorship_assignments a where a.id=mentorship_submissions.assignment_id
   and a.learner_id=mentorship_submissions.learner_id)
);

create policy mentorship_feedback_actors_read on public.mentorship_feedback for select to authenticated
using (
 (mentor_id=(select auth.uid()) and exists(select 1 from public.mentor_profiles m
     where m.user_id=mentorship_feedback.mentor_id and m.verified and m.active))
 or exists(select 1 from public.mentorship_assignments a
   where a.id=mentorship_feedback.assignment_id and a.learner_id=(select auth.uid()))
);
create policy mentorship_feedback_mentor_insert on public.mentorship_feedback for insert to authenticated
with check (
 mentor_id=(select auth.uid())
 and exists(select 1 from public.mentor_profiles m where m.user_id=mentorship_feedback.mentor_id and m.verified and m.active)
 and exists(select 1 from public.mentorship_assignments a
   where a.id=mentorship_feedback.assignment_id and a.mentor_id=mentorship_feedback.mentor_id)
 and exists(select 1 from public.mentorship_submissions s where s.assignment_id=mentorship_feedback.assignment_id)
);

-- Trigger function intentionally lives in the unexposed private schema.
-- An actor may not bypass RLS by editing a foreign learner id or stored timestamp.
-- The before-insert checks run with trusted DB privileges to evaluate DOB and
-- guardian status, which are not readable by an unrelated mentor.
create function private.guard_mentorship_assignment_release_v1()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare
 actor_id uuid := (select auth.uid());
 m_id uuid;
 l_id uuid;
 r_id uuid;
begin
 if actor_id is null then raise exception 'authenticated participant required'; end if;
 if tg_table_name='mentorship_assignments' then
  m_id:=new.mentor_id; l_id:=new.learner_id; r_id:=new.request_id;
  if actor_id is distinct from m_id then raise exception 'only the mentor can assign work'; end if;
  if new.due_at is not null and new.due_at<=now() then raise exception 'due date must be in the future'; end if;
 elsif tg_table_name='mentorship_submissions' then
  select a.mentor_id,a.learner_id,a.request_id into m_id,l_id,r_id
   from public.mentorship_assignments a where a.id=new.assignment_id;
  if actor_id is distinct from new.learner_id or new.learner_id is distinct from l_id then
   raise exception 'only the assigned learner can respond';
  end if;
 elsif tg_table_name='mentorship_feedback' then
  select a.mentor_id,a.learner_id,a.request_id into m_id,l_id,r_id
   from public.mentorship_assignments a where a.id=new.assignment_id;
  if actor_id is distinct from new.mentor_id or new.mentor_id is distinct from m_id then
   raise exception 'only the assigned mentor can review';
  end if;
  if not exists(select 1 from public.mentorship_submissions s
   where s.assignment_id=new.assignment_id and s.learner_id=l_id) then
   raise exception 'response required before feedback';
  end if;
 else raise exception 'unsupported assignment write'; end if;
 if m_id is null or l_id is null or r_id is null or m_id=l_id then
  raise exception 'accepted mentor learner relationship required'; end if;
 if not exists(select 1 from public.mentorship_requests r
  join public.mentor_profiles m on m.user_id=r.mentor_id
  join public.profiles mp on mp.id=r.mentor_id
  join public.profiles lp on lp.id=r.mentee_id
  where r.id=r_id and r.status='accepted'
    and r.mentor_id=m_id and r.mentee_id=l_id
    and m.verified and m.active
    and mp.account_status='active' and mp.deleted_at is null
    and lp.role='student' and lp.account_status='active' and lp.deleted_at is null
    and (
      (lp.education_stage_key in ('college_tvet','university') and exists(
        select 1 from public.student_profiles s where s.user_id=lp.id
          and s.date_of_birth <= current_date - interval '18 years'
      ))
      or (lp.education_stage_key='school_11_12' and exists(
        select 1 from public.guardian_relationships gr
        where gr.learner_id=lp.id and gr.status='verified'
          and gr.guardian_user_id is not null and gr.verified_at is not null
      ))
    )
 ) then raise exception 'verified active mentor and eligible learner required'; end if;
 return new;
end;
$fn$;
revoke all on function private.guard_mentorship_assignment_release_v1() from public,anon,authenticated;
create trigger trg_mentorship_assignments_guard before insert on public.mentorship_assignments
 for each row execute function private.guard_mentorship_assignment_release_v1();
create trigger trg_mentorship_submissions_guard before insert on public.mentorship_submissions
 for each row execute function private.guard_mentorship_assignment_release_v1();
create trigger trg_mentorship_feedback_guard before insert on public.mentorship_feedback
 for each row execute function private.guard_mentorship_assignment_release_v1();

-- Undo ONLY if no learner-created assignment records exist. Requires release review:
-- begin;
-- do $$ begin
--  if (select count(*) from public.mentorship_assignments)>0 then
--    raise exception 'rollback refused: existing assignment data';
--  end if;
-- end $$;
-- drop table public.mentorship_feedback;
-- drop table public.mentorship_submissions;
-- drop table public.mentorship_assignments;
-- drop function private.guard_mentorship_assignment_release_v1();
-- commit;
