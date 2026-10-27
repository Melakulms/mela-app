-- STAGING ONLY. Simulated JWT negative tests, no standing users or records created.
-- This validates actor-bound triggers, not cryptographically signed Auth sessions.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',true);
do $spoof$
declare
  denied boolean;
  unrelated uuid:='00000000-0000-4000-8000-000000000001';
begin
  if (select auth.uid()) is distinct from '00000000-0000-4000-8000-000000000099'::uuid then
    raise exception 'simulated request JWT actor not applied';
  end if;
  denied:=false;
  begin
    insert into public.mentorship_assignments(
      request_id,mentor_id,learner_id,title,instructions
    ) values (unrelated,unrelated,unrelated,'Not an allowed task','Unauthorized mentor should be blocked');
  exception when others then
    if sqlerrm like '%only the assigned mentor may create a task%'
       or sqlerrm like '%row-level security%' then denied:=true;
    else raise exception 'unexpected task rejection: %',sqlerrm; end if;
  end;
  if not denied then raise exception 'spoofed mentor wrote a task'; end if;

  denied:=false;
  begin
    insert into public.mentorship_submissions(
      assignment_id,learner_id,response
    ) values (unrelated,unrelated,'Unauthorized learner submission');
  exception when others then
    if sqlerrm like '%only the assigned learner may submit this task%'
       or sqlerrm like '%row-level security%' then denied:=true;
    else raise exception 'unexpected submission rejection: %',sqlerrm; end if;
  end;
  if not denied then raise exception 'spoofed learner wrote submission'; end if;

  denied:=false;
  begin
    insert into public.mentorship_feedback(
      assignment_id,mentor_id,feedback
    ) values (unrelated,unrelated,'Unauthorized mentor feedback');
  exception when others then
    if sqlerrm like '%only the assigned mentor may review this task%'
       or sqlerrm like '%row-level security%' then denied:=true;
    else raise exception 'unexpected feedback rejection: %',sqlerrm; end if;
  end;
  if not denied then raise exception 'spoofed mentor wrote feedback'; end if;
end $spoof$;
rollback;
select 'mentorship_cross_actor_spoofed_identity_denied' as result;