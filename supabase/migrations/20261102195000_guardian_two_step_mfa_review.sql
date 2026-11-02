-- A learner-issued code proves access to the learner's one-time invitation.
-- It does NOT prove legal guardianship, adult status or permission to view child data.
-- Supersede the v35 redemption route rather than modifying existing verified records.
create or replace function public.redeem_parent_link_invite_v36(p_token text)
returns uuid language plpgsql security definer set search_path to ''
as $redeem$
declare
  v_uid uuid := (select auth.uid());
  v_inv public.parent_link_invites%rowtype;
  v_profile public.profiles%rowtype;
  v_link_id uuid;
  v_status text;
begin
  if v_uid is null then raise exception 'authentication required'; end if;
  select * into v_profile from public.profiles
    where id = v_uid and role = 'parent'::public.user_role
      and account_status = 'active' and deleted_at is null
      and (email_verified or phone_verified)
    for share;
  if not found then raise exception 'active verified parent profile required'; end if;
  if p_token is null or p_token !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'invalid or expired parent invitation code';
  end if;
  select * into v_inv from public.parent_link_invites
    where token_hash = encode(sha256(btrim(lower(p_token))::bytea),'hex')
      and redeemed_at is null and expires_at > now()
    for update;
  if not found then raise exception 'invalid or expired parent invitation code'; end if;
  if v_inv.learner_id = v_uid then raise exception 'cannot link an account to itself'; end if;
  if not exists (
    select 1 from public.profiles
    where id = v_inv.learner_id and role = 'student'::public.user_role
      and account_status = 'active' and deleted_at is null
  ) then raise exception 'learner account unavailable'; end if;

  select id,status into v_link_id,v_status from public.guardian_relationships
    where learner_id = v_inv.learner_id and guardian_user_id = v_uid
    order by requested_at desc limit 1 for update;
  if v_link_id is not null and v_status in ('rejected','revoked') then
    raise exception 'relationship requires safeguarding review before another request';
  end if;
  if v_link_id is null then
    insert into public.guardian_relationships
      (learner_id,guardian_user_id,relationship,status,consent_version)
    values (v_inv.learner_id,v_uid,'parent','pending','2026-08-14')
    returning id into v_link_id;
  end if;
  update public.parent_link_invites
    set redeemed_by = v_uid, redeemed_at = now()
    where id = v_inv.id and redeemed_at is null;
  if not found then raise exception 'parent invitation was already used'; end if;
  -- Deliberately no verified_at, verified_by, guardian_verified status or student data access.
  return v_link_id;
end
$redeem$;

revoke all on function public.redeem_parent_link_invite_v35(text) from public,anon,authenticated;
revoke all on function private.redeem_parent_link_invite_v35(text) from public,anon,authenticated;
revoke all on function public.redeem_parent_link_invite_v36(text) from public,anon;
grant execute on function public.redeem_parent_link_invite_v36(text) to authenticated;

-- Review is permitted only to the independent active super-admin using MFA.
-- A code-only relationship can never self-certify as verified.
create or replace function public.review_guardian_consent(
  p_relationship_id uuid,p_decision text,p_notes text default null
) returns public.guardian_relationships language plpgsql security definer
set search_path to '' as $review$
declare
  v_uid uuid := (select auth.uid());
  v public.guardian_relationships%rowtype;
  v_note text := btrim(coalesce(p_notes,''));
begin
  if v_uid is null or not private.is_admin_user()
    or coalesce((select auth.jwt()->>'aal'),'aal1') <> 'aal2'
  then raise exception 'MFA-authenticated super-admin required'; end if;
  if p_decision not in ('verified','rejected') then raise exception 'invalid review decision'; end if;
  if char_length(v_note) < 12 or char_length(v_note) > 1000 then
    raise exception 'record a 12-1000 character evidence-based review note';
  end if;
  select * into v from public.guardian_relationships
    where id = p_relationship_id and status = 'pending' for update;
  if not found then raise exception 'pending guardian relationship not found'; end if;
  if p_decision = 'verified' then
    if v.guardian_user_id is null or not exists (
      select 1 from public.profiles parent
      where parent.id = v.guardian_user_id
        and parent.role = 'parent'::public.user_role
        and parent.account_status = 'active' and parent.deleted_at is null
        and (parent.email_verified or parent.phone_verified)
    ) or not exists (
      select 1 from public.profiles learner
      where learner.id = v.learner_id and learner.role = 'student'::public.user_role
        and learner.account_status = 'active' and learner.deleted_at is null
    ) then raise exception 'verified parent identity and active learner are required'; end if;
  end if;
  update public.guardian_relationships
    set status=p_decision,
      verified_at=case when p_decision='verified' then now() else null end,
      verified_by=v_uid,notes=v_note
    where id=v.id returning * into v;
  if p_decision='verified' then
    update public.profiles set learner_safety_status='guardian_verified',updated_at=now()
      where id=v.learner_id and role='student'::public.user_role;
  end if;
  insert into public.admin_audit_logs(actor_id,action,entity_type,entity_id,details)
    values(v_uid,'guardian_consent_review','guardian_relationship',v.id,
      jsonb_build_object('decision',p_decision,'note_recorded',true));
  return v;
end
$review$;
revoke all on function public.review_guardian_consent(uuid,text,text) from public,anon;
grant execute on function public.review_guardian_consent(uuid,text,text) to authenticated;
