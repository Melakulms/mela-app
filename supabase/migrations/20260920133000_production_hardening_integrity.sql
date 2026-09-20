-- Production hardening: application update integrity and Arena rejoin state machine.
-- Applied to Supabase project duizgtmbptmlbyipreqg on 2026-09-20.

create or replace function private.guard_application_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor text;
begin
  actor := private.application_update_actor(old.id);

  if actor is null then
    raise exception 'Not authorized to update this application';
  end if;

  if new.id is distinct from old.id
     or new.opportunity_id is distinct from old.opportunity_id
     or new.user_id is distinct from old.user_id
     or new.applicant_id is distinct from old.applicant_id
     or new.submitted_at is distinct from old.submitted_at
     or new.applied_at is distinct from old.applied_at
     or new.passport_snapshot is distinct from old.passport_snapshot
     or new.screening_answers is distinct from old.screening_answers
     or new.resume_document_id is distinct from old.resume_document_id then
    raise exception 'Application identity and submitted evidence are immutable';
  end if;

  if actor = 'applicant' then
    if new.status is distinct from 'withdrawn'::text
       or new.cover_note is distinct from old.cover_note
       or new.reviewed_at is distinct from old.reviewed_at
       or new.reviewer_id is distinct from old.reviewer_id then
      raise exception 'Applicants may only withdraw an application';
    end if;
    new.withdrawn_at := coalesce(new.withdrawn_at, now());
  elsif actor in ('employer','admin') then
    if new.status is distinct from old.status
       and new.status not in ('submitted','reviewing','shortlisted','interview','offered','hired','rejected') then
      raise exception 'Invalid employer application status';
    end if;
  else
    raise exception 'Invalid application update actor';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_guard_application_update on public.applications;
create trigger trg_guard_application_update
before update on public.applications
for each row execute function private.guard_application_update();

create or replace function private.join_arena(p_match_id uuid)
returns public.arena_participants
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_m public.arena_matches;
  v_existing public.arena_participants;
  v public.arena_participants;
begin
  if v_uid is null then raise exception 'authentication required'; end if;

  select * into v_m
  from public.arena_matches
  where id=p_match_id
  for update;

  if v_m.id is null or v_m.status not in ('open','ready') then
    raise exception 'arena is not joinable';
  end if;

  if v_m.join_deadline is not null and now()>v_m.join_deadline then
    raise exception 'arena join deadline passed';
  end if;

  if v_m.visibility in ('private','invite')
     and v_m.creator_id<>v_uid
     and not exists(
       select 1 from public.arena_invites
       where match_id=p_match_id
         and invited_user_id=v_uid
         and status in ('pending','accepted')
     ) then
    raise exception 'arena invitation required';
  end if;

  select * into v_existing
  from public.arena_participants
  where match_id=p_match_id and user_id=v_uid
  for update;

  if v_existing.id is not null then
    if v_existing.status='joined' then
      return v_existing;
    elsif v_existing.status in ('active','finished','disqualified') then
      raise exception 'user already has a non-rejoinable participation in this arena';
    end if;
  end if;

  if (
    select count(*)
    from public.arena_participants
    where match_id=p_match_id
      and status in ('joined','active','finished')
  ) >= v_m.max_participants then
    raise exception 'arena is full';
  end if;

  insert into public.arena_participants(match_id,user_id,status,ready)
  values(p_match_id,v_uid,'joined',false)
  on conflict(match_id,user_id)
  do update set status='joined',ready=false,finished_at=null,placement=null
  returning * into v;

  update public.arena_invites
  set status='accepted',responded_at=now()
  where match_id=p_match_id
    and invited_user_id=v_uid
    and status='pending';

  return v;
end;
$$;
