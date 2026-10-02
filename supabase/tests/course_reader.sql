begin;
do $test$
declare learner uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); course uuid; lesson uuid; count_rows integer; denied boolean:=false;
begin
 insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
 select u,u::text||'@example.invalid','{"provider":"email"}','{"full_name":"Course rollback test","role":"student"}',now(),now(),now() from unnest(array[learner,outsider]) u;
 insert into public.courses(title,is_published,price_cents) values('Rollback reader fixture',true,0) returning id into course;
 insert into public.course_lessons(course_id,module_title,title,content_text,is_preview) values(course,'Module','Lesson','Fixture body',false) returning id into lesson;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 select count(*) into count_rows from public.course_lessons where id=lesson;
 if count_rows<>0 then raise exception 'unenrolled learner read a lesson'; end if;
 begin insert into public.lesson_progress(user_id,lesson_id) values(outsider,lesson); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'unenrolled learner completed a lesson'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',learner,'role','authenticated')::text,true);
 insert into public.course_enrollments(user_id,course_id) values(learner,course);
 select count(*) into count_rows from public.course_lessons where id=lesson;
 if count_rows<>1 then raise exception 'enrolled learner cannot read lesson'; end if;
 insert into public.lesson_progress(user_id,lesson_id) values(learner,lesson) on conflict(user_id,lesson_id) do nothing;
 insert into public.lesson_progress(user_id,lesson_id) values(learner,lesson) on conflict(user_id,lesson_id) do nothing;
 select count(*) into count_rows from public.lesson_progress where user_id=learner and lesson_id=lesson;
 if count_rows<>1 then raise exception 'completion retry was not idempotent'; end if;
end $test$;
rollback;
select 'PASS: enrolled reading, completion persistence, retry safety, outsider denial; all fixtures rolled back' as result;
