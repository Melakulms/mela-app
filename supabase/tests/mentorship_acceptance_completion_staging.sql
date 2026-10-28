-- STAGING ONLY. Guard regression for acceptance/scheduling and session completion.
-- This test inspects installed executable database functions, not migrations.
do $verify$
declare
  v_status_fn text;
  v_respond_fn text;
  v_cancel_fn text;
  v_complete_fn text;
begin
  select pg_get_functiondef('private.process_mentorship_request_status()'::regprocedure)
    into v_status_fn;
  if v_status_fn ilike '%insert into public.mentorship_sessions%'
    or v_status_fn ilike '%call_room_id%'
    or v_status_fn ilike '%has been scheduled%' then
    raise exception 'acceptance still auto-schedules or invents a room';
  end if;
  if v_status_fn not ilike '%separately schedule%'
    or v_status_fn not ilike '%private.create_notification%' then
    raise exception 'mentorship acceptance no longer gives explicit separate-booking notices';
  end if;

  select pg_get_functiondef('private.respond_mentorship_request(uuid,text)'::regprocedure)
    into v_respond_fn;
  select pg_get_functiondef('private.cancel_mentorship_request(uuid)'::regprocedure)
    into v_cancel_fn;
  if v_respond_fn ilike '%insert into public.notifications%'
    or v_cancel_fn ilike '%insert into public.notifications%' then
    raise exception 'duplicate request status notifications still possible';
  end if;

  select pg_get_functiondef('private.complete_mentorship_session(uuid,text)'::regprocedure)
    into v_complete_fn;
  if v_complete_fn not like '%scheduled_at+make_interval(mins=>v_session.duration_min)>now()%'
    or v_complete_fn not like '%private.user_has_guardian_or_adult_clearance%'
    or v_complete_fn not like '%m.verified and m.active%'
    or v_complete_fn not like '%v_admin%' then
    raise exception 'session completion does not check end time, eligibility and verified mentor';
  end if;
  if has_function_privilege('anon',
    'public.complete_mentorship_session(uuid,text)','EXECUTE') then
    raise exception 'anonymous session-completion RPC access found';
  end if;
  if not exists(select 1 from pg_trigger
    where tgrelid='public.mentorship_requests'::regclass
      and tgname='trg_process_mentorship_request_status' and tgenabled='O') then
    raise exception 'request notification trigger is disabled';
  end if;
end $verify$;

begin;
set local role authenticated;
do $denied$
declare
  v_blocked boolean:=false;
begin
  begin
    perform public.complete_mentorship_session(
      '00000000-0000-4000-8000-000000000024'::uuid, 'Nothing to complete');
  exception when others then
    if sqlerrm like '%authentication required%' then v_blocked:=true;
    else raise exception 'unexpected completion denial: %',sqlerrm; end if;
  end;
  if not v_blocked then
    raise exception 'missing JWT unexpectedly allowed session completion';
  end if;
end $denied$;
rollback;
select 'mentorship_acceptance_completion_security_smoke_passed' as result;