-- Audit every status decision in the MFA-only mentor application queue.
create or replace function private.audit_mentorship_application_decision()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  if new.status is distinct from old.status then
    if not private.is_admin_user() or coalesce(auth.jwt()->>'aal','') <> 'aal2' then
      raise exception 'MFA-verified administrator required for mentorship application reviews';
    end if;
    insert into public.admin_audit_logs(actor_id,action,entity_type,entity_id,details)
    values(
      (select auth.uid()),
      'mentorship_application_reviewed',
      'mentorship_application',
      new.id,
      jsonb_build_object('from',old.status,'to',new.status)
    );
  end if;
  return new;
end;
$function$;
revoke all on function private.audit_mentorship_application_decision() from public, anon, authenticated;
drop trigger if exists trg_audit_mentorship_application_decision on public.mentorship_applications;
create trigger trg_audit_mentorship_application_decision
after update of status on public.mentorship_applications
for each row execute function private.audit_mentorship_application_decision();
