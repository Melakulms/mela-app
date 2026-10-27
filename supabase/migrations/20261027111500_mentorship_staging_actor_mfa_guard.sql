-- Staging-only defense in depth: privileged mentorship transitions require AAL2.
-- Existing private lifecycle functions stay in place, with participant checks.
create or replace function private.mentorship_require_actor_mfa()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_admin_mfa boolean := private.is_admin_user() and coalesce((auth.jwt()->>'aal'),'')='aal2';
begin
  if v_actor is null then
    raise exception 'authenticated mentorship actor required';
  end if;
  if TG_TABLE_NAME='mentorship_requests' and TG_OP='UPDATE' then
    if new.status is distinct from old.status
       and v_actor is distinct from old.mentor_id
       and v_actor is distinct from old.mentee_id
       and not v_admin_mfa then
      raise exception 'mentorship review needs participant or MFA-verified administrator';
    end if;
  elsif TG_TABLE_NAME='mentorship_sessions' then
    if TG_OP='INSERT' then
      if v_actor is distinct from new.mentor_id and not v_admin_mfa then
        raise exception 'only the mentor or MFA-verified administrator can create a session';
      end if;
    elsif TG_OP='UPDATE' then
      if v_actor is distinct from old.mentor_id
         and v_actor is distinct from old.mentee_id
         and not v_admin_mfa then
        raise exception 'mentorship session modification needs participant or MFA-verified administrator';
      end if;
    end if;
  end if;
  return new;
end;
$fn$;
revoke all on function private.mentorship_require_actor_mfa() from public,anon,authenticated;
drop trigger if exists trg_mentorship_request_actor_mfa on public.mentorship_requests;
create trigger trg_mentorship_request_actor_mfa
before update on public.mentorship_requests
for each row execute function private.mentorship_require_actor_mfa();
drop trigger if exists trg_mentorship_session_actor_mfa_insert on public.mentorship_sessions;
create trigger trg_mentorship_session_actor_mfa_insert
before insert on public.mentorship_sessions
for each row execute function private.mentorship_require_actor_mfa();
drop trigger if exists trg_mentorship_session_actor_mfa_update on public.mentorship_sessions;
create trigger trg_mentorship_session_actor_mfa_update
before update on public.mentorship_sessions
for each row execute function private.mentorship_require_actor_mfa();

-- Prevent repeated pending requests for the same mentor/learner pair.
create unique index if not exists mentorship_one_pending_request_per_pair
on public.mentorship_requests(mentor_id,mentee_id)
where status='pending';
