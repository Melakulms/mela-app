-- STAGING smoke test for structured mentorship decline reasons.
-- Run after migration 20261028100000_mentorship_decline_reason.sql.
do $$
begin
  if has_column_privilege('authenticated','public.mentorship_requests','decline_reason_code','UPDATE') then
    raise exception 'authenticated users can write decline_reason_code directly';
  end if;
  if has_column_privilege('authenticated','public.mentorship_requests','decline_note','UPDATE') then
    raise exception 'authenticated users can write decline_note directly';
  end if;
  if has_column_privilege('anon','public.mentorship_requests','decline_note','SELECT') then
    raise exception 'anonymous users can read decline notes';
  end if;
  if has_function_privilege('anon','public.respond_mentorship_request_with_reason(uuid,text,text,text)','EXECUTE') then
    raise exception 'anonymous users can execute the decline action';
  end if;
  if not exists (select 1 from pg_constraint where conname='mentorship_requests_decline_fields_check') then
    raise exception 'decline fields must be limited to declined requests';
  end if;
end $$;
