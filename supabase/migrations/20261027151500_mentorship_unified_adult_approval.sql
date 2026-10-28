-- STAGING ONLY: use independently reviewed mentorship-specific adult eligibility
-- throughout group enrollment and mentor qualification.
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
      or not private.mentorship_adult_verified(new.learner_id) then
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
        or not private.mentorship_adult_verified(new.learner_id) then
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
create or replace function private.finalize_mentorship_verification(
  p_application_id uuid,
  p_credential_reviewed boolean,
  p_safeguarding_reviewed boolean,
  p_review_notes text
)
returns uuid language plpgsql security definer set search_path = ''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_app public.mentorship_applications%rowtype;
  v_profile public.profiles%rowtype;
  v_evidence_exists boolean := false;
  v_notes text := btrim(coalesce(p_review_notes,''));
begin
  if v_actor is null or not private.is_admin_user()
    or coalesce((auth.jwt()->>'aal'),'')<>'aal2' then
    raise exception 'MFA-verified administrator required to verify a mentor';
  end if;
  if not coalesce(p_credential_reviewed,false)
    or not coalesce(p_safeguarding_reviewed,false)
    or char_length(v_notes) not between 50 and 2000 then
    raise exception 'independent credentials, safeguarding and a 50-2000 character evidence review are required';
  end if;
  select * into v_app from public.mentorship_applications
    where id=p_application_id for update;
  if not found or v_app.status<>'reviewed_eligible'
     or v_app.reviewed_by is null or v_app.reviewed_at is null then
    raise exception 'a previously reviewed eligible application is required';
  end if;
  if v_app.reviewed_by=v_app.applicant_id or v_actor=v_app.applicant_id then
    raise exception 'reviewers cannot approve their own applications';
  end if;
  select * into v_profile from public.profiles where id=v_app.applicant_id for update;
  if not found or v_profile.account_status<>'active'
    or v_profile.deleted_at is not null or
       v_profile.role not in ('student','teacher','mentor') then
    raise exception 'applicant account is not active and eligible';
  end if;

  if v_profile.role='student' then
    if v_profile.education_stage_key not in ('university','college_tvet')
      or not public.is_adult(v_app.applicant_id)
      or not private.mentorship_adult_verified(v_app.applicant_id) then
      raise exception 'adult university/TVET eligibility has not been verified';
    end if;
  elsif v_profile.role='teacher' then
    if not exists(select 1 from public.teacher_profiles tp
      where tp.user_id=v_app.applicant_id and
        tp.verification_status in ('approved','verified')) then
      raise exception 'teacher credentials not approved';
    end if;
  end if;

  select (
    exists(select 1 from public.profile_documents d
      where d.user_id=v_app.applicant_id and d.verified=true
        and d.verified_at is not null and d.verified_by is not null
        and (d.expires_on is null or d.expires_on>=current_date))
    or exists(select 1 from public.profile_education e
      where e.user_id=v_app.applicant_id and e.verified=true
        and e.verified_at is not null and e.verified_by is not null)
    or exists(select 1 from public.profile_experience x
      where x.user_id=v_app.applicant_id and x.verified=true
        and x.verified_at is not null and x.verified_by is not null)
    or exists(select 1 from public.teacher_profiles tp
      where tp.user_id=v_app.applicant_id and
        tp.verification_status in ('approved','verified')
        and tp.verified_by is not null and tp.verified_at is not null)
  ) into v_evidence_exists;
  if not v_evidence_exists then
    raise exception 'an independently verified education, work, teacher or credential record is required';
  end if;

  insert into public.mentor_profiles(
    user_id,headline,expertise,languages,bio,verified,active,updated_at
  ) values(
    v_app.applicant_id,v_app.headline,v_app.expertise,v_app.languages,
    left(v_app.background,2000),false,false,now()
  ) on conflict(user_id) do nothing;

  if exists(select 1 from public.mentor_profiles m where m.user_id=v_app.applicant_id and m.verified) then
    raise exception 'applicant already has a verified mentor profile';
  end if;

  update public.mentor_profiles
    set headline=v_app.headline,expertise=v_app.expertise,
        languages=v_app.languages,bio=left(v_app.background,2000),
        verified=true,active=true,verified_by=v_actor,verified_at=now(),
        verification_notes=v_notes,updated_at=now()
    where user_id=v_app.applicant_id;

  insert into public.admin_audit_logs(actor_id,action,entity_type,entity_id,details)
  values (
    v_actor,'mentorship_final_credentials_verified','mentor_profile',v_app.applicant_id,
    jsonb_build_object('application_id',v_app.id,'credential_reviewed',p_credential_reviewed,
      'safeguarding_reviewed',p_safeguarding_reviewed,'review_notes',v_notes)
  );
  return v_app.applicant_id;
end;
$fn$;
revoke all on function private.finalize_mentorship_verification(uuid,boolean,boolean,text) from public,anon,authenticated;
grant execute on function private.finalize_mentorship_verification(uuid,boolean,boolean,text) to authenticated;
drop policy if exists mentorship_applications_eligible_adult_submit on public.mentorship_applications;
create policy mentorship_applications_eligible_adult_submit
on public.mentorship_applications for insert to authenticated with check(
 applicant_id=(select auth.uid()) and status='pending_review'
 and reviewed_by is null and reviewed_at is null and review_notes is null
 and exists(
  select 1 from public.profiles p where p.id=applicant_id
    and p.deleted_at is null and p.account_status='active'
    and (
      (p.role='student' and p.education_stage_key in ('college_tvet','university')
        and private.mentorship_adult_verified(p.id))
      or (p.role='teacher' and exists(
       select 1 from public.teacher_profiles t
       where t.user_id=p.id and t.verification_status in ('approved','verified')
      ))
    )
 )
);
