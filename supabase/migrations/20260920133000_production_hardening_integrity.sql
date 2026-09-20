-- Production hardening: application update integrity, Arena rejoin state machine, and review validation.
-- Applied to Supabase project duizgtmbptmlbyipreqg on 2026-09-20.

create or replace function private.guard_application_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare actor text;
begin
  actor := private.application_update_actor(old.id);
  if actor is null then raise exception 'Not authorized to update this application'; end if;
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
create trigger trg_guard_application_update before update on public.applications
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
  select * into v_m from public.arena_matches where id=p_match_id for update;
  if v_m.id is null or v_m.status not in ('open','ready') then raise exception 'arena is not joinable'; end if;
  if v_m.join_deadline is not null and now()>v_m.join_deadline then raise exception 'arena join deadline passed'; end if;
  if v_m.visibility in ('private','invite') and v_m.creator_id<>v_uid
     and not exists(select 1 from public.arena_invites where match_id=p_match_id and invited_user_id=v_uid and status in ('pending','accepted')) then
    raise exception 'arena invitation required';
  end if;
  select * into v_existing from public.arena_participants where match_id=p_match_id and user_id=v_uid for update;
  if v_existing.id is not null then
    if v_existing.status='joined' then return v_existing;
    elsif v_existing.status in ('active','finished','disqualified') then
      raise exception 'user already has a non-rejoinable participation in this arena';
    end if;
  end if;
  if (select count(*) from public.arena_participants where match_id=p_match_id and status in ('joined','active','finished')) >= v_m.max_participants then
    raise exception 'arena is full';
  end if;
  insert into public.arena_participants(match_id,user_id,status,ready)
  values(p_match_id,v_uid,'joined',false)
  on conflict(match_id,user_id) do update set status='joined',ready=false,finished_at=null,placement=null
  returning * into v;
  update public.arena_invites set status='accepted',responded_at=now()
  where match_id=p_match_id and invited_user_id=v_uid and status='pending';
  return v;
end;
$$;

create or replace function private.submit_work_review(
  p_contract_id uuid,p_rating integer,p_comment text,p_quality integer,
  p_communication integer,p_timeliness integer
)
returns public.work_reviews
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := (select auth.uid()); v_c public.freelance_contracts; v public.work_reviews;
begin
  if v_uid is null then raise exception 'authentication required'; end if;
  select * into v_c from public.freelance_contracts where id=p_contract_id;
  if v_c.id is null or v_c.status<>'completed' then raise exception 'completed contract required'; end if;
  if p_rating < 1 or p_rating > 5 then raise exception 'rating must be 1 to 5'; end if;
  if p_quality is not null and (p_quality < 1 or p_quality > 5) then raise exception 'quality rating must be 1 to 5'; end if;
  if p_communication is not null and (p_communication < 1 or p_communication > 5) then raise exception 'communication rating must be 1 to 5'; end if;
  if p_timeliness is not null and (p_timeliness < 1 or p_timeliness > 5) then raise exception 'timeliness rating must be 1 to 5'; end if;
  if v_uid=v_c.freelancer_id then
    insert into public.work_reviews(contract_id,reviewer_user_id,reviewee_employer_id,rating,comment,quality_rating,communication_rating,timeliness_rating)
    values(p_contract_id,v_uid,v_c.employer_id,p_rating,p_comment,p_quality,p_communication,p_timeliness) returning * into v;
    perform private.refresh_work_reputation(null,v_c.employer_id);
  elsif private.has_employer_access(v_c.employer_id,true) then
    insert into public.work_reviews(contract_id,reviewer_user_id,reviewee_user_id,rating,comment,quality_rating,communication_rating,timeliness_rating)
    values(p_contract_id,v_uid,v_c.freelancer_id,p_rating,p_comment,p_quality,p_communication,p_timeliness) returning * into v;
    perform private.refresh_work_reputation(v_c.freelancer_id,null);
  else raise exception 'contract participant access required';
  end if;
  return v;
exception when unique_violation then
  raise exception 'You have already submitted a review for this completed contract';
end;
$$;
