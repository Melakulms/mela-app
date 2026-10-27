-- STAGING ONLY: keep confidential investigation notes outside reporter-readable
-- public.reports. Reporter-visible resolution_notes must be generic.
create table if not exists private.mentorship_case_internal_notes(
 id uuid primary key default extensions.gen_random_uuid(),
 case_id uuid not null references public.reports(id) on delete cascade,
 reviewer_id uuid not null references public.profiles(id),
 decision text not null check(decision in ('reviewing','resolved','dismissed')),
 confidential_notes text not null check(char_length(btrim(confidential_notes)) between 1 and 4000),
 created_at timestamptz not null default now()
);
create index if not exists mentorship_case_internal_notes_case_idx
on private.mentorship_case_internal_notes(case_id,created_at);
alter table private.mentorship_case_internal_notes enable row level security;
revoke all on private.mentorship_case_internal_notes from public,anon,authenticated;

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
    where id=p_case_id and target_type in
      ('mentor_profile','mentorship_request','mentorship_session')
    for update;
  if not found then raise exception 'mentorship case not found'; end if;
  if v_old.status not in ('open','reviewing')
    or (v_old.status='reviewing' and p_status='reviewing') then
    raise exception 'case cannot transition to this review state';
  end if;

  -- Persist the complete confidential investigation in the unexposed schema.
  insert into private.mentorship_case_internal_notes(
    case_id,reviewer_id,decision,confidential_notes
  ) values (
    p_case_id,v_actor,p_status,
    case when v_notes='' then 'Case assigned for confidential investigation' else v_notes end
  );

  -- Do not place evidence, interviews or details here: the original reporter
  -- can read this public status field by design.
  update public.reports
    set status=p_status,assigned_to=v_actor,
      resolution_notes=case when p_status='reviewing' then
        'Your report is under confidential review.'
      else
        'Your report was reviewed. Contact MELA Safety Center if you need further clarification.'
      end
    where id=p_case_id;
  return true;
end;
$fn$;
revoke all on function private.review_mentorship_concern(uuid,text,text)
  from public,anon;
grant execute on function private.review_mentorship_concern(uuid,text,text)
  to authenticated;

create or replace function private.get_mentorship_case_review_history(p_case_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
declare
  v_history jsonb;
begin
  if (select auth.uid()) is null or not private.is_admin_user()
     or coalesce((auth.jwt()->>'aal'),'')<>'aal2' then
    raise exception 'MFA-verified safety administrator required';
  end if;
  if not exists(select 1 from public.reports r where r.id=p_case_id
      and r.target_type in ('mentor_profile','mentorship_request','mentorship_session')) then
    raise exception 'mentorship case not found';
  end if;
  select coalesce(jsonb_agg(
    jsonb_build_object('decision',n.decision,'notes',n.confidential_notes,
      'created_at',n.created_at,'reviewer',n.reviewer_id)
    order by n.created_at),'[]'::jsonb)
  into v_history from private.mentorship_case_internal_notes n
  where n.case_id=p_case_id;
  return v_history;
end;
$fn$;
revoke all on function private.get_mentorship_case_review_history(uuid)
  from public,anon,authenticated;
grant execute on function private.get_mentorship_case_review_history(uuid) to authenticated;
create or replace function public.get_mentorship_case_review_history(p_case_id uuid)
returns jsonb language sql security invoker set search_path=''
as $fn$
  select private.get_mentorship_case_review_history(p_case_id);
$fn$;
revoke all on function public.get_mentorship_case_review_history(uuid)
  from public,anon;
grant execute on function public.get_mentorship_case_review_history(uuid)
  to authenticated;
