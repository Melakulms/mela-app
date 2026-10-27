-- Career Passport final integrity gate.
-- Lock claimed evidence while an independent verification request is pending.
-- Prevent owners from deleting verified credentials to evade the audit trail.
-- Request submission takes the record lock so an edit cannot race a new request.

create or replace function private.lock_pending_passport_record()
returns trigger
language plpgsql security definer set search_path = ''
as $function$
declare v_row_user uuid; v_row_id uuid; v_verified boolean;
begin
  if tg_table_schema <> 'public' or tg_table_name not in ('profile_education','profile_experience')
     or tg_op not in ('UPDATE','DELETE') then
    raise exception 'Unsupported passport integrity operation';
  end if;

  if private.is_admin_user() then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;

  v_row_user := old.user_id;
  v_row_id := old.id;
  v_verified := old.verified;

  if tg_op='DELETE' and v_verified then
    raise exception 'Verified passport records cannot be deleted by learners; contact MELA review staff'
      using errcode='42501';
  end if;

  if exists (
    select 1 from public.passport_verification_requests r
    where r.user_id = v_row_user
      and r.record_id = v_row_id
      and r.record_kind = case when tg_table_name='profile_education' then 'education' else 'experience' end
      and r.status='pending'
  ) then
    raise exception 'This record is locked while verification is pending. Wait for a reviewer decision before editing or deleting it'
      using errcode='42501';
  end if;

  if tg_op='DELETE' then return old; else return new; end if;
end;
$function$;

revoke all on function private.lock_pending_passport_record() from public,anon,authenticated;

drop trigger if exists trg_lock_pending_passport_record on public.profile_education;
create trigger trg_lock_pending_passport_record
before update or delete on public.profile_education
for each row execute function private.lock_pending_passport_record();

drop trigger if exists trg_lock_pending_passport_record on public.profile_experience;
create trigger trg_lock_pending_passport_record
before update or delete on public.profile_experience
for each row execute function private.lock_pending_passport_record();

create or replace function public.submit_passport_verification_request(
 p_kind text, p_record_id uuid, p_note text default ''
) returns uuid
language plpgsql security definer set search_path=''
as $function$
declare v_uid uuid:=(select auth.uid()); v_verified boolean; v_existing uuid; v_id uuid;
begin
 if v_uid is null then raise exception 'Sign in to request verification' using errcode='42501'; end if;
 if p_kind not in ('education','experience') or p_record_id is null then
  raise exception 'Invalid passport record';
 end if;
 if char_length(coalesce(p_note,''))>600 then raise exception 'Keep your note below 600 characters'; end if;
 -- Serialize against a concurrent learner edit or deletion.
 if p_kind='education' then
  select verified into v_verified from public.profile_education
  where id=p_record_id and user_id=v_uid for update;
 else
  select verified into v_verified from public.profile_experience
  where id=p_record_id and user_id=v_uid for update;
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
$function$;

revoke all on function public.submit_passport_verification_request(text,uuid,text) from public,anon,authenticated;
grant execute on function public.submit_passport_verification_request(text,uuid,text) to authenticated;
