-- STAGING ONLY: protect weekly availability against forged/inconsistent writes.
create or replace function private.validate_mentor_weekly_availability()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_admin boolean := private.is_admin_user() and
    coalesce((auth.jwt()->>'aal'),'')='aal2';
begin
  if v_actor is null or (v_actor is distinct from new.mentor_id and not v_admin) then
    raise exception 'only the verified mentor or MFA administrator may set mentoring hours';
  end if;
  if tg_op='UPDATE' then
    if new.id is distinct from old.id
       or new.mentor_id is distinct from old.mentor_id
       or new.created_at is distinct from old.created_at then
      raise exception 'mentor weekly slot identity cannot be changed';
    end if;
  end if;
  if new.weekday not between 0 and 6 or new.start_time>=new.end_time
    or new.timezone is null or char_length(new.timezone)>80
    or not exists(select 1 from pg_catalog.pg_timezone_names t
       where t.name=new.timezone) then
    raise exception 'valid weekday, hours, and IANA time zone required';
  end if;

  -- Serialize concurrent writes of the same mentor's weekly hours.
  perform 1 from public.mentor_profiles m
    join public.profiles p on p.id=m.user_id
    where m.user_id=new.mentor_id
      and m.verified and m.active
      and p.account_status='active' and p.deleted_at is null
    for update of m;
  if not found then raise exception 'active verified mentor required for published hours'; end if;

  if new.active and exists(
    select 1 from public.mentor_availability a
    where a.mentor_id=new.mentor_id and a.id is distinct from new.id
      and a.active and a.weekday=new.weekday and a.timezone=new.timezone
      and a.start_time<new.end_time and new.start_time<a.end_time
  ) then
    raise exception 'weekly mentor hours overlap an existing slot';
  end if;
  return new;
end;
$fn$;
revoke all on function private.validate_mentor_weekly_availability()
from public,anon,authenticated;
drop trigger if exists trg_validate_mentor_weekly_availability on public.mentor_availability;
create trigger trg_validate_mentor_weekly_availability
 before insert or update on public.mentor_availability
 for each row execute function private.validate_mentor_weekly_availability();
