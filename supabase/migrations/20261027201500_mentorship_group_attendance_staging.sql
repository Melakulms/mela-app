-- STAGING ONLY. Manually reported group attendance, NOT verified live-call telemetry.
-- No meetings, qualifications, payments or Career Passport credentials are created.
-- One immutable reviewer record per genuinely approved adult group interest.
create table if not exists public.mentorship_group_attendance (
  interest_id uuid primary key references public.mentorship_group_interests(id) on delete cascade,
  status text not null check (status in ('reported_present','reported_absent')),
  explanation text not null check (char_length(btrim(explanation)) between 20 and 1000),
  recorded_by uuid not null references public.profiles(id),
  recorded_at timestamptz not null default now()
);
create index if not exists mentorship_group_attendance_reviewer_idx
 on public.mentorship_group_attendance(recorded_by,recorded_at desc);
alter table public.mentorship_group_attendance enable row level security;
revoke all on public.mentorship_group_attendance from public,anon,authenticated;
grant select on public.mentorship_group_attendance to authenticated;
grant insert(interest_id,status,explanation,recorded_by)
 on public.mentorship_group_attendance to authenticated;

create policy mentorship_attendance_participant_or_mfa_admin_read
on public.mentorship_group_attendance for select to authenticated
using (
  (private.is_admin_user() and coalesce((auth.jwt()->>'aal'),'')='aal2')
  or exists (
    select 1 from public.mentorship_group_interests i
    where i.id=mentorship_group_attendance.interest_id
      and i.learner_id=(select auth.uid()) and i.status='approved'
  )
);
create policy mentorship_attendance_mfa_admin_insert
on public.mentorship_group_attendance for insert to authenticated
with check (
  recorded_by=(select auth.uid()) and private.is_admin_user()
  and coalesce((auth.jwt()->>'aal'),'')='aal2'
);

create or replace function private.guard_mentorship_group_attendance()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare v_actor uuid := (select auth.uid());
begin
  if v_actor is null or v_actor is distinct from new.recorded_by
     or not private.is_admin_user() or coalesce((auth.jwt()->>'aal'),'')<>'aal2' then
    raise exception 'MFA administrator required to record group attendance';
  end if;
  -- Program start alone is not proof of attendance. A reviewer records manual evidence
  -- only after a reasonable start window and an independently approved interest.
  if not exists (
    select 1 from public.mentorship_group_interests i
    join public.mentorship_groups g on g.id=i.group_id
    where i.id=new.interest_id and i.status='approved'
      and g.status in ('published','closed')
      and g.starts_at is not null and g.starts_at<=now()-interval '1 hour'
  ) then
    raise exception 'approved participant in a started group required';
  end if;
  return new;
end;
$fn$;
revoke all on function private.guard_mentorship_group_attendance()
 from public,anon,authenticated;
create trigger trg_guard_mentorship_group_attendance
before insert on public.mentorship_group_attendance
for each row execute function private.guard_mentorship_group_attendance();

create or replace function private.audit_mentorship_group_attendance()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
  insert into public.admin_audit_logs(actor_id,action,entity_type,entity_id,details)
  values(new.recorded_by,'mentorship_group_attendance_recorded',
    'mentorship_group_interest',new.interest_id,
    jsonb_build_object('attendance_status',new.status,'method','manual_report',
      'independent_credential',false));
  return new;
end;
$fn$;
revoke all on function private.audit_mentorship_group_attendance()
 from public,anon,authenticated;
create trigger trg_audit_mentorship_group_attendance
after insert on public.mentorship_group_attendance
for each row execute function private.audit_mentorship_group_attendance();
