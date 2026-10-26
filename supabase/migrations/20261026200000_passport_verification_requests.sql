-- Owner-requested Career Passport verification with MFA reviewer control.
-- Learners submit only self-reported education/experience records.
-- No identity documents or credential files are stored in this queue.
create table if not exists public.passport_verification_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 record_kind text not null check (record_kind in ('education','experience')),
 record_id uuid not null,
 applicant_note text not null default '' check (char_length(applicant_note) <= 600),
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 requested_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references public.profiles(id) on delete set null,
 review_feedback text check (review_feedback is null or char_length(review_feedback) <= 1500),
 constraint passport_review_decision_consistency check (
  (status='pending' and reviewed_at is null and reviewed_by is null) or
  (status in ('approved','rejected') and reviewed_at is not null and reviewed_by is not null)
 )
);
create unique index if not exists passport_verification_one_pending
 on public.passport_verification_requests (record_kind,record_id) where status='pending';
create index if not exists passport_verification_owner_recent
 on public.passport_verification_requests (user_id,requested_at desc);
create index if not exists passport_verification_pending_recent
 on public.passport_verification_requests (requested_at) where status='pending';

alter table public.passport_verification_requests enable row level security;
revoke all on table public.passport_verification_requests from public,anon,authenticated;
grant select on public.passport_verification_requests to authenticated;
drop policy if exists "Owners read their passport verification status" on public.passport_verification_requests;
create policy "Owners read their passport verification status"
 on public.passport_verification_requests for select to authenticated
 using (user_id=(select auth.uid()));

create or replace function public.submit_passport_verification_request(
 p_kind text, p_record_id uuid, p_note text default ''
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=(select auth.uid()); v_verified boolean; v_existing uuid; v_id uuid;
begin
 if v_uid is null then raise exception 'Sign in to request verification' using errcode='42501'; end if;
 if p_kind not in ('education','experience') or p_record_id is null then
  raise exception 'Invalid passport record';
 end if;
 if char_length(coalesce(p_note,''))>600 then raise exception 'Keep your note below 600 characters'; end if;
 if p_kind='education' then
  select verified into v_verified from public.profile_education
  where id=p_record_id and user_id=v_uid;
 else
  select verified into v_verified from public.profile_experience
  where id=p_record_id and user_id=v_uid;
 end if;
 if not found then raise exception 'This record is not in your Career Passport' using errcode='42501'; end if;
 if v_verified then raise exception 'Record already verified'; end if;
 select id into v_existing from public.passport_verification_requests
  where record_kind=p_kind and record_id=p_record_id and user_id=v_uid and status='pending'
  order by requested_at desc limit 1;
 if found then return v_existing; end if;
 if (select count(*) from public.passport_verification_requests
     where user_id=v_uid and requested_at>now()-interval '24 hours')>=20 then
  raise exception 'Daily verification-request limit reached' using errcode='42501';
 end if;
 if exists (select 1 from public.passport_verification_requests
    where user_id=v_uid and record_kind=p_kind and record_id=p_record_id
       and requested_at>now()-interval '24 hours') then
  raise exception 'You can retry verification after 24 hours' using errcode='42501';
 end if;
 insert into public.passport_verification_requests(user_id,record_kind,record_id,applicant_note)
 values(v_uid,p_kind,p_record_id,trim(coalesce(p_note,''))) returning id into v_id;
 return v_id;
end;
$$;
revoke all on function public.submit_passport_verification_request(text,uuid,text) from public,anon,authenticated;
grant execute on function public.submit_passport_verification_request(text,uuid,text) to authenticated;

create or replace function public.get_my_passport_verification_requests()
returns table(id uuid,record_kind text,record_id uuid,status text,requested_at timestamptz,reviewed_at timestamptz,review_feedback text)
language sql security invoker set search_path=''
as $$
 select r.id,r.record_kind,r.record_id,r.status,r.requested_at,r.reviewed_at,r.review_feedback
 from public.passport_verification_requests r
 where r.user_id=(select auth.uid())
 order by r.requested_at desc limit 100
$$;
revoke all on function public.get_my_passport_verification_requests() from public,anon,authenticated;
grant execute on function public.get_my_passport_verification_requests() to authenticated;

create or replace function public.get_passport_verification_queue(p_limit integer default 50)
returns table(id uuid,record_kind text,record_id uuid,user_id uuid,record_name text,record_details text,applicant_note text,requested_at timestamptz)
language plpgsql security definer set search_path=''
as $$
begin
 if (select auth.uid()) is null or not private.is_admin_user() then
  raise exception 'MFA-approved administrator required' using errcode='42501';
 end if;
 return query
 select r.id,r.record_kind,r.record_id,r.user_id,
   case when r.record_kind='education' then e.institution else x.organization end as record_name,
   case when r.record_kind='education' then
      concat_ws(' · ',e.qualification,e.field_of_study,e.start_year::text,e.end_year::text)
   else concat_ws(' · ',x.title,x.experience_type,x.start_date::text,x.end_date::text) end as record_details,
   r.applicant_note,r.requested_at
 from public.passport_verification_requests r
 left join public.profile_education e on r.record_kind='education' and e.id=r.record_id and e.user_id=r.user_id
 left join public.profile_experience x on r.record_kind='experience' and x.id=r.record_id and x.user_id=r.user_id
 where r.status='pending' and
       ((r.record_kind='education' and e.id is not null and not e.verified)
        or (r.record_kind='experience' and x.id is not null and not x.verified))
 order by r.requested_at asc
 limit greatest(1,least(coalesce(p_limit,50),100));
end;
$$;
revoke all on function public.get_passport_verification_queue(integer) from public,anon,authenticated;
grant execute on function public.get_passport_verification_queue(integer) to authenticated;

create or replace function public.review_passport_verification_request(
 p_request_id uuid, p_decision text, p_source text, p_feedback text
) returns text
language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=(select auth.uid()); v_request public.passport_verification_requests%rowtype;
begin
 if v_uid is null or not private.is_admin_user() then
  raise exception 'MFA-approved administrator required' using errcode='42501';
 end if;
 if p_decision not in ('approved','rejected') or p_request_id is null then
  raise exception 'Choose approve or reject';
 end if;
 if char_length(trim(coalesce(p_feedback,'')))<10 or char_length(p_feedback)>1500 then
  raise exception 'Review feedback must contain 10 to 1500 characters';
 end if;
 if p_decision='approved' and char_length(trim(coalesce(p_source,'')))<5 then
  raise exception 'Record the independently checked verification source';
 end if;
 select * into v_request from public.passport_verification_requests where id=p_request_id for update;
 if not found or v_request.status <> 'pending' then
  raise exception 'Request was already reviewed or not found';
 end if;
 if v_request.record_kind='education' then
  perform 1 from public.profile_education where id=v_request.record_id
    and user_id=v_request.user_id and verified=false for update;
  if not found then raise exception 'Education claim changed or is no longer eligible for verification'; end if;
  perform private.review_profile_education(v_request.record_id,p_decision='approved',
    case when p_decision='approved' then trim(p_source) else 'Verification declined' end,trim(p_feedback));
 elsif v_request.record_kind='experience' then
  perform 1 from public.profile_experience where id=v_request.record_id
    and user_id=v_request.user_id and verified=false for update;
  if not found then raise exception 'Experience claim changed or is no longer eligible for verification'; end if;
  perform private.review_profile_experience(v_request.record_id,p_decision='approved',
    case when p_decision='approved' then trim(p_source) else 'Verification declined' end,trim(p_feedback));
 else
  raise exception 'Unsupported record';
 end if;
 update public.passport_verification_requests
 set status=p_decision,reviewed_at=now(),reviewed_by=v_uid,review_feedback=trim(p_feedback)
 where id=p_request_id;
 return p_decision;
end;
$$;
revoke all on function public.review_passport_verification_request(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.review_passport_verification_request(uuid,text,text,text) to authenticated;
