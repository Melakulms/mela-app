-- MELA Group Mentorship security smoke test. Staging only. No records persist.
-- This probes signed-in-role permissions without supplying a JWT and does not
-- replace real adult/guardian/verified mentor E2E browser testing.
do $permissions$
begin
 if not (select relrowsecurity from pg_class where oid='public.mentorship_group_interests'::regclass) then
   raise exception 'group interests require RLS';
 end if;
 if has_column_privilege('authenticated','public.mentorship_group_interests','status','INSERT') then
   raise exception 'learners must not set their own approval status';
 end if;
 if has_table_privilege('anon','public.mentorship_group_interests','SELECT') then
   raise exception 'anonymous group applications visibility';
 end if;
 if not has_column_privilege('authenticated','public.mentorship_group_interests','group_id','INSERT') then
   raise exception 'adult group interest submit is not configured';
 end if;
 if has_table_privilege('anon','public.mentorship_groups','INSERT') then
   raise exception 'anonymous group program management exposed';
 end if;
end $permissions$;
begin;
set local role authenticated;
do $anonymous$
declare
  denied boolean:=false;
begin
  begin
    insert into public.mentorship_group_interests(group_id,learner_id)
      values('00000000-0000-0000-0000-000000000010'::uuid,
             '00000000-0000-0000-0000-000000000020'::uuid);
  exception when others then
    if sqlerrm like '%eligible adult learner%' or sqlerrm like '%row-level security%' then
      denied:=true;
    else raise; end if;
  end;
  if not denied then raise exception 'missing identity bypassed adult group interest check'; end if;
  denied:=false;
  begin
    insert into public.mentorship_groups(title,description,category,mentor_id,starts_at,capacity,status)
      values('Unauthorized event','not allowed','academic',
             '00000000-0000-0000-0000-000000000020'::uuid,
             now()+interval '7 days',10,'published');
  exception when others then
    if sqlerrm like '%MFA administrator required%' or sqlerrm like '%row-level security%' then
      denied:=true;
    else raise; end if;
  end;
  if not denied then raise exception 'missing MFA bypassed program moderation'; end if;
end $anonymous$;
rollback;
select 'group_interest_smoke_passed' as result;