-- DRAFT FOR REVIEW: NOT APPLIED. STAGING ONLY.
-- This is intentionally outside supabase/migrations to prevent an automatic
-- production deployment. Review privileges and run rollback + real AAL2 tests first.
--
-- Server-enforced AAL2, mentor ownership and child/adult clearance.
-- Public security-definer wrappers are callable by authenticated only;
-- private implementations have no authenticated/anon/PUBLIC EXECUTE grants.
-- "Publish" accepts the exact confirmed editor body and checks the revision
-- while holding the session row lock. Saving draft never changes learner notes.

create table if not exists public.mentorship_session_note_drafts (
  session_id uuid primary key references public.mentorship_sessions(id) on delete cascade,
  mentor_id uuid not null,
  body text not null check (char_length(body) between 1 and 2000),
  updated_at timestamptz not null default now()
);
alter table public.mentorship_session_note_drafts enable row level security;
revoke all on public.mentorship_session_note_drafts from PUBLIC, anon, authenticated;

alter table public.mentorship_sessions
  add column if not exists notes_revision integer not null default 0,
  add column if not exists notes_notified_revision integer not null default 0,
  add column if not exists notes_published_at timestamptz;
alter table public.mentorship_sessions drop constraint if exists mentorship_sessions_notes_revision_check;
alter table public.mentorship_sessions add constraint mentorship_sessions_notes_revision_check
  check (notes_revision >= 0 and notes_notified_revision between 0 and notes_revision);
revoke update (notes,notes_revision,notes_notified_revision,notes_published_at)
  on public.mentorship_sessions from PUBLIC,anon,authenticated;

create or replace function private.mentorship_notes_session_for_mentor(
  p_session_id uuid, p_lock boolean default false
) returns public.mentorship_sessions
language plpgsql security definer set search_path = '' as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_session public.mentorship_sessions%rowtype;
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  if coalesce((auth.jwt()->>'aal'),'') <> 'aal2' then
    raise exception 'MFA verification required for mentorship notes';
  end if;
  if p_lock then
    select * into v_session from public.mentorship_sessions where id=p_session_id for update;
  else
    select * into v_session from public.mentorship_sessions where id=p_session_id;
  end if;
  if not found or v_session.mentor_id is distinct from v_actor then
    raise exception 'session not available to this account';
  end if;
  if v_session.status not in ('scheduled','completed') then
    raise exception 'notes are available for scheduled or completed sessions only';
  end if;
  if not exists (
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
    raise exception 'current verified guardian or adult clearance required';
  end if;
  return v_session;
end;
$fn$;
revoke all on function private.mentorship_notes_session_for_mentor(uuid,boolean) from PUBLIC,anon,authenticated;

create or replace function private.mentorship_updates_enabled(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $fn$
  select coalesce((
    select np.mentorship_updates from public.notification_preferences np where np.user_id=p_user
  ),true);
$fn$;
revoke all on function private.mentorship_updates_enabled(uuid) from PUBLIC,anon,authenticated;

create or replace function private.save_mentorship_notes_draft(p_session_id uuid,p_body text)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  v_session public.mentorship_sessions%rowtype;
  v_body text := nullif(btrim(coalesce(p_body,'')),'');
begin
  v_session := private.mentorship_notes_session_for_mentor(p_session_id,false);
  if v_body is not null and char_length(v_body)>2000 then
    raise exception 'mentorship notes must be 2000 characters or fewer';
  end if;
  if v_body is null then
    delete from public.mentorship_session_note_drafts where session_id=p_session_id;
  else
    insert into public.mentorship_session_note_drafts(session_id,mentor_id,body,updated_at)
    values(p_session_id,v_session.mentor_id,v_body,now())
    on conflict(session_id) do update
      set mentor_id=excluded.mentor_id,body=excluded.body,updated_at=now();
  end if;
  insert into public.admin_audit_logs(actor_id,action,entity_type,entity_id,details)
  values((select auth.uid()),'mentorship_notes_draft_saved','mentorship_session',p_session_id,
    jsonb_build_object('draft_length',coalesce(char_length(v_body),0)));
  return jsonb_build_object('saved',true);
end;
$fn$;
revoke all on function private.save_mentorship_notes_draft(uuid,text) from PUBLIC,anon,authenticated;

create or replace function private.get_mentorship_notes_draft(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  v_session public.mentorship_sessions%rowtype;
  v_draft public.mentorship_session_note_drafts%rowtype;
begin
  v_session := private.mentorship_notes_session_for_mentor(p_session_id,false);
  select * into v_draft from public.mentorship_session_note_drafts where session_id=p_session_id;
  insert into public.admin_audit_logs(actor_id,action,entity_type,entity_id,details)
  values((select auth.uid()),'mentorship_notes_draft_read','mentorship_session',p_session_id,
    jsonb_build_object('draft_length',coalesce(char_length(v_draft.body),0)));
  return jsonb_build_object('body',v_draft.body,'updated_at',v_draft.updated_at,
    'published_revision',v_session.notes_revision);
end;
$fn$;
revoke all on function private.get_mentorship_notes_draft(uuid) from PUBLIC,anon,authenticated;

create or replace function private.publish_mentorship_session_notes(
  p_session_id uuid,p_body text,p_expected_revision integer
) returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  v_session public.mentorship_sessions%rowtype;
  v_body text := nullif(btrim(coalesce(p_body,'')),'');
  v_notified boolean := false;
begin
  v_session := private.mentorship_notes_session_for_mentor(p_session_id,true);
  if p_expected_revision is null or v_session.notes_revision<>p_expected_revision then
    raise exception 'published notes changed: reload before publishing';
  end if;
  if v_body is null or char_length(v_body)>2000 then
    raise exception 'published notes require 1 to 2000 characters';
  end if;
  -- Exact visible draft body is provided with this call: no stale stored draft.
  delete from public.mentorship_session_note_drafts where session_id=p_session_id;
  if v_body is not distinct from v_session.notes then
    return jsonb_build_object('notes_revision',v_session.notes_revision,'changed',false);
  end if;
  update public.mentorship_sessions set notes=v_body,notes_revision=notes_revision+1,
    notes_published_at=now(),updated_at=now()
    where id=p_session_id returning * into v_session;
  if private.mentorship_updates_enabled(v_session.mentee_id) then
    perform private.create_notification(v_session.mentee_id,
      'Mentorship notes updated','Your mentor published follow-up notes for a session.',
      'mentorship_sessions',p_session_id);
    v_notified := true;
  end if;
  update public.mentorship_sessions
    set notes_notified_revision=notes_revision where id=p_session_id;
  insert into public.admin_audit_logs(actor_id,action,entity_type,entity_id,details)
  values((select auth.uid()),'mentorship_notes_published','mentorship_session',p_session_id,
    jsonb_build_object('revision',v_session.notes_revision,'published_length',char_length(v_body),
      'learner_notified',v_notified));
  return jsonb_build_object('notes_revision',v_session.notes_revision,'changed',true);
end;
$fn$;
revoke all on function private.publish_mentorship_session_notes(uuid,text,integer)
  from PUBLIC,anon,authenticated;

-- Public wrappers, each executing as the trusted owner. An authenticated JWT
-- never gets to supply another actor ID; all private functions use auth.uid().
create or replace function public.save_mentorship_notes_draft(p_session_id uuid,p_body text)
returns jsonb language sql security definer set search_path = '' as $fn$
  select private.save_mentorship_notes_draft(p_session_id,p_body);
$fn$;
create or replace function public.get_mentorship_notes_draft(p_session_id uuid)
returns jsonb language sql security definer set search_path = '' as $fn$
  select private.get_mentorship_notes_draft(p_session_id);
$fn$;
create or replace function public.publish_mentorship_session_notes(
  p_session_id uuid,p_body text,p_expected_revision integer
) returns jsonb language sql security definer set search_path = '' as $fn$
  select private.publish_mentorship_session_notes(p_session_id,p_body,p_expected_revision);
$fn$;
revoke all on function public.save_mentorship_notes_draft(uuid,text) from PUBLIC,anon,authenticated;
revoke all on function public.get_mentorship_notes_draft(uuid) from PUBLIC,anon,authenticated;
revoke all on function public.publish_mentorship_session_notes(uuid,text,integer)
  from PUBLIC,anon,authenticated;
grant execute on function public.save_mentorship_notes_draft(uuid,text) to authenticated;
grant execute on function public.get_mentorship_notes_draft(uuid) to authenticated;
grant execute on function public.publish_mentorship_session_notes(uuid,text,integer) to authenticated;

-- Apply the learner's existing notification preference to session notices.
create or replace function private.notify_mentorship_session_change()
returns trigger language plpgsql security definer set search_path = 'pg_catalog','public','private' as $fn$
begin
  if new.status is distinct from old.status then
    if new.status='completed' and private.mentorship_updates_enabled(new.mentee_id) then
      perform private.create_notification(new.mentee_id,'Mentorship session completed',
        'Your mentorship session was marked completed.','mentorship_sessions',new.id);
    elsif new.status='cancelled' then
      if (select auth.uid())=new.mentor_id then
        if private.mentorship_updates_enabled(new.mentee_id) then
          perform private.create_notification(new.mentee_id,'Mentorship session cancelled',
            'A mentorship session was cancelled.','mentorship_sessions',new.id);
        end if;
      elsif private.mentorship_updates_enabled(new.mentor_id) then
        perform private.create_notification(new.mentor_id,'Mentorship session cancelled',
          'A mentorship session was cancelled.','mentorship_sessions',new.id);
      end if;
    end if;
  elsif new.scheduled_at is distinct from old.scheduled_at
    and private.mentorship_updates_enabled(new.mentee_id) then
      perform private.create_notification(new.mentee_id,'Mentorship session rescheduled',
        'Your mentor changed the scheduled session time.','mentorship_sessions',new.id);
  end if;
  return new;
end;
$fn$;

-- Replaces previous completion body (same guards as current staging) with
-- an additional AAL2 gate and notes revision/audit only when notes change.
create or replace function private.complete_mentorship_session(p_session_id uuid,p_notes text default null)
returns public.mentorship_sessions language plpgsql security definer set search_path = '' as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_admin boolean := private.is_admin_user()
    and coalesce((auth.jwt()->>'aal'),'')='aal2';
  v_session public.mentorship_sessions%rowtype;
  v_notes text := nullif(btrim(coalesce(p_notes,'')),'');
  v_notes_changed boolean;
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  select * into v_session from public.mentorship_sessions where id=p_session_id for update;
  if not found then raise exception 'session not found'; end if;
  if v_session.mentor_id is distinct from v_actor and not v_admin then
    raise exception 'only active verified mentor or MFA administrator can complete a session';
  end if;
  if v_session.status<>'scheduled' then
    raise exception 'only scheduled sessions can be completed';
  end if;
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
  if v_notes is not null and coalesce((auth.jwt()->>'aal'),'')<>'aal2' then
    raise exception 'MFA verification is required to publish completion notes';
  end if;
  if not exists (
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
  v_notes_changed := v_notes is not null and v_notes is distinct from v_session.notes;
  update public.mentorship_sessions set status='completed',completed_at=now(),updated_at=now(),
    notes=coalesce(v_notes,notes),
    notes_revision=notes_revision+case when v_notes_changed then 1 else 0 end,
    notes_notified_revision=case when v_notes_changed then notes_revision+1 else notes_notified_revision end,
    notes_published_at=case when v_notes_changed then now() else notes_published_at end
    where id=p_session_id returning * into v_session;
  if v_notes_changed then
    delete from public.mentorship_session_note_drafts where session_id=p_session_id;
    insert into public.admin_audit_logs(actor_id,action,entity_type,entity_id,details)
    values(v_actor,'mentorship_notes_published','mentorship_session',p_session_id,
      jsonb_build_object('revision',v_session.notes_revision,'published_length',char_length(v_notes),'via','completion'));
  end if;
  return v_session;
end;
$fn$;
