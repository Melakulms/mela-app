begin;

do $test$
declare u uuid; p text; otherp text; g int; s jsonb; sid uuid; answers jsonb; r jsonb; again jsonb; n int; c uuid; t uuid; d int;
begin
 select id into u from public.profiles where role='student' and account_status='active' and deleted_at is null limit 1;
 if u is null then raise exception 'Active learner fixture missing'; end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 for g in 1..12 loop
  update public.profiles set grade_level=g,education_stage_key=case when g<=6 then 'school_1_6' when g<=8 then 'school_7_8' when g<=10 then 'school_9_10' else 'school_11_12' end where id=u;
  select program_key into p from public.mela_learning_programs where grade_level=g and subject_title='Mathematics' and active limit 1;
  if p is null then raise exception 'Missing mathematics grade %',g; end if;
  s:=public.start_mela_filtered_question_session_v18(p,null,null,5,null,'mastery');
  sid:=(s->>'session_id')::uuid;
  if jsonb_array_length(s->'questions')<>5 then raise exception 'Wrong question count grade %',g; end if;
  if exists(select 1 from public.mela_question_sessions ss,unnest(ss.question_ids) qid join public.mela_question_bank q on q.id=qid where ss.id=sid and (q.program_key<>p or q.validation_status not in ('deterministic_validated','educator_verified'))) then raise exception 'Wrong curriculum grade %',g; end if;
  select jsonb_agg(jsonb_build_object('question_id',qid,'response',case when gg.grading_kind='numeric' then gg.correct_response->'value' else gg.correct_response->'choice' end)) into answers from public.mela_question_sessions ss,unnest(ss.question_ids) qid join private.mela_question_grading_v12 gg on gg.question_id=qid where ss.id=sid;
  r:=public.submit_mela_question_session_v12(sid,answers);
  if (r->>'correct_count')::int<>5 or (r->>'score_percent')::numeric<>100 then raise exception 'Typed grading failed grade %: %',g,r; end if;
  select sessions_completed into n from public.mela_question_user_program_stats where user_id=u and program_key=p;
  again:=public.submit_mela_question_session_v12(sid,answers);
  if not (again->>'already_submitted')::boolean or (select sessions_completed from public.mela_question_user_program_stats where user_id=u and program_key=p)<>n then raise exception 'Retry duplicated results'; end if;
  select program_key into otherp from public.mela_learning_programs where grade_level<>g and subject_title='Mathematics' and active limit 1;
  begin perform public.start_mela_filtered_question_session_v18(otherp,null,null,5,null,'mastery'); raise exception 'CROSS_GRADE_ALLOWED'; exception when others then if sqlerrm='CROSS_GRADE_ALLOWED' then raise; end if; end;
 end loop;
 select q.chapter_id,q.topic_id,q.difficulty into c,t,d from public.mela_question_bank q where program_key=p and active and access_tier='free' and validation_status in ('deterministic_validated','educator_verified') and topic_id is not null group by q.chapter_id,q.topic_id,q.difficulty having count(*)>=5 limit 1;
 s:=public.start_mela_filtered_question_session_v18(p,c,t,5,d,'mastery');
 if exists(select 1 from jsonb_array_elements(s->'questions') a join public.mela_question_bank q on q.id=(a->>'id')::uuid where q.chapter_id<>c or q.topic_id<>t or q.difficulty<>d) then raise exception 'Chapter/topic/difficulty leakage'; end if;
 update public.profiles set grade_level=null where id=u;
 begin perform public.start_mela_filtered_question_session_v18(p,null,null,5,null,'mastery'); raise exception 'NULL_GRADE_ALLOWED'; exception when others then if sqlerrm='NULL_GRADE_ALLOWED' then raise; end if; end;
end $test$;

rollback;

