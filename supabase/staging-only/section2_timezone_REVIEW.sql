-- DRAFT — STAGING ONLY, NOT APPLIED.
-- Stores the learner's IANA display zone as request metadata. Appointment times
-- remain timestamptz and are never shifted by this migration.
alter table public.mentorship_requests add column if not exists preferred_timezone text;

alter table public.mentorship_requests
  drop constraint if exists mentorship_requests_preferred_timezone_length;
alter table public.mentorship_requests
  add constraint mentorship_requests_preferred_timezone_length
  check (preferred_timezone is null or char_length(preferred_timezone) between 3 and 64);

create or replace function private.validate_mentorship_preferred_timezone()
returns trigger language plpgsql set search_path = '' as $fn$
begin
  if new.preferred_timezone is not null and
    not exists(select 1 from pg_catalog.pg_timezone_names where name=new.preferred_timezone) then
    raise exception 'preferred_timezone must be a valid IANA time-zone name';
  end if;
  return new;
end;
$fn$;
revoke all on function private.validate_mentorship_preferred_timezone() from PUBLIC,anon,authenticated;
drop trigger if exists trg_validate_mentorship_preferred_timezone on public.mentorship_requests;
create trigger trg_validate_mentorship_preferred_timezone
  before insert or update of preferred_timezone on public.mentorship_requests
  for each row execute function private.validate_mentorship_preferred_timezone();
revoke update(preferred_timezone) on public.mentorship_requests from PUBLIC,anon,authenticated;
grant insert(preferred_timezone) on public.mentorship_requests to authenticated;
