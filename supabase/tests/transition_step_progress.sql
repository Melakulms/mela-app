begin;
do $test$
declare learner_id uuid; plan_id uuid; step_id uuid;
begin
 select id into learner_id from public.profiles where role='student' and deleted_at is null limit 1;
 if learner_id is null then raise exception 'No learner available for rollback regression'; end if;
 insert into public.mela_transition_plans(user_id,goal_type,goal_title,status) values(learner_id,'next_grade','Rollback-only section regression','paused') returning id into plan_id;
 insert into public.mela_transition_steps(plan_id,step_order,step_type,title) values(plan_id,1,'research','Rollback-only step') returning id into step_id;
 perform set_config('mela_test.plan_id',plan_id::text,true);
 perform set_config('mela_test.step_id',step_id::text,true);
 perform set_config('request.jwt.claim.sub',learner_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',learner_id,'role','authenticated')::text,true);
end $test$;
set local role authenticated;
do $test$
declare changed integer; saved_status text;
begin
 update public.mela_transition_steps set status='completed',completed_at=now() where id=current_setting('mela_test.step_id')::uuid and plan_id=current_setting('mela_test.plan_id')::uuid;
 get diagnostics changed=row_count;
 if changed<>1 then raise exception 'Owner step save failed';end if;
 select status into saved_status from public.mela_transition_steps where id=current_setting('mela_test.step_id')::uuid;
 if saved_status is distinct from 'completed' then raise exception 'Owner step readback failed';end if;
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 perform set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
 update public.mela_transition_steps set status='skipped' where id=current_setting('mela_test.step_id')::uuid;
 get diagnostics changed=row_count;
 if changed<>0 then raise exception 'Outsider step update was allowed';end if;
 select count(*) into changed from public.mela_transition_steps where id=current_setting('mela_test.step_id')::uuid;
 if changed<>0 then raise exception 'Outsider step read was allowed';end if;
end $test$;
reset role;
rollback;
select true as owner_save_and_readback_passed,true as outsider_read_and_write_denied,true as fixtures_rolled_back;
