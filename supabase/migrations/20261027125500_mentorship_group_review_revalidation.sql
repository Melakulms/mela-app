-- Staging only: prevent late admissions and re-check adult eligibility at approval time.
drop policy if exists mentorship_group_interest_self_insert on public.mentorship_group_interests;
create policy mentorship_group_interest_self_insert
on public.mentorship_group_interests for insert to authenticated
with check (
  learner_id=(select auth.uid())
  and status='pending' and reviewed_by is null and reviewed_at is null
  and exists (select 1 from public.mentorship_groups g
    join public.mentor_profiles m on m.user_id=g.mentor_id
    where g.id=group_id and g.status='published'
      and g.starts_at>now() and m.verified and m.active)
);

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
      select 1 from public.profiles p where p.id=new.learner_id
        and p.role='student' and p.account_status='active' and p.deleted_at is null
        and p.education_stage_key in ('college_tvet','university')
    ) or not public.is_adult(new.learner_id)
      or not private.user_has_adult_work_attestation(new.learner_id) then
      raise exception 'group mentoring requires a verified eligible adult learner';
    end if;
    if not exists (
      select 1 from public.mentorship_groups g
        join public.mentor_profiles m on m.user_id=g.mentor_id
      where g.id=new.group_id and g.status='published'
        and g.starts_at>now() and m.active and m.verified
    ) then raise exception 'future published group with verified mentor required';
    end if;
  elsif tg_op='UPDATE' then
    if not private.is_admin_user() or coalesce((auth.jwt()->>'aal'),'')<>'aal2' then
      raise exception 'MFA administrator required for group reviews';
    end if;
    if new.id is distinct from old.id or new.group_id is distinct from old.group_id
      or new.learner_id is distinct from old.learner_id
      or new.created_at is distinct from old.created_at then
      raise exception 'group interest identity is immutable';
    end if;
    if old.status<>'pending' or new.status not in ('approved','declined') then
      raise exception 'only pending group interest may be reviewed';
    end if;
    if new.reviewed_by is distinct from (select auth.uid()) or new.reviewed_at is null then
      raise exception 'record reviewer and review timestamp';
    end if;
    if new.status='approved' then
      -- Re-check eligibility; the learner may have become suspended or revoked
      -- their adult work attestation since first applying.
      if not exists (
        select 1 from public.profiles p where p.id=new.learner_id
          and p.role='student' and p.account_status='active' and p.deleted_at is null
          and p.education_stage_key in ('college_tvet','university')
      ) or not public.is_adult(new.learner_id)
        or not private.user_has_adult_work_attestation(new.learner_id) then
        raise exception 'learner is no longer eligible for supervised group approval';
      end if;
      select g.capacity,(g.status='published' and g.starts_at>now() and m.verified and m.active)
      into v_capacity,v_group_valid
      from public.mentorship_groups g
      join public.mentor_profiles m on m.user_id=g.mentor_id
      where g.id=new.group_id
      for update of g;
      if not coalesce(v_group_valid,false) then raise exception 'group is not available for approval'; end if;
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
