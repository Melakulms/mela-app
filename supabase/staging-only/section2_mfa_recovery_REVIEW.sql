-- STAGING ONLY / REVIEW DRAFT. NEVER AUTOMATICALLY APPLY TO PRODUCTION.
-- Two independent AAL2 administrators, identity evidence reviewed out of band,
-- 24h cooling-off, rate limit, service-role-only finalization.
-- No frontend operation can delete MFA factors. This schema alone never does so.
create table if not exists private.mentor_mfa_recovery_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  mentor_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  eligible_after timestamptz not null default (now() + interval '24 hours'),
  status text not null default 'pending' check(status in
    ('pending','approved','processing','completed','rejected')),
  reason text not null check(reason in ('lost_device','all_factors_unavailable','device_compromised')),
  processing_by uuid references auth.users(id),
  processing_at timestamptz,
  attempts integer not null default 0 check(attempts between 0 and 3),
  finalized_at timestamptz
);
create table if not exists private.mentor_mfa_recovery_reviews (
  request_id uuid not null references private.mentor_mfa_recovery_requests(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id),
  evidence_reference text not null check(char_length(evidence_reference) between 12 and 128),
  reviewed_at timestamptz not null default now(),
  primary key (request_id, reviewer_id)
);
create unique index if not exists mentor_mfa_recovery_one_active_per_mentor
 on private.mentor_mfa_recovery_requests(mentor_id)
 where status in ('pending','approved','processing');
alter table private.mentor_mfa_recovery_requests enable row level security;
alter table private.mentor_mfa_recovery_reviews enable row level security;
revoke all on private.mentor_mfa_recovery_requests from PUBLIC,anon,authenticated;
revoke all on private.mentor_mfa_recovery_reviews from PUBLIC,anon,authenticated;

create or replace function private.mentor_mfa_recovery_is_admin()
returns boolean language sql stable security definer set search_path='' as $body$
  select (select auth.uid()) is not null
   and coalesce((auth.jwt()->>'aal'),'')='aal2'
   and private.is_admin_user();
$body$;
revoke all on function private.mentor_mfa_recovery_is_admin()
 from PUBLIC,anon,authenticated;

create or replace function public.request_mentor_mfa_recovery(p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $body$
declare v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise exception 'Sign in before requesting MFA recovery'; end if;
  if p_reason not in ('lost_device','all_factors_unavailable','device_compromised') then
    raise exception 'Select a valid recovery reason';
  end if;
  if not exists(select 1 from public.mentor_profiles mp
     join public.profiles p on p.id=mp.user_id
     where mp.user_id=v_actor and mp.verified and mp.active
       and p.account_status='active' and p.deleted_at is null) then
    raise exception 'Recovery is not available for this account';
  end if;
  if exists(select 1 from private.mentor_mfa_recovery_requests r
    where r.mentor_id=v_actor and r.created_at>now()-interval '7 days') then
    raise exception 'A recent recovery request already exists. Contact MELA support.';
  end if;
  insert into private.mentor_mfa_recovery_requests(mentor_id,reason)
   values(v_actor,p_reason);
  insert into public.admin_audit_logs(actor_id,action,entity_type,entity_id,details)
   values(v_actor,'mentor_mfa_recovery_requested','mentor_mfa_recovery',v_actor,
    jsonb_build_object('reason_code',p_reason));
  return jsonb_build_object('accepted',true,'message',
    'Request recorded. Two MFA-verified staff reviewers must independently verify identity; no automatic reset.');
end;
$body$;
revoke all on function public.request_mentor_mfa_recovery(text) from PUBLIC,anon,authenticated;
grant execute on function public.request_mentor_mfa_recovery(text) to authenticated;

create or replace function public.review_mentor_mfa_recovery(
 p_request_id uuid,p_evidence_reference text,p_approve boolean
) returns jsonb language plpgsql security definer set search_path='' as $body$
declare v_actor uuid := (select auth.uid());
 v_req private.mentor_mfa_recovery_requests%rowtype;
 v_count integer;
begin
  if not private.mentor_mfa_recovery_is_admin() then raise exception 'MFA-verified staff review required'; end if;
  select * into v_req from private.mentor_mfa_recovery_requests where id=p_request_id for update;
  if not found or v_req.status not in ('pending','approved') or v_req.mentor_id=v_actor then
    raise exception 'Recovery request is not eligible for review';
  end if;
  if p_approve then
    if p_evidence_reference is null or char_length(p_evidence_reference) not between 12 and 128 then
      raise exception 'Record a valid independent identity-verification reference';
    end if;
    insert into private.mentor_mfa_recovery_reviews(request_id,reviewer_id,evidence_reference)
      values(p_request_id,v_actor,p_evidence_reference);
    select count(*) into v_count from private.mentor_mfa_recovery_reviews where request_id=p_request_id;
    if v_count>=2 then
      update private.mentor_mfa_recovery_requests set status='approved' where id=p_request_id;
    end if;
  else
    update private.mentor_mfa_recovery_requests set status='rejected' where id=p_request_id;
    v_count:=0;
  end if;
  insert into public.admin_audit_logs(actor_id,action,entity_type,entity_id,details)
   values(v_actor,case when p_approve then 'mentor_mfa_recovery_review_approved'
         else 'mentor_mfa_recovery_review_rejected' end,
     'mentor_mfa_recovery',p_request_id,
     jsonb_build_object('review_count',v_count,'evidence_ref_recorded',p_approve));
  return jsonb_build_object('reviewed',true,'review_count',v_count);
end;
$body$;
revoke all on function public.review_mentor_mfa_recovery(uuid,text,boolean) from PUBLIC,anon,authenticated;
grant execute on function public.review_mentor_mfa_recovery(uuid,text,boolean) to authenticated;

-- Restricted staff list, intentionally excluding private evidence references.
create or replace function public.list_mentor_mfa_recovery_requests()
returns jsonb language plpgsql security definer set search_path='' as $body$
declare v_rows jsonb;
begin
  if not private.mentor_mfa_recovery_is_admin() then
    raise exception 'MFA-verified staff required';
  end if;
  select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb)
    into v_rows from (
      select r.id,r.mentor_id,r.created_at,r.eligible_after,r.status,r.reason,
        (select count(*) from private.mentor_mfa_recovery_reviews v where v.request_id=r.id)::integer as review_count
      from private.mentor_mfa_recovery_requests r
      where r.created_at > now()-interval '90 days'
      order by r.created_at desc limit 100
    ) q;
  return v_rows;
end;
$body$;
revoke all on function public.list_mentor_mfa_recovery_requests() from PUBLIC,anon,authenticated;
grant execute on function public.list_mentor_mfa_recovery_requests() to authenticated;

-- Edge function calls this with the caller's signed JWT. An AAL2 admin may
-- claim only a two-reviewer approval after 24h, then obtain the target user id.
create or replace function public.claim_mentor_mfa_recovery(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $body$
declare v_actor uuid := (select auth.uid());
 v_req private.mentor_mfa_recovery_requests%rowtype;
 v_count integer;
begin
  if not private.mentor_mfa_recovery_is_admin() then raise exception 'MFA-verified staff required'; end if;
  select * into v_req from private.mentor_mfa_recovery_requests where id=p_request_id for update;
  if not found or v_req.status <> 'approved' or v_req.eligible_after>now()
    or v_req.created_at < now()-interval '14 days'
    or v_req.mentor_id=v_actor or v_req.attempts>=3
    or not exists (
      select 1 from public.mentor_profiles m
        join public.profiles p on p.id=m.user_id
      where m.user_id=v_req.mentor_id and m.verified and m.active
        and p.account_status='active' and p.deleted_at is null
        and p.role <> 'admin'
    ) then
    raise exception 'Recovery cannot be executed';
  end if;
  select count(*) into v_count from private.mentor_mfa_recovery_reviews where request_id=p_request_id;
  if v_count<2 then raise exception 'Two independent reviews are required'; end if;
  update private.mentor_mfa_recovery_requests
   set status='processing',processing_by=v_actor,processing_at=now(),attempts=attempts+1
   where id=p_request_id;
  insert into public.admin_audit_logs(actor_id,action,entity_type,entity_id,details)
   values(v_actor,'mentor_mfa_recovery_claimed','mentor_mfa_recovery',p_request_id,
    jsonb_build_object('review_count',v_count));
  return jsonb_build_object('mentor_id',v_req.mentor_id,'request_id',p_request_id);
end;
$body$;
revoke all on function public.claim_mentor_mfa_recovery(uuid) from PUBLIC,anon,authenticated;
grant execute on function public.claim_mentor_mfa_recovery(uuid) to authenticated;

-- The Auth administrative factor deletion is performed ONLY by a trusted Edge
-- function using a service-role secret, NEVER by a client. Finalize only if all
-- verified factors were actually removed (Auth signs out affected sessions).
create or replace function public.finalize_mentor_mfa_recovery(
 p_request_id uuid,p_success boolean
) returns jsonb language plpgsql security definer set search_path='' as $body$
declare v_req private.mentor_mfa_recovery_requests%rowtype;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'Trusted service credentials required';
  end if;
  select * into v_req from private.mentor_mfa_recovery_requests where id=p_request_id for update;
  if not found or v_req.status<>'processing' then
    raise exception 'Recovery is not processing';
  end if;
  if p_success and exists(select 1 from auth.mfa_factors
    where user_id=v_req.mentor_id and status='verified') then
    raise exception 'Cannot finalize: the user still has verified MFA factors';
  end if;
  if p_success then
    update private.mentor_mfa_recovery_requests set status='completed',finalized_at=now()
      where id=p_request_id;
  else
    -- Fail closed: no automatic re-approval/re-execution.
    update private.mentor_mfa_recovery_requests set status='rejected',finalized_at=now()
      where id=p_request_id;
  end if;
  insert into public.admin_audit_logs(actor_id,action,entity_type,entity_id,details)
    values(v_req.processing_by,'mentor_mfa_recovery_finalized','mentor_mfa_recovery',
    p_request_id,jsonb_build_object('success',p_success));
  return jsonb_build_object('success',p_success);
end;
$body$;
revoke all on function public.finalize_mentor_mfa_recovery(uuid,boolean)
 from PUBLIC,anon,authenticated,service_role;
grant execute on function public.finalize_mentor_mfa_recovery(uuid,boolean) to service_role;
