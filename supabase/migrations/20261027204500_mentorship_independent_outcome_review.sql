-- STAGING ONLY. Independent, MFA-controlled review of mentor-supported evidence.
-- "Verified" here means a reviewed narrative outcome, NOT any certificate or Passport credit.
create table if not exists public.mentorship_outcome_verifications (
 claim_id uuid primary key references public.mentorship_outcome_claims(id) on delete cascade,
 decision text not null check(decision in ('evidence_supported','evidence_rejected')),
 public_reason text not null check(char_length(btrim(public_reason)) between 50 and 1000),
 reviewed_by uuid not null references public.profiles(id),
 reviewed_at timestamptz not null default now()
);
create index if not exists mentorship_outcome_verifications_reviewer_idx
on public.mentorship_outcome_verifications(reviewed_by,reviewed_at desc);
alter table public.mentorship_outcome_verifications enable row level security;
revoke all on public.mentorship_outcome_verifications from public,anon,authenticated;
grant select on public.mentorship_outcome_verifications to authenticated;
grant insert(claim_id,decision,public_reason,reviewed_by)
on public.mentorship_outcome_verifications to authenticated;

-- Independent MFA reviewer sees mentor-supported evidence only after authorization.
create policy mentorship_outcome_admin_independent_read
on public.mentorship_outcome_claims for select to authenticated
using(private.is_admin_user() and coalesce((auth.jwt()->>'aal'),'')='aal2');

create policy mentorship_outcome_verification_participant_admin_read
on public.mentorship_outcome_verifications for select to authenticated
using (
  (private.is_admin_user() and coalesce((auth.jwt()->>'aal'),'')='aal2')
  or exists (
    select 1 from public.mentorship_outcome_claims c
    where c.id=mentorship_outcome_verifications.claim_id
      and c.learner_id=(select auth.uid())
  )
);
create policy mentorship_outcome_verification_admin_insert
on public.mentorship_outcome_verifications for insert to authenticated
with check (
  reviewed_by=(select auth.uid()) and private.is_admin_user()
  and coalesce((auth.jwt()->>'aal'),'')='aal2'
);

create or replace function private.guard_mentorship_outcome_verification()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare
 v_actor uuid := (select auth.uid());
 v_learner uuid;
 v_mentor uuid;
begin
 if v_actor is null or v_actor is distinct from new.reviewed_by
   or not private.is_admin_user() or coalesce((auth.jwt()->>'aal'),'')<>'aal2' then
   raise exception 'MFA independent evidence reviewer required';
 end if;
 select c.learner_id,c.mentor_id into v_learner,v_mentor
 from public.mentorship_outcome_claims c
 join public.mentorship_sessions s on s.id=c.session_id
 join public.mentorship_requests r on r.id=s.request_id
 join public.mentor_profiles m on m.user_id=c.mentor_id
 join public.profiles p on p.id=c.learner_id
 where c.id=new.claim_id and c.status='mentor_supported'
   and s.status='completed' and s.completed_at is not null
   and s.mentee_id=c.learner_id and s.mentor_id=c.mentor_id
   and r.status='accepted' and r.id=s.request_id
   and r.mentee_id=c.learner_id and r.mentor_id=c.mentor_id
   and m.verified and m.active and p.role='student'
   and p.account_status='active' and p.deleted_at is null;
 if v_learner is null or v_actor in (v_learner,v_mentor)
   or not private.user_has_guardian_or_adult_clearance(v_learner) then
   raise exception 'independent valid completed mentorship and learner clearance required';
 end if;
 return new;
end;
$fn$;
revoke all on function private.guard_mentorship_outcome_verification()
from public,anon,authenticated;
create trigger trg_guard_mentorship_outcome_verification
before insert on public.mentorship_outcome_verifications
for each row execute function private.guard_mentorship_outcome_verification();

create or replace function private.audit_mentorship_outcome_verification()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
 insert into public.admin_audit_logs(actor_id,action,entity_type,entity_id,details)
 values(new.reviewed_by,'mentorship_outcome_independent_reviewed',
   'mentorship_outcome_claim',new.claim_id,
   jsonb_build_object('decision',new.decision,'credential_awarded',false));
 return new;
end;
$fn$;
revoke all on function private.audit_mentorship_outcome_verification()
from public,anon,authenticated;
create trigger trg_audit_mentorship_outcome_verification
after insert on public.mentorship_outcome_verifications
for each row execute function private.audit_mentorship_outcome_verification();
