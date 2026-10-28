-- STAGING correction after initial mentor finalization:
-- The public description approved by the MFA administrator must be the
-- reviewed application data, not stale self-edited mentor profile fields.

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
      or not private.user_has_adult_work_attestation(v_app.applicant_id) then
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

-- Prevent a previously approved mentor from changing public expertise or
-- qualifications without an administrator checking the new claims.
create or replace function private.guard_verified_mentor_public_fields()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
  if old.verified and (
    new.headline is distinct from old.headline
    or new.bio is distinct from old.bio
    or new.expertise is distinct from old.expertise
    or new.languages is distinct from old.languages
    or new.organization is distinct from old.organization
    or new.years_experience is distinct from old.years_experience
  ) and not (private.is_admin_user() and coalesce((auth.jwt()->>'aal'),'')='aal2') then
    raise exception 'verified mentor public profile changes require MFA administrator review';
  end if;
  return new;
end;
$fn$;
revoke all on function private.guard_verified_mentor_public_fields() from public,anon,authenticated;
drop trigger if exists trg_guard_verified_mentor_public_fields on public.mentor_profiles;
create trigger trg_guard_verified_mentor_public_fields
 before update on public.mentor_profiles
 for each row execute function private.guard_verified_mentor_public_fields();
