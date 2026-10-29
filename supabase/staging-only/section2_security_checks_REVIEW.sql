-- AFTER applying the review SQL to STAGING, run these structural security checks.
-- This deliberately does NOT simulate a genuine Supabase Auth AAL2 session.
do $check$
begin
  if to_regclass('public.mentorship_session_note_drafts') is null then
    raise exception 'draft table is missing';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.mentorship_session_note_drafts'::regclass) then
    raise exception 'draft table is missing RLS';
  end if;
  if has_table_privilege('authenticated','public.mentorship_session_note_drafts','SELECT') then
    raise exception 'authenticated role can query the draft table directly';
  end if;
  if has_column_privilege('authenticated','public.mentorship_sessions','notes','UPDATE') then
    raise exception 'authenticated can directly update published notes';
  end if;
  if has_table_privilege('authenticated','public.mentorship_sessions','UPDATE') then
    raise exception 'authenticated has broad session UPDATE privilege';
  end if;
  if exists(select 1 from pg_policies where schemaname='public'
    and tablename='mentorship_sessions'
    and policyname='Mentorship sessions update by participants') then
    raise exception 'unsafe participant update policy has reappeared';
  end if;
  if has_function_privilege('authenticated',
    'private.save_mentorship_notes_draft(uuid,text)','EXECUTE')
    or has_function_privilege('authenticated',
    'private.get_mentorship_notes_draft(uuid)','EXECUTE')
    or has_function_privilege('authenticated',
    'private.publish_mentorship_session_notes(uuid,text,integer)','EXECUTE') then
    raise exception 'authenticated has direct EXECUTE on private notes implementation';
  end if;
  if has_function_privilege('anon',
    'public.save_mentorship_notes_draft(uuid,text)','EXECUTE')
    or has_function_privilege('anon',
    'public.get_mentorship_notes_draft(uuid)','EXECUTE')
    or has_function_privilege('anon',
    'public.publish_mentorship_session_notes(uuid,text,integer)','EXECUTE') then
    raise exception 'anon can call notes public API';
  end if;
  if not has_function_privilege('authenticated',
    'public.save_mentorship_notes_draft(uuid,text)','EXECUTE')
    or not has_function_privilege('authenticated',
    'public.get_mentorship_notes_draft(uuid)','EXECUTE')
    or not has_function_privilege('authenticated',
    'public.publish_mentorship_session_notes(uuid,text,integer)','EXECUTE') then
    raise exception 'authenticated missing notes public API execute permission';
  end if;
  if not exists(select 1 from pg_constraint where conname='mentorship_requests_preferred_timezone_length') then
    raise exception 'time zone check is absent';
  end if;
  if not exists(select 1 from pg_trigger where tgname='trg_validate_mentorship_preferred_timezone') then
    raise exception 'time zone validation trigger is absent';
  end if;
  raise notice 'Section 2 structural security checks passed; real Auth E2E still required';
end;
$check$;
