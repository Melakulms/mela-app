-- STAGING ONLY: tungqfmypuwzeyrtaseh. Never run on production.
-- Operational repair, deliberately outside automatic migration directories.
-- Run only through the staging project-scoped connector.
begin;
insert into public.education_audience_stages(stage_key,audience_group,title,display_order,school_stage)
values ('university','higher_education','University',6,false),('college_tvet','higher_education','College or TVET',5,false)
on conflict(stage_key) do nothing;
insert into public.mela_learning_programs(program_key,stage_key,subject_key,subject_title,title,description,program_kind,optional,metadata)
values
('staging_university_digital_basics','university','digital_basics','STAGING TEST — Digital Learning Basics','STAGING TEST — University Digital Learning Basics','Fictional test program for adult registration and learning journey checks. Not an accredited course.','university_foundation',true,'{"test_only":true}'),
('staging_tvet_digital_basics','college_tvet','digital_basics','STAGING TEST — Digital Learning Basics','STAGING TEST — TVET Digital Learning Basics','Fictional test program for adult registration and learning journey checks. Not an accredited course.','tvet_foundation',true,'{"test_only":true}')
on conflict(program_key) do nothing;
-- Existing functions were inspected for authenticated ownership checks.
-- No PUBLIC/anon grant, no RLS removal, no admin or payment permissions.
grant execute on function public.set_my_education_stage_v36(text,integer,text) to authenticated;
grant execute on function public.complete_my_profile_v37(text,text,text,text,text,jsonb) to authenticated;
grant execute on function public.enroll_mela_course(uuid) to authenticated;
grant execute on function private.enroll_mela_course(uuid) to authenticated;
grant execute on function public.get_my_dashboard_v36() to authenticated;
grant execute on function private.get_my_dashboard_v36() to authenticated;
commit;
