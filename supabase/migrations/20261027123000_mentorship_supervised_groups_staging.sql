-- MELA Mentorship: controlled group program enrollment interest, staging only.
-- Published program does NOT imply a live meeting, chat room or paid booking.
-- Adult higher-ed learners may submit interest; only MFA administrators approve.

create table if not exists public.mentorship_group_interests (
  id uuid primary key default extensions.gen_random_uuid(),
  group_id uuid not null references public.mentorship_groups(id) on delete cascade,
  learner_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(group_id, learner_id)
);
create index if not exists mentorship_group_interests_status_idx
on public.mentorship_group_interests (group_id,status,created_at);

alter table public.mentorship_group_interests enable row level security;
revoke all on public.mentorship_group_interests from anon,authenticated;
grant select on public.mentorship_group_interests to authenticated;
grant insert (group_id,learner_id) on public.mentorship_group_interests to authenticated;
grant delete on public.mentorship_group_interests to authenticated;
grant update (status,reviewed_by,reviewed_at) on public.mentorship_group_interests to authenticated;

create policy mentorship_group_interest_self_or_admin_read
on public.mentorship_group_interests for select to authenticated
using (learner_id=(select auth.uid()) or
  (private.is_admin_user() and coalesce((auth.jwt()->>'aal'),'')='aal2'));
create policy mentorship_group_interest_self_insert
on public.mentorship_group_interests for insert to authenticated
with check (
  learner_id=(select auth.uid())
  and status='pending' and reviewed_by is null and reviewed_at is null
  and exists (select 1 from public.mentorship_groups g
    join public.mentor_profiles m on m.user_id=g.mentor_id
    where g.id=group_id and g.status='published' and m.verified and m.active)
);
create policy mentorship_group_interest_self_delete_pending
on public.mentorship_group_interests for delete to authenticated
using (learner_id=(select auth.uid()) and status='pending');
create policy mentorship_group_interest_admin_decide
on public.mentorship_group_interests for update to authenticated
using (private.is_admin_user() and coalesce((auth.jwt()->>'aal'),'')='aal2')
with check (private.is_admin_user() and coalesce((auth.jwt()->>'aal'),'')='aal2');

-- Server-side verification matters even when a future client disregards filtering.
create or replace function private.guard_mentorship_group_interest()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare
  v_capacity integer;
  v_approved integer;
  v_group_valid boolean;
begin
  if tg_op='INSERT' then
    if new.status<>'pending' or new.reviewed_at is not null or new.reviewed_by is not null then
      raise exception 'new group interest must be pending';
    end if;
    if not exists (
      select 1 from public.profiles p
      where p.id=new.learner_id and p.role='student' and p.account_status='active'
        and p.deleted_at is null and p.education_stage_key in ('college_tvet','university')
    ) or not public.is_adult(new.learner_id)
      or not private.user_has_adult_work_attestation(new.learner_id) then
      raise exception 'group mentoring requires a verified eligible adult learner';
    end if;
    if not exists (
      select 1 from public.mentorship_groups g
      join public.mentor_profiles m on m.user_id=g.mentor_id
      where g.id=new.group_id and g.status='published' and m.active and m.verified
    ) then
      raise exception 'published supervised group with verified mentor required';
    end if;
  elsif tg_op='UPDATE' then
    if not private.is_admin_user() or coalesce((auth.jwt()->>'aal'),'')<>'aal2' then
      raise exception 'MFA administrator required for group reviews';
    end if;
    if new.id is distinct from old.id or new.group_id is distinct from old.group_id or
      new.learner_id is distinct from old.learner_id or
      new.created_at is distinct from old.created_at then
      raise exception 'group interest identity is immutable';
    end if;
    if old.status<>'pending' or new.status not in ('approved','declined') then
      raise exception 'only pending group interest may be reviewed';
    end if;
    if new.reviewed_by is distinct from (select auth.uid()) or new.reviewed_at is null then
      raise exception 'record reviewer and review timestamp';
    end if;
    if new.status='approved' then
      -- Serialize all approvals on a group row to prevent overbooking.
      select g.capacity,
        (g.status='published' and m.verified and m.active)
      into v_capacity,v_group_valid
      from public.mentorship_groups g
      join public.mentor_profiles m on m.user_id=g.mentor_id
      where g.id=new.group_id
      for update of g;
      if not coalesce(v_group_valid,false) then
        raise exception 'group is not available for approval';
      end if;
      select count(*) into v_approved from public.mentorship_group_interests
      where group_id=new.group_id and status='approved';
      if v_approved>=v_capacity then raise exception 'group is already at capacity'; end if;
    end if;
    insert into public.admin_audit_logs(actor_id,action,entity_type,entity_id,details)
    values ((select auth.uid()),'mentorship_group_interest_reviewed',
      'mentorship_group_interest',new.id,
      jsonb_build_object('from',old.status,'to',new.status,'group_id',new.group_id));
  end if;
  return new;
end;
$fn$;
revoke all on function private.guard_mentorship_group_interest() from public,anon,authenticated;
drop trigger if exists trg_guard_mentorship_group_interest_insert on public.mentorship_group_interests;
create trigger trg_guard_mentorship_group_interest_insert
  before insert on public.mentorship_group_interests
  for each row execute function private.guard_mentorship_group_interest();
drop trigger if exists trg_guard_mentorship_group_interest_review on public.mentorship_group_interests;
create trigger trg_guard_mentorship_group_interest_review
  before update on public.mentorship_group_interests
  for each row execute function private.guard_mentorship_group_interest();

-- Admin-only program management. Status can only become published with a verified active mentor.
create or replace function private.guard_mentorship_group_program()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
  if not private.is_admin_user() or coalesce((auth.jwt()->>'aal'),'')<>'aal2' then
    raise exception 'MFA administrator required for mentorship programs';
  end if;
  if new.status='published' then
    if not exists(select 1 from public.mentor_profiles m
       where m.user_id=new.mentor_id and m.active and m.verified) then
      raise exception 'verified active mentor needed before publishing group program';
    end if;
    if new.starts_at is null or new.starts_at <= now() then
      raise exception 'published group program needs a future start date';
    end if;
  end if;
  if tg_op='UPDATE' and old.id is distinct from new.id then
    raise exception 'group program identifier immutable';
  end if;
  return new;
end;
$fn$;
revoke all on function private.guard_mentorship_group_program() from public,anon,authenticated;
drop trigger if exists trg_guard_mentorship_group_program on public.mentorship_groups;
create trigger trg_guard_mentorship_group_program
  before insert or update on public.mentorship_groups
  for each row execute function private.guard_mentorship_group_program();

create policy mentorship_group_program_admin_read on public.mentorship_groups for select to authenticated
using (private.is_admin_user() and coalesce((auth.jwt()->>'aal'),'')='aal2');
create policy mentorship_group_program_admin_insert on public.mentorship_groups for insert to authenticated
with check (private.is_admin_user() and coalesce((auth.jwt()->>'aal'),'')='aal2');
create policy mentorship_group_program_admin_update on public.mentorship_groups for update to authenticated
using (private.is_admin_user() and coalesce((auth.jwt()->>'aal'),'')='aal2')
with check (private.is_admin_user() and coalesce((auth.jwt()->>'aal'),'')='aal2');
grant insert (title,description,category,mentor_id,starts_at,capacity,status)
  on public.mentorship_groups to authenticated;
grant update (title,description,category,mentor_id,starts_at,capacity,status)
  on public.mentorship_groups to authenticated;

-- No anonymous program listing, no direct learner approval and no auto-created meetings.
