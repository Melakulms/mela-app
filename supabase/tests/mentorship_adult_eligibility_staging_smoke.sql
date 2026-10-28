-- STAGING ONLY: mentorship adult age review security smoke.
do $assert$
begin
 if has_table_privilege('anon','public.mentorship_adult_age_reviews','SELECT') then
   raise exception 'anonymous age review access is forbidden';
 end if;
 if not (select relrowsecurity from pg_class where oid='public.mentorship_adult_age_reviews'::regclass) then
   raise exception 'mentorship age reviews must use RLS';
 end if;
 if has_column_privilege('authenticated','public.mentorship_adult_age_reviews','status','INSERT') then
   raise exception 'students cannot self-approve adult review';
 end if;
 if has_column_privilege('authenticated','public.mentorship_adult_age_reviews','claimed_date_of_birth','UPDATE') then
   raise exception 'claimed birth date must be immutable';
 end if;
 if has_column_privilege('authenticated','public.student_profiles','date_of_birth','UPDATE') then
   raise exception 'students can alter their protected birth date';
 end if;
 if has_function_privilege('authenticated','private.mentorship_adult_verified(uuid)','EXECUTE') then
   raise exception 'adult verification internal function leaked';
 end if;
end $assert$;
begin;
set local role authenticated;
do $test$
declare denied boolean:=false;
begin
 begin
  insert into public.mentorship_adult_age_reviews(
    learner_id,claimed_date_of_birth,consent_to_mentorship_rules)
  values('00000000-0000-0000-0000-000000000001'::uuid,'1990-01-01',true);
 exception when others then
  if sqlerrm like '%cannot request another learner%' or
     sqlerrm like '%row-level security%' then denied:=true;
  else raise; end if;
 end;
 if not denied then raise exception 'missing identity bypassed age review'; end if;
end $test$;
rollback;
select 'adult_mentorship_review_denied_anonymous_passed' as result;