-- STAGING ONLY: adult learner eligibility review for protected mentorship.
-- Identity evidence is reviewed separately; no document URLs or numbers in this table.
create table if not exists public.mentorship_adult_age_reviews (
 id uuid primary key default extensions.gen_random_uuid(),
 learner_id uuid not null unique references public.profiles(id) on delete cascade,
 claimed_date_of_birth date not null check (claimed_date_of_birth between date '1900-01-01' and date '2100-01-01'),
 consent_to_mentorship_rules boolean not null default false check (consent_to_mentorship_rules=true),
 status text not null default 'pending' check(status in ('pending','approved','declined')),
 reviewer_id uuid references public.profiles(id),
 reviewed_at timestamptz,
 reviewer_notes text,
 created_at timestamptz not null default now(),
 constraint mentorship_age_review_status_consistency check (
  (status='pending' and reviewer_id is null and reviewed_at is null and reviewer_notes is null)
  or (status in ('approved','declined') and reviewer_id is not null and reviewed_at is not null
   and char_length(btrim(coalesce(reviewer_notes,''))) between 30 and 2000)
 )
);
create index if not exists mentorship_adult_age_reviews_status_idx
 on public.mentorship_adult_age_reviews(status,created_at);
alter table public.mentorship_adult_age_reviews enable row level security;
revoke all on public.mentorship_adult_age_reviews from anon,authenticated;
grant select on public.mentorship_adult_age_reviews to authenticated;
grant insert(learner_id,claimed_date_of_birth,consent_to_mentorship_rules)
 on public.mentorship_adult_age_reviews to authenticated;
grant update(status,reviewer_id,reviewed_at,reviewer_notes)
 on public.mentorship_adult_age_reviews to authenticated;
create policy mentorship_age_request_owner_or_mfa_admin_read on public.mentorship_adult_age_reviews
for select to authenticated using(
 learner_id=(select auth.uid())
 or (private.is_admin_user() and coalesce((auth.jwt()->>'aal'),'')='aal2')
);
create policy mentorship_age_request_owner_insert on public.mentorship_adult_age_reviews
for insert to authenticated with check(
 learner_id=(select auth.uid()) and consent_to_mentorship_rules=true and status='pending'
 and reviewed_at is null and reviewer_id is null and reviewer_notes is null
 and claimed_date_of_birth <= (current_date-interval '18 years')::date
 and exists(select 1 from public.profiles p
   where p.id=learner_id and p.role='student'
   and p.account_status='active' and p.deleted_at is null
   and p.education_stage_key in ('university','college_tvet'))
);
create policy mentorship_age_request_mfa_admin_update on public.mentorship_adult_age_reviews
for update to authenticated
using(private.is_admin_user() and coalesce((auth.jwt()->>'aal'),'')='aal2')
with check(private.is_admin_user() and coalesce((auth.jwt()->>'aal'),'')='aal2');

create or replace function private.mentorship_adult_verified(p_user uuid)
returns boolean language sql stable security definer set search_path=''
as $fn$
select coalesce(exists(
 select 1 from public.mentorship_adult_age_reviews r
 join public.student_profiles sp on sp.user_id=r.learner_id
 join public.profiles p on p.id=r.learner_id
 where r.learner_id=p_user and r.status='approved'
  and r.consent_to_mentorship_rules=true
  and r.reviewer_id is not null and r.reviewed_at is not null
  and p.role='student' and p.account_status='active' and p.deleted_at is null
  and p.education_stage_key in ('university','college_tvet')
  and r.claimed_date_of_birth=sp.date_of_birth
  and public.is_adult(p_user)
),false);
$fn$;
revoke all on function private.mentorship_adult_verified(uuid)
 from public,anon,authenticated;

create or replace function private.guard_mentorship_adult_age_review()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
 if tg_op='INSERT' then
  if new.learner_id is distinct from (select auth.uid()) then
   raise exception 'cannot request another learner age review';
  end if;
  if new.claimed_date_of_birth > (current_date - interval '18 years')::date then
   raise exception 'underage learners cannot request adult-only mentorship';
  end if;
  if not new.consent_to_mentorship_rules then
   raise exception 'explicit adult mentorship safety acknowledgement required';
  end if;
 elsif tg_op='UPDATE' then
  if not private.is_admin_user() or coalesce((auth.jwt()->>'aal'),'')<>'aal2' then
   raise exception 'MFA administrator required for adult eligibility review';
  end if;
  if new.id is distinct from old.id
   or new.learner_id is distinct from old.learner_id
   or new.claimed_date_of_birth is distinct from old.claimed_date_of_birth
   or new.consent_to_mentorship_rules is distinct from old.consent_to_mentorship_rules
   or new.created_at is distinct from old.created_at then
   raise exception 'identity, birth date and original agreement are immutable';
  end if;
  if old.status<>'pending' or new.status not in ('approved','declined') then
   raise exception 'only pending age reviews may be decided once';
  end if;
  if new.reviewer_id is distinct from (select auth.uid())
   or new.reviewed_at is null
   or char_length(btrim(coalesce(new.reviewer_notes,''))) not between 30 and 2000 then
   raise exception 'independent review, reviewer identity and detailed evidence notes required';
  end if;
  if new.reviewer_id=new.learner_id then
   raise exception 'reviewer may not approve their own adult eligibility';
  end if;
  if new.status='approved' then
   if not exists(select 1 from public.profiles p where p.id=new.learner_id
     and p.role='student' and p.education_stage_key in ('university','college_tvet')
     and p.account_status='active' and p.deleted_at is null) then
    raise exception 'only active university or TVET learners may receive adult clearance';
   end if;
   if new.claimed_date_of_birth > (current_date - interval '18 years')::date then
    raise exception 'underage applicant cannot be approved';
   end if;
   -- Existing protected DOB trigger permits an authorized administrator.
   update public.student_profiles set date_of_birth=new.claimed_date_of_birth,
    updated_at=now()
    where user_id=new.learner_id;
   if not found then
    raise exception 'student education profile required for age verification';
   end if;
  end if;
  insert into public.admin_audit_logs(actor_id,action,entity_type,entity_id,details)
    values((select auth.uid()),'mentorship_adult_age_reviewed',
     'mentorship_adult_age_review',new.id,
     jsonb_build_object('decision',new.status,'reviewed',true));
 end if;
 return new;
end;
$fn$;
revoke all on function private.guard_mentorship_adult_age_review()
 from public,anon,authenticated;
create trigger trg_mentorship_adult_age_request_guard
before insert or update on public.mentorship_adult_age_reviews
for each row execute function private.guard_mentorship_adult_age_review();

-- Only mentorship audience rules change, not the platform-wide adult-work policy.
create or replace function private.user_has_guardian_or_adult_clearance(p_user_id uuid)
returns boolean language sql stable security definer set search_path=''
as $fn$
select coalesce((
 select case
 when p.role<>'student' or p.account_status<>'active' or p.deleted_at is not null
   then false
 when p.education_stage_key in ('college_tvet','university')
   then private.mentorship_adult_verified(p_user_id)
 when p.education_stage_key like 'school_%'
   then exists (
     select 1 from public.guardian_relationships g
     where g.learner_id=p_user_id and g.guardian_user_id is not null
      and private.has_verified_guardian_link(g.guardian_user_id,p_user_id)
   )
 else false end
 from public.profiles p where p.id=p_user_id
),false);
$fn$;
revoke all on function private.user_has_guardian_or_adult_clearance(uuid)
 from public,anon,authenticated;
