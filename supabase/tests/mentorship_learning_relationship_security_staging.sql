-- STAGING ONLY: relationship-correlated mentorship assignment write security.
-- Simulates an authenticated DB role with NO trusted JWT, and ROLLBACKS.
do $policies$
declare p text;
begin
  select with_check into p from pg_policies
    where schemaname='public' and tablename='mentorship_assignments'
    and policyname='mentorship_assignments_verified_mentor_insert';
  if p is null or p not like '%r.mentor_id = mentorship_assignments.mentor_id%'
    or p not like '%r.mentee_id = mentorship_assignments.learner_id%'
    or p like '%r.mentor_id = r.mentor_id%' then
    raise exception 'assignment mentor/learner RLS policy is uncorrelated';
  end if;
  select with_check into p from pg_policies
    where schemaname='public' and tablename='mentorship_submissions'
    and policyname='mentorship_submissions_assigned_learner_insert';
  if p is null or p not like '%a.learner_id = mentorship_submissions.learner_id%'
    or p like '%a.learner_id = a.learner_id%' then
    raise exception 'submission RLS policy is uncorrelated';
  end if;
  select with_check into p from pg_policies
    where schemaname='public' and tablename='mentorship_feedback'
    and policyname='mentorship_feedback_verified_mentor_insert';
  if p is null or p not like '%a.mentor_id = mentorship_feedback.mentor_id%'
    or p not like '%s.assignment_id = a.id%'
    or p like '%s.assignment_id = s.assignment_id%' then
    raise exception 'mentor feedback RLS policy is uncorrelated';
  end if;
  if has_column_privilege('authenticated','public.mentorship_assignments','id','INSERT')
    or has_column_privilege('authenticated','public.mentorship_submissions','id','INSERT')
    or has_column_privilege('authenticated','public.mentorship_feedback','created_at','INSERT') then
    raise exception 'client can override database-generated identity/timestamps';
  end if;
  if not exists(select 1 from pg_trigger
    where tgrelid='public.mentorship_assignments'::regclass
    and tgname='trg_guard_mentorship_learning_assignment' and tgenabled='O')
    or not exists(select 1 from pg_trigger
    where tgrelid='public.mentorship_submissions'::regclass
    and tgname='trg_guard_mentorship_learning_submission' and tgenabled='O')
    or not exists(select 1 from pg_trigger
    where tgrelid='public.mentorship_feedback'::regclass
    and tgname='trg_guard_mentorship_learning_feedback' and tgenabled='O') then
    raise exception 'mentorship write protection triggers missing';
  end if;
end $policies$;

begin;
set local role authenticated;
do $deny$
declare
  test_id uuid := '00000000-0000-4000-8000-000000000001';
  denied boolean;
begin
  denied:=false;
  begin
    insert into public.mentorship_assignments(
      request_id,mentor_id,learner_id,title,instructions
    ) values (test_id,test_id,test_id,'Not allowed','Without JWT this must be rejected');
  exception when others then
    if sqlerrm like '%authenticated mentoring participant required%'
      or sqlerrm like '%row-level security%' then denied:=true;
    else raise exception 'unexpected assignment error: %',sqlerrm; end if;
  end;
  if not denied then raise exception 'untrusted caller inserted mentorship assignment'; end if;

  denied:=false;
  begin
    insert into public.mentorship_submissions(assignment_id,learner_id,response)
      values (test_id,test_id,'Not allowed');
  exception when others then
    if sqlerrm like '%authenticated mentoring participant required%'
      or sqlerrm like '%row-level security%' then denied:=true;
    else raise exception 'unexpected submission error: %',sqlerrm; end if;
  end;
  if not denied then raise exception 'untrusted caller inserted mentorship submission'; end if;

  denied:=false;
  begin
    insert into public.mentorship_feedback(assignment_id,mentor_id,feedback)
      values (test_id,test_id,'Not allowed');
  exception when others then
    if sqlerrm like '%authenticated mentoring participant required%'
      or sqlerrm like '%row-level security%' then denied:=true;
    else raise exception 'unexpected feedback error: %',sqlerrm; end if;
  end;
  if not denied then raise exception 'untrusted caller inserted mentorship feedback'; end if;
end $deny$;
rollback;
select 'mentorship_task_correlated_authorization_smoke_passed' as result;
