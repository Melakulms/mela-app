-- STAGING ONLY: suspended mentors lose access to protected learner records.
-- Learners retain access to their own history. Only MFA AAL2 administrators
-- retain emergency oversight rights for mentorship requests and sessions.

drop policy if exists "Mentorship requests readable by participants" on public.mentorship_requests;
create policy "Mentorship requests readable by participants"
on public.mentorship_requests for select to authenticated
using (
  mentee_id=(select auth.uid())
  or (mentor_id=(select auth.uid()) and exists (
    select 1 from public.mentor_profiles m where m.user_id=mentorship_requests.mentor_id
      and m.verified and m.active))
  or (private.is_admin_user() and coalesce((auth.jwt()->>'aal'),'')='aal2')
);

drop policy if exists "Mentorship sessions readable by participants" on public.mentorship_sessions;
create policy "Mentorship sessions readable by participants"
on public.mentorship_sessions for select to authenticated
using (
  mentee_id=(select auth.uid())
  or (mentor_id=(select auth.uid()) and exists (
    select 1 from public.mentor_profiles m where m.user_id=mentorship_sessions.mentor_id
      and m.verified and m.active))
  or (private.is_admin_user() and coalesce((auth.jwt()->>'aal'),'')='aal2')
);

drop policy if exists "Mentorship ratings readable by session participants" on public.mentorship_ratings;
create policy "Mentorship ratings readable by session participants"
on public.mentorship_ratings for select to authenticated
using (
  mentee_id=(select auth.uid())
  or (mentor_id=(select auth.uid()) and exists (
    select 1 from public.mentor_profiles m where m.user_id=mentorship_ratings.mentor_id
      and m.verified and m.active))
  or (private.is_admin_user() and coalesce((auth.jwt()->>'aal'),'')='aal2')
);

drop policy if exists mentorship_assignments_participant_read on public.mentorship_assignments;
create policy mentorship_assignments_participant_read
on public.mentorship_assignments for select to authenticated
using (
  learner_id=(select auth.uid())
  or (mentor_id=(select auth.uid()) and exists (
    select 1 from public.mentor_profiles m where m.user_id=mentorship_assignments.mentor_id
      and m.verified and m.active))
);

drop policy if exists mentorship_submissions_participant_read on public.mentorship_submissions;
create policy mentorship_submissions_participant_read
on public.mentorship_submissions for select to authenticated
using (
  learner_id=(select auth.uid())
  or exists (
    select 1 from public.mentorship_assignments a
    join public.mentor_profiles m on m.user_id=a.mentor_id
    where a.id=mentorship_submissions.assignment_id
      and a.mentor_id=(select auth.uid()) and m.verified and m.active
  )
);

drop policy if exists mentorship_feedback_participant_read on public.mentorship_feedback;
create policy mentorship_feedback_participant_read
on public.mentorship_feedback for select to authenticated
using (
  exists (select 1 from public.mentorship_assignments a
    where a.id=mentorship_feedback.assignment_id
      and a.learner_id=(select auth.uid()))
  or (mentor_id=(select auth.uid()) and exists (
    select 1 from public.mentor_profiles m where m.user_id=mentorship_feedback.mentor_id
      and m.verified and m.active))
);
