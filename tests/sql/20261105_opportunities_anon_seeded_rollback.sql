-- STAGING ONLY; run all statements in one connection. No fixture survives ROLLBACK.
-- Verifies anonymous access to exactly one eligible opportunity among three synthetic rows.
-- Avoid real user records and does not exercise external application callbacks.
begin;
with e as (
 insert into public.employers(company_name,verified,verification_status)
 values ('MELA QA synthetic verified employer',true,'verified') returning id
) select set_config('mela.qa.verified_employer',id::text,true) from e;

with e as (
 insert into public.employers(company_name,verified,verification_status)
 values ('MELA QA synthetic unverified employer',false,'pending') returning id
) select set_config('mela.qa.unverified_employer',id::text,true) from e;

insert into public.opportunities (
 title,description,location,deadline,organization_name,sector_category,
 opportunity_type,employment_type_label,stipend_or_reward,employer_id,moderation_status,status
) values
 ('MELA QA visible verified','Rollback-only synthetic listing','Addis Ababa',current_date+30,
  'QA Verified','Technology','internships','Internship','None',
  current_setting('mela.qa.verified_employer')::uuid,'approved','open'),
 ('MELA QA hidden unverified','Rollback-only synthetic listing','Addis Ababa',current_date+30,
  'QA Unverified','Technology','internships','Internship','None',
  current_setting('mela.qa.unverified_employer')::uuid,'approved','open'),
 ('MELA QA hidden closed','Rollback-only synthetic listing','Addis Ababa',current_date+30,
  'QA Verified','Technology','internships','Internship','None',
  current_setting('mela.qa.verified_employer')::uuid,'approved','closed');

set local role anon;
do $qa$
declare v_visible integer;
begin
 select count(*) into v_visible from public.opportunities where title like 'MELA QA %';
 if v_visible <> 1 then
   raise exception 'anon listing RLS failed: expected one synthetic listing, saw %',v_visible;
 end if;
 if exists(select 1 from public.opportunities
           where title like 'MELA QA %' and title <> 'MELA QA visible verified') then
   raise exception 'anon listing RLS exposed a hidden synthetic listing';
 end if;
end $qa$;
rollback;

-- When this file passes, inspect absence of synthetic rows in a separate query.
-- This is an integration test, NOT permission to seed mock public opportunities.
