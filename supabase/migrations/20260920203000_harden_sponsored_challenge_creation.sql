-- Production hardening: validate sponsored challenge creation inputs and team-size bounds.
create or replace function private.create_sponsored_challenge(
  p_employer_id uuid,p_title text,p_description text,p_challenge_type text,
  p_category public.launch_category,p_prize numeric,p_starts_at timestamptz,
  p_ends_at timestamptz,p_team_mode boolean,p_min_team integer,p_max_team integer)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_uid uuid := (select auth.uid()); v_id uuid; v_name text; v_min integer; v_max integer;
begin
  if v_uid is null then raise exception 'authentication required'; end if;
  if not private.has_employer_access(p_employer_id,true) and not private.is_admin_user() then raise exception 'employer write access required'; end if;
  if nullif(trim(coalesce(p_title,'')),'') is null then raise exception 'challenge title is required'; end if;
  if char_length(trim(p_title)) > 200 then raise exception 'challenge title is too long'; end if;
  if char_length(coalesce(p_description,'')) > 10000 then raise exception 'challenge description is too long'; end if;
  if p_prize is not null and p_prize < 0 then raise exception 'challenge prize cannot be negative'; end if;
  if p_prize is not null and p_prize > 10000000 then raise exception 'challenge prize exceeds the platform limit'; end if;
  if p_starts_at is not null and p_ends_at is not null and p_ends_at<=p_starts_at then raise exception 'challenge end must be after start'; end if;
  if p_ends_at is not null and p_ends_at <= now() then raise exception 'challenge end must be in the future'; end if;
  if coalesce(p_team_mode,false) then
    v_min := greatest(1,coalesce(p_min_team,2)); v_max := greatest(v_min,coalesce(p_max_team,v_min));
    if v_max > 100 then raise exception 'maximum team size cannot exceed 100'; end if;
  else v_min := 1; v_max := 1; end if;
  select company_name into v_name from public.employers where id=p_employer_id;
  insert into public.sponsored_challenges(sponsor_name,title,description,prize_amount_etb,starts_at,ends_at,sponsor_employer_id,created_by,challenge_type,category,status,team_mode,min_team_size,max_team_size)
  values(coalesce(v_name,'Mela Partner'),trim(p_title),p_description,p_prize,p_starts_at,p_ends_at,p_employer_id,v_uid,p_challenge_type,p_category,'draft',coalesce(p_team_mode,false),v_min,v_max)
  returning id into v_id;
  return v_id;
end $function$;
