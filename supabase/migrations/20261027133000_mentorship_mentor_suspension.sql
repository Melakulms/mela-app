-- Staging-only urgent mentor safeguarding suspension.
-- The action is deliberately one-way. Reinstatement needs a separately
-- reviewed, MFA-authorized workflow; no automatic reactivation.

create or replace function private.suspend_mentorship_mentor(
  p_mentor_id uuid,
  p_reason text
)
returns boolean language plpgsql security definer set search_path=''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_reason text := btrim(coalesce(p_reason,''));
  v_mentor public.mentor_profiles%rowtype;
  v_cancelled integer := 0;
  v_closed integer := 0;
begin
  if v_actor is null or not private.is_admin_user()
    or coalesce((auth.jwt()->>'aal'),'')<>'aal2' then
    raise exception 'MFA administrator required to suspend mentor';
  end if;
  if p_mentor_id is null or p_mentor_id=v_actor then
    raise exception 'cannot suspend your own or an unknown mentor profile';
  end if;
  if char_length(v_reason) not between 20 and 2000 then
    raise exception 'record a 20–2000 character safeguarding reason';
  end if;

  select * into v_mentor from public.mentor_profiles
    where user_id=p_mentor_id for update;
  if not found or not v_mentor.verified or not v_mentor.active then
    raise exception 'active verified mentor profile required';
  end if;

  update public.mentor_profiles set active=false,updated_at=now()
    where user_id=p_mentor_id;

  -- Stopping a mentor also terminates any future scheduled sessions.
  -- The existing session trigger sends participant notifications.
  update public.mentorship_sessions
    set status='cancelled',cancelled_at=now(),updated_at=now()
    where mentor_id=p_mentor_id and status='scheduled' and scheduled_at>now();
  get diagnostics v_cancelled = row_count;

  -- Close still-published facilitated cohorts so new enrollments cannot occur.
  update public.mentorship_groups set status='closed'
    where mentor_id=p_mentor_id and status='published';
  get diagnostics v_closed = row_count;

  -- Prevent unresolved requests from remaining actionable for an inactive mentor.
  update public.mentorship_requests set status='declined',responded_at=now()
    where mentor_id=p_mentor_id and status='pending';

  insert into public.admin_audit_logs(actor_id,action,entity_type,entity_id,details)
  values (
    v_actor,'mentorship_mentor_suspended','mentor_profile',p_mentor_id,
    jsonb_build_object('reason',v_reason,
      'future_sessions_cancelled',v_cancelled,'group_programs_closed',v_closed)
  );
  perform private.create_notification(
    p_mentor_id,
    'MELA mentorship access suspended',
    'Your mentor access is suspended. Contact MELA administration for review.',
    'mentor_profiles',
    p_mentor_id
  );
  return true;
end;
$fn$;

revoke all on function private.suspend_mentorship_mentor(uuid,text) from public,anon,authenticated;
grant execute on function private.suspend_mentorship_mentor(uuid,text) to authenticated;

create or replace function public.suspend_mentorship_mentor(
  p_mentor_id uuid,p_reason text
) returns boolean language sql security invoker set search_path=''
as $fn$
  select private.suspend_mentorship_mentor(p_mentor_id,p_reason);
$fn$;
revoke execute on function public.suspend_mentorship_mentor(uuid,text) from public,anon;
grant execute on function public.suspend_mentorship_mentor(uuid,text) to authenticated;
