-- Staging regression test: any suspended/unverified mentor loses RLS
-- access to private learner records; learner ownership remains available.
do $policies$
declare
  t text;
  p text;
  name text;
  mentor_predicate text;
  expected text[] := array[
    'mentorship_requests',
    'mentorship_sessions',
    'mentorship_ratings',
    'mentorship_assignments',
    'mentorship_submissions',
    'mentorship_feedback'
  ];
begin
  foreach t in array expected loop
    select policyname,qual into name,p from pg_policies
      where schemaname='public' and tablename=t and cmd='SELECT'
        and policyname in (
          'Mentorship requests readable by participants',
          'Mentorship sessions readable by participants',
          'Mentorship ratings readable by session participants',
          'mentorship_assignments_participant_read',
          'mentorship_submissions_participant_read',
          'mentorship_feedback_participant_read'
        );
    if p is null then raise exception 'missing protected learner read policy for %',t; end if;
    if p not like '%m.verified%' or p not like '%m.active%' then
      raise exception 'verified active mentor condition missing from %',t;
    end if;
    if t in ('mentorship_requests','mentorship_sessions','mentorship_ratings')
       and p not like '%aal2%' then
      raise exception 'MFA admin oversight condition missing from %',t;
    end if;
  end loop;
  if has_table_privilege('anon','public.mentorship_assignments','SELECT')
      or has_table_privilege('anon','public.mentorship_submissions','SELECT')
      or has_table_privilege('anon','public.mentorship_feedback','SELECT') then
    raise exception 'anonymous access to mentorship learning records found';
  end if;
end $policies$;
select 'mentor_suspension_private_read_policies_passed' as result;
