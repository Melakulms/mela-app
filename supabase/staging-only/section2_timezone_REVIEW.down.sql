-- DRAFT STAGING-ONLY ROLLBACK: removes recorded display zones, never appointment instants.
do $guard$
begin
  if exists(select 1 from public.mentorship_requests where preferred_timezone is not null)
    and current_setting('mela.confirm_rollback',true) is distinct from 'yes' then
    raise exception 'rollback blocked: recorded time zones would be lost; acknowledge with set local mela.confirm_rollback = ''yes''';
  end if;
end;
$guard$;
drop trigger if exists trg_validate_mentorship_preferred_timezone on public.mentorship_requests;
drop function if exists private.validate_mentorship_preferred_timezone();
alter table public.mentorship_requests drop constraint if exists mentorship_requests_preferred_timezone_length;
alter table public.mentorship_requests drop column if exists preferred_timezone;
