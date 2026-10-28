-- MELA mentorship staging permission/negative-access smoke test.
-- Must run on an isolated staging database using a migration-capable SQL role.
-- All negative-action probes run inside a transaction and ROLLBACK.

do $verify$
begin
  if not has_column_privilege('authenticated','public.mentorship_requests','mentee_id','INSERT') then
    raise exception 'authenticated learners cannot submit a mentee_id';
  end if;
  if has_column_privilege('authenticated','public.mentorship_requests','responded_at','INSERT') then
    raise exception 'user can write server-owned responded_at field';
  end if;
  if has_table_privilege('anon','public.mentorship_requests','INSERT') then
    raise exception 'anonymous role can insert mentorship requests';
  end if;
  if has_table_privilege('authenticated','public.mentorship_sessions','INSERT') then
    raise exception 'authenticated role has unintended direct session insert';
  end if;
  if not has_function_privilege('authenticated','public.respond_mentorship_request(uuid,text)','EXECUTE') then
    raise exception 'authenticated mentor cannot respond';
  end if;
  if not has_function_privilege('authenticated','public.schedule_mentorship_session(uuid,timestamptz,integer,text)','EXECUTE') then
    raise exception 'authenticated mentor cannot schedule';
  end if;
  if has_function_privilege('anon','public.schedule_mentorship_session(uuid,timestamptz,integer,text)','EXECUTE') then
    raise exception 'anonymous session scheduling exposed';
  end if;
  if has_function_privilege('authenticated','private.enforce_mentorship_audience_access()','EXECUTE') then
    raise exception 'private safeguard trigger callable by learners';
  end if;
end;
$verify$;

begin;
set local role authenticated;
do $denial$
declare
  denied boolean := false;
begin
  begin
    perform public.respond_mentorship_request(
      '00000000-0000-0000-0000-000000000001'::uuid,'accepted');
  exception when others then
    if sqlerrm like '%authentication required%' then denied := true;
    else raise; end if;
  end;
  if not denied then raise exception 'missing JWT unexpectedly allowed mentor response'; end if;

  denied := false;
  begin
    insert into public.mentorship_requests(mentor_id,mentee_id,topic,message,status)
    values('00000000-0000-0000-0000-000000000002'::uuid,
           '00000000-0000-0000-0000-000000000001'::uuid,'NOT AUTHORIZED','', 'pending');
  exception when others then
    if sqlerrm like '%row-level security%' or sqlerrm like '%active student account required%'
      then denied := true;
    else raise; end if;
  end;
  if not denied then raise exception 'missing JWT unexpectedly allowed mentorship request'; end if;

  denied := false;
  begin
    perform public.schedule_mentorship_session(
      '00000000-0000-0000-0000-000000000003'::uuid,now()+interval '2 days',30,null);
  exception when others then
    if sqlerrm like '%authentication required%' then denied := true;
    else raise; end if;
  end;
  if not denied then raise exception 'missing JWT unexpectedly allowed scheduling'; end if;
end;
$denial$;
rollback;
-- These tests are deliberately insufficient to establish adult, minor, mentor,
-- and admin-MFA real-world end-to-end readiness; signed-in test accounts are still needed.
