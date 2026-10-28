-- STAGING ONLY. Supervised mentorship-specific safeguarding reports.
-- Reuse existing RLS-protected public.reports and moderation audit workflow.
-- Do not grant generic users INSERT/UPDATE on reports or expose private cases.
create or replace function private.report_mentorship_concern(
  p_target_type text,p_target_id uuid,p_reason text,p_details text
) returns uuid language plpgsql security definer set search_path=''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_reason text := btrim(coalesce(p_reason,''));
  v_details text := btrim(coalesce(p_details,''));
  v_case_id uuid;
begin
  if v_actor is null then raise exception 'sign in to submit a mentorship safety report'; end if;
  if p_target_id is null or p_target_type not in
    ('mentor_profile','mentorship_request','mentorship_session') then
    raise exception 'select a valid mentorship concern target';
  end if;
  if char_length(v_reason) not between 3 and 160
    or char_length(v_details) not between 10 and 4000 then
    raise exception 'choose a safety reason and provide 10 to 4000 characters of context';
  end if;

  if p_target_type='mentor_profile' and not exists(
    select 1 from public.mentor_profiles m
      where m.user_id=p_target_id and m.verified
  ) then raise exception 'selected mentor cannot be reported from this form'; end if;
  if p_target_type='mentorship_request' and not exists(
    select 1 from public.mentorship_requests r
      where r.id=p_target_id and v_actor in (r.mentor_id,r.mentee_id)
  ) then raise exception 'report only a mentorship request you participated in'; end if;
  if p_target_type='mentorship_session' and not exists(
    select 1 from public.mentorship_sessions s
      where s.id=p_target_id and v_actor in (s.mentor_id,s.mentee_id)
  ) then raise exception 'report only a mentorship session you participated in'; end if;

  -- Rate limit is checked inside a privileged transaction and does not
  -- rely on user-supplied created_at or status fields.
  perform 1 from public.profiles p where p.id=v_actor for update;
  if not found then raise exception 'active signed-in profile required'; end if;
  if (select count(*) from public.reports r
      where r.reporter_id=v_actor
      and r.created_at >= now()-interval '1 hour')>=5 then
    raise exception 'too many safety reports submitted recently; contact emergency services if urgently unsafe';
  end if;
  insert into public.reports(reporter_id,target_type,target_id,reason,details,status)
    values(v_actor,p_target_type,p_target_id,v_reason,v_details,'open')
    returning id into v_case_id;
  return v_case_id;
end;
$fn$;
revoke all on function private.report_mentorship_concern(text,uuid,text,text)
  from public,anon,authenticated;
grant execute on function private.report_mentorship_concern(text,uuid,text,text)
  to authenticated;
create or replace function public.report_mentorship_concern(
  p_target_type text,p_target_id uuid,p_reason text,p_details text
) returns uuid language sql security invoker set search_path=''
as $fn$
  select private.report_mentorship_concern(
    p_target_type,p_target_id,p_reason,p_details);
$fn$;
revoke all on function public.report_mentorship_concern(text,uuid,text,text)
  from public,anon;
grant execute on function public.report_mentorship_concern(text,uuid,text,text)
  to authenticated;

-- Prior reporter-only access remains. Mentorship case contents cannot be
-- opened by administrators without current MFA AAL2; other platform reports
-- retain their existing access logic.
drop policy if exists "Reports readable by reporter or admin" on public.reports;
create policy "Reports readable by reporter or admin"
on public.reports for select to authenticated using(
  reporter_id=(select auth.uid()) or
  (private.is_admin_user()
    and (target_type not in ('mentor_profile','mentorship_request','mentorship_session')
      or coalesce((auth.jwt()->>'aal'),'')='aal2'))
);

create or replace function private.review_mentorship_concern(
  p_case_id uuid,p_status text,p_resolution_notes text
) returns boolean language plpgsql security definer set search_path=''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_old public.reports%rowtype;
  v_notes text := btrim(coalesce(p_resolution_notes,''));
begin
  if v_actor is null or not private.is_admin_user()
    or coalesce((auth.jwt()->>'aal'),'')<>'aal2' then
    raise exception 'MFA-verified safety administrator required';
  end if;
  if p_status not in ('reviewing','resolved','dismissed')
    or (p_status in ('resolved','dismissed')
      and char_length(v_notes) not between 30 and 4000)
    or char_length(v_notes)>4000 then
    raise exception 'choose a valid decision and document at least 30 characters for resolution';
  end if;
  select * into v_old from public.reports
    where id=p_case_id
      and target_type in ('mentor_profile','mentorship_request','mentorship_session')
    for update;
  if not found then raise exception 'mentorship case not found'; end if;
  if v_old.status not in ('open','reviewing')
    or (v_old.status='reviewing' and p_status='reviewing') then
    raise exception 'case cannot transition to this review state';
  end if;
  update public.reports
     set status=p_status,assigned_to=v_actor,
       resolution_notes=case when v_notes='' then null else v_notes end
    where id=p_case_id;
  return true;
end;
$fn$;
revoke all on function private.review_mentorship_concern(uuid,text,text)
  from public,anon,authenticated;
grant execute on function private.review_mentorship_concern(uuid,text,text)
  to authenticated;
create or replace function public.review_mentorship_concern(
  p_case_id uuid,p_status text,p_resolution_notes text
) returns boolean language sql security invoker set search_path=''
as $fn$
  select private.review_mentorship_concern(p_case_id,p_status,p_resolution_notes);
$fn$;
revoke all on function public.review_mentorship_concern(uuid,text,text)
  from public,anon;
grant execute on function public.review_mentorship_concern(uuid,text,text)
  to authenticated;
