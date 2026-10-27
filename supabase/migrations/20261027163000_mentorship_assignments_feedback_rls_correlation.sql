-- STAGING ONLY — fix correlated mentor/learner/assignment authorization.
-- Prior RLS policies compared r.mentor_id=r.mentor_id, a.mentor_id=a.mentor_id
-- and s.assignment_id=s.assignment_id, which are tautologies.
-- Trigger guards re-check relationships under the authenticated actor and
-- do not rely on the untrusted client to provide matching IDs.

drop policy if exists mentorship_assignments_verified_mentor_insert on public.mentorship_assignments;
create policy mentorship_assignments_verified_mentor_insert
on public.mentorship_assignments for insert to authenticated
with check (
  mentor_id=(select auth.uid())
  and learner_id<>mentor_id
  and exists (select 1 from public.mentor_profiles m
    where m.user_id=mentorship_assignments.mentor_id and m.verified and m.active)
  and exists (select 1 from public.mentorship_requests r
    where r.id=mentorship_assignments.request_id
      and r.mentor_id=mentorship_assignments.mentor_id
      and r.mentee_id=mentorship_assignments.learner_id
      and r.status='accepted')
  and exists (select 1 from public.profiles p
    where p.id=mentorship_assignments.learner_id
      and p.role='student' and p.account_status='active'
      and p.deleted_at is null
      and p.education_stage_key in ('school_11_12','college_tvet','university'))
);

drop policy if exists mentorship_submissions_assigned_learner_insert on public.mentorship_submissions;
create policy mentorship_submissions_assigned_learner_insert
on public.mentorship_submissions for insert to authenticated
with check (
  learner_id=(select auth.uid())
  and exists (select 1 from public.mentorship_assignments a
    join public.mentorship_requests r on r.id=a.request_id
    join public.mentor_profiles m on m.user_id=a.mentor_id
    where a.id=mentorship_submissions.assignment_id
      and a.learner_id=mentorship_submissions.learner_id
      and r.mentor_id=a.mentor_id and r.mentee_id=a.learner_id
      and r.status='accepted' and m.verified and m.active)
);

drop policy if exists mentorship_feedback_verified_mentor_insert on public.mentorship_feedback;
create policy mentorship_feedback_verified_mentor_insert
on public.mentorship_feedback for insert to authenticated
with check (
  mentor_id=(select auth.uid())
  and exists (select 1 from public.mentor_profiles m
    where m.user_id=mentorship_feedback.mentor_id and m.verified and m.active)
  and exists (select 1 from public.mentorship_assignments a
    join public.mentorship_requests r on r.id=a.request_id
    join public.mentorship_submissions s
       on s.assignment_id=a.id and s.learner_id=a.learner_id
    where a.id=mentorship_feedback.assignment_id
      and a.mentor_id=mentorship_feedback.mentor_id
      and r.mentor_id=a.mentor_id and r.mentee_id=a.learner_id
      and r.status='accepted')
);

-- Make it impossible to insert server-generated identity/timestamp columns
-- through the Data API even if future RLS policies are accidentally loosened.
revoke insert on public.mentorship_assignments from authenticated;
revoke insert on public.mentorship_submissions from authenticated;
revoke insert on public.mentorship_feedback from authenticated;
grant insert (request_id,mentor_id,learner_id,title,instructions,due_at)
  on public.mentorship_assignments to authenticated;
grant insert (assignment_id,learner_id,response)
  on public.mentorship_submissions to authenticated;
grant insert (assignment_id,mentor_id,feedback)
  on public.mentorship_feedback to authenticated;

create or replace function private.guard_mentorship_learning_write()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_mentor uuid;
  v_learner uuid;
  v_request uuid;
begin
  if v_actor is null then
    raise exception 'authenticated mentoring participant required';
  end if;
  if tg_table_name='mentorship_assignments' then
    v_mentor:=new.mentor_id;
    v_learner:=new.learner_id;
    v_request:=new.request_id;
    if v_actor is distinct from v_mentor then
      raise exception 'only the assigned mentor may create a task';
    end if;
    if new.due_at is not null and new.due_at<=now() then
      raise exception 'task due date must be in the future';
    end if;
  elsif tg_table_name='mentorship_submissions' then
    select a.mentor_id,a.learner_id,a.request_id
      into v_mentor,v_learner,v_request
      from public.mentorship_assignments a
      where a.id=new.assignment_id;
    if not found or v_actor is distinct from new.learner_id
      or new.learner_id is distinct from v_learner then
      raise exception 'only the assigned learner may submit this task';
    end if;
  elsif tg_table_name='mentorship_feedback' then
    select a.mentor_id,a.learner_id,a.request_id
      into v_mentor,v_learner,v_request
      from public.mentorship_assignments a
      where a.id=new.assignment_id;
    if not found or v_actor is distinct from new.mentor_id
      or new.mentor_id is distinct from v_mentor then
      raise exception 'only the assigned mentor may review this task';
    end if;
    if not exists (
      select 1 from public.mentorship_submissions s
      where s.assignment_id=new.assignment_id and s.learner_id=v_learner
    ) then
      raise exception 'learner must submit assigned work before feedback';
    end if;
  else
    raise exception 'unsupported mentoring write operation';
  end if;

  if v_mentor is null or v_learner is null
    or v_mentor=v_learner or v_request is null then
    raise exception 'valid mentor, learner and request required';
  end if;
  if not exists (
    select 1 from public.mentorship_requests r
    join public.mentor_profiles m on m.user_id=r.mentor_id
    join public.profiles p on p.id=r.mentee_id
    where r.id=v_request and r.status='accepted'
      and r.mentor_id=v_mentor and r.mentee_id=v_learner
      and m.verified and m.active
      and p.role='student' and p.account_status='active'
      and p.deleted_at is null
      and p.education_stage_key in ('school_11_12','college_tvet','university')
  ) then
    raise exception 'active accepted eligible mentorship required';
  end if;
  if not private.user_has_guardian_or_adult_clearance(v_learner) then
    raise exception 'current guardian or adult eligibility must be verified';
  end if;
  return new;
end;
$fn$;
revoke all on function private.guard_mentorship_learning_write()
 from public,anon,authenticated;
drop trigger if exists trg_guard_mentorship_learning_assignment on public.mentorship_assignments;
create trigger trg_guard_mentorship_learning_assignment
 before insert on public.mentorship_assignments
 for each row execute function private.guard_mentorship_learning_write();
drop trigger if exists trg_guard_mentorship_learning_submission on public.mentorship_submissions;
create trigger trg_guard_mentorship_learning_submission
 before insert on public.mentorship_submissions
 for each row execute function private.guard_mentorship_learning_write();
drop trigger if exists trg_guard_mentorship_learning_feedback on public.mentorship_feedback;
create trigger trg_guard_mentorship_learning_feedback
 before insert on public.mentorship_feedback
 for each row execute function private.guard_mentorship_learning_write();
