-- Staging only: prevent unsafe changes to supervised program capacity/mentor
-- and record privileged group-program changes in the existing admin audit trail.
create or replace function private.guard_mentorship_group_program()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare
  v_approved integer := 0;
begin
  if not private.is_admin_user() or coalesce((auth.jwt()->>'aal'),'')<>'aal2' then
    raise exception 'MFA administrator required for mentorship programs';
  end if;
  if tg_op='UPDATE' then
    if old.id is distinct from new.id or old.created_at is distinct from new.created_at then
      raise exception 'group program identifier and original creation timestamp are immutable';
    end if;
    select count(*) into v_approved
      from public.mentorship_group_interests
      where group_id=old.id and status='approved';
    if new.capacity < v_approved then
      raise exception 'group capacity cannot fall below approved learners';
    end if;
    if old.mentor_id is distinct from new.mentor_id and v_approved>0 then
      raise exception 'approved group participants require a new program before changing mentors';
    end if;
  end if;
  if new.status='published' then
    if not exists(
      select 1 from public.mentor_profiles m
      where m.user_id=new.mentor_id and m.active and m.verified
    ) then
      raise exception 'verified active mentor needed before publishing group program';
    end if;
    if new.starts_at is null or new.starts_at<=now() then
      raise exception 'published group program needs a future start date';
    end if;
  end if;
  return new;
end;
$fn$;
revoke all on function private.guard_mentorship_group_program() from public,anon,authenticated;

create or replace function private.audit_mentorship_group_program()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
  insert into public.admin_audit_logs(actor_id,action,entity_type,entity_id,details)
  values(
    (select auth.uid()),
    case when tg_op='INSERT' then 'mentorship_group_created' else 'mentorship_group_updated' end,
    'mentorship_group',
    new.id,
    jsonb_build_object('status',new.status,'mentor_id',new.mentor_id,
      'capacity',new.capacity,'previous_status',case when tg_op='UPDATE' then old.status else null end)
  );
  return new;
end;
$fn$;
revoke all on function private.audit_mentorship_group_program() from public,anon,authenticated;
drop trigger if exists trg_audit_mentorship_group_program on public.mentorship_groups;
create trigger trg_audit_mentorship_group_program
after insert or update on public.mentorship_groups
for each row execute function private.audit_mentorship_group_program();
