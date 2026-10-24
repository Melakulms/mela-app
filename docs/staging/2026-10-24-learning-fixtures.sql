-- STAGING ONLY: tungqfmypuwzeyrtaseh. Never apply to production.
-- Synthetic QA content; not teacher-approved or accredited curriculum.
-- Existing authenticated session ownership checks retained.
begin;
insert into public.mela_learning_units(id,program_key,unit_number,title,description,status,estimated_hours,metadata)
values ('24242424-1024-4000-8000-000000000001','staging_university_digital_basics',1,'STAGING TEST — Safe study habits','Synthetic test unit, not approved curriculum.','published',0.25,'{"test_only":true}'),
('24242424-1024-4000-8000-000000000002','staging_tvet_digital_basics',1,'STAGING TEST — Safe study habits','Synthetic test unit, not approved curriculum.','published',0.25,'{"test_only":true}') on conflict(id) do nothing;
insert into public.mela_learning_materials(id,unit_id,material_key,material_type,title,summary,status,estimated_minutes,metadata)
select ('24242424-1024-4000-8001-'||lpad(n::text,12,'0'))::uuid,('24242424-1024-4000-8000-'||lpad(n::text,12,'0'))::uuid,'staging_safe_study_'||n,'core_lesson','STAGING TEST — Plan a short study session','Synthetic reading for testing the material reader.','published',10,'{"test_only":true}'::jsonb from generate_series(1,2) n on conflict(id) do nothing;
insert into public.mela_learning_material_content(material_id,content_markdown,source_notes)
select ('24242424-1024-4000-8001-'||lpad(n::text,12,'0'))::uuid,E'# STAGING TEST — Plan a short study session\n\nThis is a synthetic test lesson, not reviewed curriculum.\n\nChoose one small goal, such as explaining a term in your own words. Read the relevant section, close it, and recall the main idea. Check your answer and correct any mistake.\n\n## Try it\nWrite a fictional study goal. Explain the difference between rereading a page and recalling its idea without looking.\n\n## Check your progress\nReturn to your course after signing out and back in. A completed lesson should still show as completed. Never put passwords or private identity information in study notes.','Created solely for isolated staging journey testing.' from generate_series(1,2) n on conflict(material_id) do nothing;
insert into public.practice_topics(id,subject,topic,grade_level,slug,description,is_published)
values ('24242424-1024-4000-8002-000000000001','STAGING TEST — Digital learning','STAGING TEST — Safe study habits','career','staging-adult-safe-study','Synthetic test questions, not an approved assessment.',true) on conflict(id) do nothing;
insert into public.practice_questions(id,topic_id,question,choices,is_published)
values ('24242424-1024-4000-8003-000000000001','24242424-1024-4000-8002-000000000001','[STAGING TEST] Which item belongs in a study note?','["A fictional study goal","Your password","Your recovery code"]',true),
('24242424-1024-4000-8003-000000000002','24242424-1024-4000-8002-000000000001','[STAGING TEST] Which action checks recall?','["Explaining the idea without looking","Leaving the page open","Copying the title"]',true),
('24242424-1024-4000-8003-000000000003','24242424-1024-4000-8002-000000000001','[STAGING TEST] After finding a mistake, what helps learning?','["Checking and correcting it","Ignoring it","Sharing your password"]',true) on conflict(id) do nothing;
insert into private.practice_answer_keys(question_id,correct_answer,explanation,auto_gradable)
values ('24242424-1024-4000-8003-000000000001','{"answer":"A fictional study goal"}','Keep passwords and recovery codes out of study notes.',true),
('24242424-1024-4000-8003-000000000002','{"answer":"Explaining the idea without looking"}','Recall means retrieving an idea without looking at the source.',true),
('24242424-1024-4000-8003-000000000003','{"answer":"Checking and correcting it"}','Checking feedback and correcting mistakes supports learning.',true) on conflict(question_id) do nothing;
grant execute on function public.get_mela_learning_library(text,smallint,text),public.get_mela_learning_material(text),public.start_practice_session(uuid,text,integer,smallint),public.submit_practice_response(uuid,uuid,jsonb,integer,text),public.complete_practice_session(uuid) to authenticated;
commit;