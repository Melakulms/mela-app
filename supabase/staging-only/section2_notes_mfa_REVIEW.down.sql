-- DRAFT STAGING-ONLY ROLLBACK. Execute in one transaction after explicit review.
-- First verify these restored function definitions still match pre-migration staging.
-- Existing published mentorship_sessions.notes is intentionally preserved.
-- Do NOT recreate the previously removed permissive participant UPDATE policy.
do $guard$
begin
  if exists(select 1 from public.mentorship_session_note_drafts) then
    raise exception 'rollback blocked: unpublished private mentor drafts still exist';
  end if;
  if exists(select 1 from public.mentorship_sessions where notes_revision > 0)
    and current_setting('mela.confirm_rollback',true) is distinct from 'yes' then
    raise exception 'rollback blocked: notes revision history would be lost; acknowledge with set local mela.confirm_rollback = ''yes''';
  end if;
end;
$guard$;

drop function if exists public.publish_mentorship_session_notes(uuid,text,integer);
drop function if exists public.get_mentorship_notes_draft(uuid);
drop function if exists public.save_mentorship_notes_draft(uuid,text);

-- Definitions captured from staging on 2026-10-28. Diff against live staging
-- before applying a forward migration; rebuild this rollback if they diverge.
create or replace function private.complete_mentorship_session(p_session_id uuid,p_notes text default null::text)
returns public.mentorship_sessions language plpgsql security definer set search_path to '' as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_admin boolean := private.is_admin_user() and
    coalesce((auth.jwt()->>'aal'),'')='aal2';
  v_session public.mentorship_sessions%rowtype;
  v_notes text := nullif(btrim(coalesce(p_notes,'')),'');
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  select * into v_session from public.mentorship_sessions where id=p_session_id for update;
  if not found then raise exception 'session not found'; end if;
  if v_session.mentor_id is distinct from v_actor and not v_admin then
    raise exception 'only active verified mentor or MFA administrator can complete a session';
  end if;
  if v_session.status<>'scheduled' then raise exception 'only scheduled sessions can be completed'; end if;
  if v_session.scheduled_at is null or v_session.duration_min is null
    or v_session.duration_min not between 15 and 180 then
    raise exception 'valid scheduled session required for completion';
  end if;
  if v_session.scheduled_at+make_interval(mins=>v_session.duration_min)>now() then
    raise exception 'session cannot be completed before the full scheduled duration';
  end if;
  if v_notes is not null and char_length(v_notes)>2000 then
    raise exception 'mentorship completion notes must be 2000 characters or fewer';
  end if;
  if not exists(
    select 1 from public.mentorship_requests r
      join public.mentor_profiles m on m.user_id=r.mentor_id
      join public.profiles p on p.id=r.mentee_id
    where r.id=v_session.request_id and r.status='accepted'
      and r.mentor_id=v_session.mentor_id and r.mentee_id=v_session.mentee_id
      and m.verified and m.active
      and p.role='student' and p.account_status='active' and p.deleted_at is null
  ) then
    raise exception 'active verified mentor and accepted eligible mentorship required';
  end if;
  if not private.user_has_guardian_or_adult_clearance(v_session.mentee_id) then
    raise exception 'current verified guardian or adult clearance required for completion';
  end if;
  update public.mentorship_sessions
    set status='completed',completed_at=now(),updated_at=now(),
      notes=coalesce(v_notes,notes)
    where id=p_session_id returning * into v_session;
  return v_session;
end;
$fn$;

create or replace function private.notify_mentorship_session_change()
returns trigger language plpgsql security definer
set search_path to 'pg_catalog','public','private' as $fn$
begin
  if new.status is distinct from old.status then
    if new.status='completed' then
      perform private.create_notification(new.mentee_id,'Mentorship session completed',
        'Your mentorship session was marked completed.','mentorship_sessions',new.id);
    elsif new.status='cancelled' then
      perform private.create_notification(
        case when (select auth.uid())=new.mentor_id then new.mentee_id else new.mentor_id end,
        'Mentorship session cancelled','A mentorship session was cancelled.','mentorship_sessions',new.id);
    end if;
  elsif new.scheduled_at is distinct from old.scheduled_at then
    perform private.create_notification(new.mentee_id,'Mentorship session rescheduled',
      'Your mentor changed the scheduled session time.','mentorship_sessions',new.id);
  end if;
  return new;
end;
$fn$;

drop function if exists private.publish_mentorship_session_notes(uuid,text,integer);
drop function if exists private.get_mentorship_notes_draft(uuid);
drop function if exists private.save_mentorship_notes_draft(uuid,text);
drop function if exists private.mentorship_notes_session_for_mentor(uuid,boolean);
drop function if exists private.mentorship_updates_enabled(uuid);

drop table if exists public.mentorship_session_note_drafts;
alter table public.mentorship_sessions drop constraint if exists mentorship_sessions_notes_revision_check;
alter table public.mentorship_sessions drop column if exists notes_published_at;
alter table public.mentorship_sessions drop column if exists notes_notified_revision;
alter table public.mentorship_sessions drop column if exists notes_revision;
