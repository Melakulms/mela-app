-- Grade/subject segregation and launch-critical question-session contracts.
-- Existing questions retain their prompts, answers, grade/program and review status.
create or replace function private.assert_mela_question_program_access(p_program_key text)
returns void language plpgsql stable security definer set search_path='' as $guard$
declare v_uid uuid:=(select auth.uid()); v_profile public.profiles%rowtype; v_program public.mela_learning_programs%rowtype;
begin
 if v_uid is null then raise exception 'authentication required'; end if;
 select * into v_program from public.mela_learning_programs where program_key=p_program_key and active;
 if not found then raise exception 'learning program not found';end if;
 if private.is_admin_user() then return;end if;
 select * into v_profile from public.profiles where id=v_uid and account_status='active' and deleted_at is null;
 if not found or v_profile.role is distinct from 'student' then raise exception 'active learner access required';end if;
 if v_profile.education_stage_key is null or v_program.stage_key is distinct from v_profile.education_stage_key then raise exception 'program is not available for your education stage';end if;
 if v_program.program_kind='school_subject' then
   if v_profile.grade_level is null or v_profile.grade_level not between 1 and 12 then raise exception 'complete your grade level before practicing';end if;
   if v_program.grade_level is distinct from v_profile.grade_level then raise exception 'program is not available for your grade';end if;
 elsif v_program.grade_level is not null and v_program.grade_level is distinct from v_profile.grade_level then
   raise exception 'program is not available for your grade';
 end if;
end $guard$;
revoke all on function private.assert_mela_question_program_access(text) from public,anon;
grant execute on function private.assert_mela_question_program_access(text) to authenticated,service_role;

-- Topic parentage is authoritative for the chapter link, within the same grade/subject program.
update public.mela_question_bank q set chapter_id=t.chapter_id,updated_at=now()
from public.mela_learning_chapter_topics t join public.mela_learning_chapters c on c.id=t.chapter_id
where q.topic_id=t.id and c.program_key=q.program_key and q.chapter_id is distinct from t.chapter_id;

alter table public.mela_learning_chapters add constraint mela_chapter_program_identity unique(id,program_key);
alter table public.mela_learning_chapter_topics add constraint mela_topic_chapter_identity unique(id,chapter_id);
alter table public.mela_question_bank add constraint mela_question_chapter_program_fk
 foreign key(chapter_id,program_key) references public.mela_learning_chapters(id,program_key);
alter table public.mela_question_bank add constraint mela_question_topic_chapter_fk
 foreign key(topic_id,chapter_id) references public.mela_learning_chapter_topics(id,chapter_id);
alter table public.mela_question_bank add constraint mela_question_topic_requires_chapter check(topic_id is null or chapter_id is not null);


CREATE OR REPLACE FUNCTION private.get_question_subject_detail_v18(p_program_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_program public.mela_learning_programs%rowtype;
begin
  perform private.assert_mela_question_program_access(p_program_key);
  if v_uid is null then raise exception 'authentication required'; end if;
  select * into v_program from public.mela_learning_programs
  where program_key=p_program_key and active and program_kind='school_subject' and grade_level between 1 and 12;
  if not found then raise exception 'program not found'; end if;
  return jsonb_build_object(
    'quality_version','v18',
    'program',jsonb_build_object(
      'program_key',v_program.program_key,'grade_level',v_program.grade_level,'track_key',v_program.track_key,
      'subject_key',v_program.subject_key,'subject_title',v_program.subject_title,
      'question_count',(select count(*) from public.mela_question_bank q where q.program_key=v_program.program_key and q.active),
      'mastery_count',(select count(*) from public.mela_question_bank q where q.program_key=v_program.program_key and q.active and q.validation_status in ('deterministic_validated','educator_verified')),
      'review_required_count',(select count(*) from public.mela_question_bank q where q.program_key=v_program.program_key and q.active and q.validation_status='review_required')
    ),
    'chapters',coalesce((
      select jsonb_agg(jsonb_build_object(
        'chapter_id',c.id,'chapter_number',c.chapter_number,'chapter_title',c.title,
        'question_count',coalesce(qc.total_n,0),'mastery_count',coalesce(qc.mastery_n,0),'review_required_count',coalesce(qc.review_n,0),
        'free_count',coalesce(qc.free_n,0),'subscription_count',coalesce(qc.sub_n,0),'paid_pack_count',coalesce(qc.one_n,0),
        'topics',coalesce((
          select jsonb_agg(jsonb_build_object(
            'topic_id',t.id,'topic_number',t.topic_number,'topic_title',t.title,
            'question_count',coalesce(tq.total_n,0),'mastery_count',coalesce(tq.mastery_n,0),'review_required_count',coalesce(tq.review_n,0),
            'free_count',coalesce(tq.free_n,0),'subscription_count',coalesce(tq.sub_n,0),'paid_pack_count',coalesce(tq.one_n,0)
          ) order by t.display_order,t.topic_number)
          from public.mela_learning_chapter_topics t
          left join lateral (
            select count(*)::int as total_n,
              count(*) filter(where q.validation_status in ('deterministic_validated','educator_verified'))::int as mastery_n,
              count(*) filter(where q.validation_status='review_required')::int as review_n,
              count(*) filter(where q.access_tier='free')::int as free_n,
              count(*) filter(where q.access_tier='subscription')::int as sub_n,
              count(*) filter(where q.access_tier='one_time')::int as one_n
            from public.mela_question_bank q where q.topic_id=t.id and q.active
          ) tq on true
          where t.chapter_id=c.id and t.status='published'
        ),'[]'::jsonb)
      ) order by c.display_order,c.chapter_number)
      from public.mela_learning_chapters c
      left join lateral (
        select count(*)::int as total_n,
          count(*) filter(where q.validation_status in ('deterministic_validated','educator_verified'))::int as mastery_n,
          count(*) filter(where q.validation_status='review_required')::int as review_n,
          count(*) filter(where q.access_tier='free')::int as free_n,
          count(*) filter(where q.access_tier='subscription')::int as sub_n,
          count(*) filter(where q.access_tier='one_time')::int as one_n
        from public.mela_question_bank q where q.chapter_id=c.id and q.active
      ) qc on true
      where c.program_key=p_program_key and c.status='published'
    ),'[]'::jsonb)
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION private.start_mela_filtered_question_session_v15(p_program_key text, p_chapter_id uuid DEFAULT NULL::uuid, p_topic_id uuid DEFAULT NULL::uuid, p_count integer DEFAULT 10, p_difficulty integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_count int := greatest(5,least(coalesce(p_count,10),30));
  v_ids uuid[] := '{}';
  v_session uuid;
  v_allow_sub boolean := false;
  v_allow_one boolean := false;
  v_mult numeric := 1.0;
  v_chapter_title text;
  v_topic_title text;
begin
  perform private.assert_mela_question_program_access(p_program_key);
  if exists(select 1 from public.mela_learning_programs where program_key=p_program_key and program_kind='school_subject') then
    return private.start_mela_filtered_question_session_v18(p_program_key,p_chapter_id,p_topic_id,p_count,p_difficulty::integer,'mastery');
  end if;
  if v_uid is null then raise exception 'authentication required'; end if;
  if not exists(select 1 from public.mela_learning_programs where program_key=p_program_key and active and program_kind='school_subject') then raise exception 'learning program not found'; end if;
  if (select count(*) from public.mela_question_sessions where user_id=v_uid and started_at>now()-interval '1 hour') >= 60 then raise exception 'question session rate limit reached'; end if;
  if p_difficulty is not null and (p_difficulty<1 or p_difficulty>5) then raise exception 'difficulty must be 1-5'; end if;
  if p_topic_id is not null then
    select c.title,t.title into v_chapter_title,v_topic_title
    from public.mela_learning_chapter_topics t join public.mela_learning_chapters c on c.id=t.chapter_id
    where t.id=p_topic_id and c.program_key=p_program_key and t.status='published' and c.status='published';
    if not found then raise exception 'topic not found in selected subject'; end if;
    if p_chapter_id is not null and not exists(select 1 from public.mela_learning_chapter_topics where id=p_topic_id and chapter_id=p_chapter_id) then raise exception 'topic does not belong to selected chapter'; end if;
  elsif p_chapter_id is not null then
    select title into v_chapter_title from public.mela_learning_chapters where id=p_chapter_id and program_key=p_program_key and status='published';
    if not found then raise exception 'chapter not found in selected subject'; end if;
  end if;
  v_allow_sub := private.mela_user_has_question_access(v_uid,'subscription');
  v_allow_one := private.mela_user_has_question_access(v_uid,'one_time');
  select coalesce(extended_time_multiplier,1.0) into v_mult from public.learner_accessibility_preferences where user_id=v_uid;
  v_mult := coalesce(v_mult,1.0);
  select coalesce(array_agg(id order by sort_key),'{}'::uuid[]) into v_ids
  from (
    select q.id, hashtextextended(q.id::text||v_uid::text||clock_timestamp()::date::text,0) sort_key
    from public.mela_question_bank q
    where q.program_key=p_program_key and q.active
      and (p_chapter_id is null or q.chapter_id=p_chapter_id)
      and (p_topic_id is null or q.topic_id=p_topic_id)
      and (p_difficulty is null or q.difficulty=p_difficulty)
      and (q.access_tier='free' or (q.access_tier='subscription' and v_allow_sub) or (q.access_tier='one_time' and v_allow_one))
    order by sort_key
    limit v_count
  ) s;
  if cardinality(v_ids)<5 then raise exception 'not enough accessible questions for this chapter/topic filter'; end if;
  insert into public.mela_question_sessions(user_id,program_key,question_ids,requested_count,difficulty,seed,expires_at)
  values(v_uid,p_program_key,v_ids,cardinality(v_ids)::smallint,p_difficulty,coalesce(p_topic_id::text,p_chapter_id::text,'subject'),now()+(interval '2 hours'*v_mult)) returning id into v_session;
  return jsonb_build_object(
    'session_id',v_session,'program_key',p_program_key,'chapter_id',p_chapter_id,'chapter_title',v_chapter_title,'topic_id',p_topic_id,'topic_title',v_topic_title,
    'expires_at',(select expires_at from public.mela_question_sessions where id=v_session),
    'access',jsonb_build_object('subscription',v_allow_sub,'one_time',v_allow_one),
    'accessibility',coalesce((select to_jsonb(a)-'user_id'-'preference_note'-'created_at'-'updated_at' from public.learner_accessibility_preferences a where a.user_id=v_uid),'{}'::jsonb),
    'questions',(select jsonb_agg(jsonb_build_object('id',q.id,'question_number',q.question_number,'question_type',q.question_type,'prompt',q.prompt,'choices',q.choices,'difficulty',q.difficulty,'cognitive_level',q.cognitive_level,'access_tier',q.access_tier,'narration_text',q.narration_text,'response_schema',q.response_schema,'estimated_seconds',round(q.estimated_seconds*v_mult),'accessibility_support',q.accessibility_support) order by array_position(v_ids,q.id)) from public.mela_question_bank q where q.id=any(v_ids))
  );
end; $function$
;

CREATE OR REPLACE FUNCTION private.start_mela_filtered_question_session_v18(p_program_key text, p_chapter_id uuid DEFAULT NULL::uuid, p_topic_id uuid DEFAULT NULL::uuid, p_count integer DEFAULT 10, p_difficulty integer DEFAULT NULL::integer, p_practice_mode text DEFAULT 'mastery'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_count int := greatest(5,least(coalesce(p_count,10),30));
  v_ids uuid[] := '{}';
  v_session uuid;
  v_allow_sub boolean := false;
  v_allow_one boolean := false;
  v_mult numeric := 1.0;
  v_chapter_title text;
  v_topic_title text;
  v_available integer := 0;
  v_subject text;
  v_pref text;
  v_content_lang text := null;
begin
  perform private.assert_mela_question_program_access(p_program_key);
  if v_uid is null then raise exception 'authentication required'; end if;
  if p_practice_mode not in ('mastery','supplemental') then raise exception 'practice mode must be mastery or supplemental'; end if;
  select subject_title into v_subject from public.mela_learning_programs where program_key=p_program_key and active and program_kind='school_subject';
  if v_subject is null then raise exception 'learning program not found'; end if;
  if (select count(*) from public.mela_question_sessions where user_id=v_uid and started_at>now()-interval '1 hour') >= 60 then raise exception 'question session rate limit reached'; end if;
  if p_difficulty is not null and (p_difficulty<1 or p_difficulty>5) then raise exception 'difficulty must be 1-5'; end if;

  select preferred_language into v_pref from public.profiles where id=v_uid;
  if v_subject='Native Language' then
    v_content_lang := case lower(trim(v_pref)) when 'amharic' then 'am' when 'am' then 'am' when 'አማርኛ' then 'am' when 'afaan oromo' then 'om' when 'afaan oromoo' then 'om' when 'om' then 'om' when 'or' then 'om' when 'tigrinya' then 'ti' when 'ti' then 'ti' when 'ትግርኛ' then 'ti' when 'somali' then 'so' when 'so' then 'so' when 'soomaali' then 'so' else null end;
    if v_content_lang is null then raise exception 'Choose Amharic, Afaan Oromo, Tigrinya, or Somali in Mela before starting Native Language practice'; end if;
  elsif v_subject='Federal Working Language' then
    v_content_lang := 'am';
  elsif v_subject='Foreign Language' then
    raise exception 'Foreign Language is optional and requires a verified school/curriculum language variant before mastery practice';
  end if;

  if p_topic_id is not null then
    select c.title,t.title into v_chapter_title,v_topic_title from public.mela_learning_chapter_topics t join public.mela_learning_chapters c on c.id=t.chapter_id where t.id=p_topic_id and c.program_key=p_program_key and t.status='published' and c.status='published';
    if not found then raise exception 'topic not found in selected subject'; end if;
    if p_chapter_id is not null and not exists(select 1 from public.mela_learning_chapter_topics where id=p_topic_id and chapter_id=p_chapter_id) then raise exception 'topic does not belong to selected chapter'; end if;
  elsif p_chapter_id is not null then
    select title into v_chapter_title from public.mela_learning_chapters where id=p_chapter_id and program_key=p_program_key and status='published';
    if not found then raise exception 'chapter not found in selected subject'; end if;
  end if;

  v_allow_sub := private.mela_user_has_question_access(v_uid,'subscription');
  v_allow_one := private.mela_user_has_question_access(v_uid,'one_time');
  select coalesce(extended_time_multiplier,1.0) into v_mult from public.learner_accessibility_preferences where user_id=v_uid;
  v_mult := coalesce(v_mult,1.0);

  select count(*)::int into v_available from public.mela_question_bank q
  where q.program_key=p_program_key and q.active
    and (v_content_lang is null or q.content_language_code=v_content_lang)
    and (p_chapter_id is null or q.chapter_id=p_chapter_id)
    and (p_topic_id is null or q.topic_id=p_topic_id)
    and (p_difficulty is null or q.difficulty=p_difficulty)
    and ((p_practice_mode='mastery' and q.validation_status in ('deterministic_validated','educator_verified')) or (p_practice_mode='supplemental' and q.validation_status='review_required'))
    and (q.access_tier='free' or (q.access_tier='subscription' and v_allow_sub) or (q.access_tier='one_time' and v_allow_one));

  if v_available < 5 then
    if p_practice_mode='mastery' then raise exception 'mastery rebuild in progress for this filter: only % accessible mastery questions are currently available',v_available;
    else raise exception 'not enough accessible supplemental questions for this filter'; end if;
  end if;

  select coalesce(array_agg(id order by sort_key),'{}'::uuid[]) into v_ids from (
    select q.id,hashtextextended(q.id::text||v_uid::text||clock_timestamp()::text,0) sort_key
    from public.mela_question_bank q
    where q.program_key=p_program_key and q.active
      and (v_content_lang is null or q.content_language_code=v_content_lang)
      and (p_chapter_id is null or q.chapter_id=p_chapter_id)
      and (p_topic_id is null or q.topic_id=p_topic_id)
      and (p_difficulty is null or q.difficulty=p_difficulty)
      and ((p_practice_mode='mastery' and q.validation_status in ('deterministic_validated','educator_verified')) or (p_practice_mode='supplemental' and q.validation_status='review_required'))
      and (q.access_tier='free' or (q.access_tier='subscription' and v_allow_sub) or (q.access_tier='one_time' and v_allow_one))
    order by sort_key limit v_count
  ) s;

  insert into public.mela_question_sessions(user_id,program_key,question_ids,requested_count,difficulty,seed,expires_at)
  values(v_uid,p_program_key,v_ids,cardinality(v_ids)::smallint,p_difficulty,concat(p_practice_mode,':',coalesce(p_topic_id::text,p_chapter_id::text,'subject'),':',coalesce(v_content_lang,'ui')),now()+(interval '2 hours'*v_mult)) returning id into v_session;

  return jsonb_build_object(
    'session_id',v_session,'program_key',p_program_key,'practice_mode',p_practice_mode,'quality_state',case when p_practice_mode='mastery' then 'mastery_candidate' else 'supplemental_review_required' end,'available_count',v_available,'content_language_code',v_content_lang,
    'chapter_id',p_chapter_id,'chapter_title',v_chapter_title,'topic_id',p_topic_id,'topic_title',v_topic_title,'expires_at',(select expires_at from public.mela_question_sessions where id=v_session),
    'access',jsonb_build_object('subscription',v_allow_sub,'one_time',v_allow_one),'accessibility',coalesce((select to_jsonb(a)-'user_id'-'preference_note'-'created_at'-'updated_at' from public.learner_accessibility_preferences a where a.user_id=v_uid),'{}'::jsonb),
    'questions',(select jsonb_agg(jsonb_build_object('id',q.id,'question_number',q.question_number,'question_type',q.question_type,'prompt',q.prompt,'choices',q.choices,'difficulty',q.difficulty,'cognitive_level',q.cognitive_level,'access_tier',q.access_tier,'narration_text',q.narration_text,'response_schema',q.response_schema,'estimated_seconds',round(q.estimated_seconds*v_mult),'accessibility_support',q.accessibility_support,'content_language_code',q.content_language_code,'quality_state',case when q.validation_status in ('deterministic_validated','educator_verified') then 'mastery_candidate' else 'supplemental_review_required' end) order by array_position(v_ids,q.id)) from public.mela_question_bank q where q.id=any(v_ids))
  );
end $function$
;

CREATE OR REPLACE FUNCTION private.start_mela_question_session(p_program_key text, p_count integer DEFAULT 20, p_difficulty smallint DEFAULT NULL::smallint, p_seed text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_role text;
  v_stage text;
  v_grade smallint;
  v_admin boolean := false;
  v_program record;
  v_count integer := greatest(5,least(coalesce(p_count,20),30));
  v_seed text := coalesce(nullif(p_seed,''),coalesce(v_uid::text,'')||':'||current_date::text||':'||p_program_key);
  v_start integer;
  v_ids uuid[];
  v_session uuid;
  v_recent integer;
  v_questions jsonb;
  v_has_subscription boolean := false;
  v_has_one_time boolean := false;
begin
  perform private.assert_mela_question_program_access(p_program_key);
  if exists(select 1 from public.mela_learning_programs where program_key=p_program_key and program_kind='school_subject') then
    return private.start_mela_filtered_question_session_v18(p_program_key,null,null,p_count,p_difficulty::integer,'mastery');
  end if;
  if v_uid is null then raise exception 'authentication required'; end if;
  select role,education_stage_key,grade_level into v_role,v_stage,v_grade from public.profiles where id=v_uid;
  v_admin := coalesce(v_role='admin',false);
  select program_key,stage_key,grade_level,track_key,subject_title into v_program from public.mela_learning_programs where program_key=p_program_key and active;
  if v_program.program_key is null then raise exception 'learning program not found'; end if;
  if not v_admin then
    if v_role<>'student' then raise exception 'learner access required'; end if;
    if v_program.stage_key<>v_stage then raise exception 'program is not available for your education stage'; end if;
    if v_program.grade_level is not null and v_program.grade_level<>v_grade then raise exception 'program is not available for your grade'; end if;
  end if;

  if v_admin then
    v_has_subscription:=true; v_has_one_time:=true;
  else
    select exists(
      select 1 from public.mela_user_learning_entitlements e
      where e.user_id=v_uid and e.status='active' and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())
        and e.product_key in ('school_plus_monthly','school_plus_annual','family_plus_monthly','institution_learning_license')
    ) into v_has_subscription;
    select exists(
      select 1 from public.mela_user_learning_entitlements e
      where e.user_id=v_uid and e.status='active' and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())
        and e.product_key in ('grade12_exam_master','institution_learning_license')
    ) into v_has_one_time;
  end if;

  select count(*) into v_recent from public.mela_question_sessions where user_id=v_uid and started_at>now()-interval '1 hour';
  if v_recent>=60 then raise exception 'question-session rate limit reached; try again later'; end if;

  select 1 + mod(abs(hashtextextended(v_seed,0)),greatest(count(*),1))::integer into v_start
  from public.mela_question_bank q
  where q.program_key=p_program_key and q.active
    and (p_difficulty is null or q.difficulty=p_difficulty)
    and (q.access_tier='free' or (q.access_tier='subscription' and v_has_subscription) or (q.access_tier='one_time' and v_has_one_time));

  with eligible as (
    select q.id,q.question_number,q.prompt,q.choices,q.difficulty,q.question_type,q.access_tier,q.validation_status,q.chapter_id,q.topic_id
    from public.mela_question_bank q
    where q.program_key=p_program_key and q.active
      and (p_difficulty is null or q.difficulty=p_difficulty)
      and (q.access_tier='free' or (q.access_tier='subscription' and v_has_subscription) or (q.access_tier='one_time' and v_has_one_time))
  ), picked as (
    (select * from eligible where question_number>=v_start order by question_number limit v_count)
    union all
    (select * from eligible where question_number<v_start order by question_number limit v_count)
  ), final_pick as (select * from picked limit v_count)
  select array_agg(id order by question_number),
         jsonb_agg(jsonb_build_object(
           'id',id,'question_number',question_number,'prompt',prompt,'choices',choices,'difficulty',difficulty,
           'question_type',question_type,'access_tier',access_tier,'validation_status',validation_status,
           'chapter_id',chapter_id,'topic_id',topic_id
         ) order by question_number)
  into v_ids,v_questions from final_pick;

  if coalesce(array_length(v_ids,1),0)<v_count then raise exception 'not enough accessible questions for this filter'; end if;
  insert into public.mela_question_sessions(user_id,program_key,question_ids,requested_count,difficulty,seed)
  values(v_uid,p_program_key,v_ids,v_count,p_difficulty,v_seed) returning id into v_session;
  return jsonb_build_object('session_id',v_session,'program_key',p_program_key,'subject_title',v_program.subject_title,'count',v_count,'questions',coalesce(v_questions,'[]'::jsonb),'answer_keys_exposed',false);
end;
$function$
;

CREATE OR REPLACE FUNCTION private.start_mela_question_session_v12(p_program_key text, p_count integer DEFAULT 20, p_difficulty integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_count int := greatest(5,least(coalesce(p_count,20),30));
  v_start int;
  v_ids uuid[] := '{}';
  v_more uuid[] := '{}';
  v_session uuid;
  v_allow_sub boolean := false;
  v_allow_one boolean := false;
  v_mult numeric := 1.0;
begin
  perform private.assert_mela_question_program_access(p_program_key);
  if exists(select 1 from public.mela_learning_programs where program_key=p_program_key and program_kind='school_subject') then
    return private.start_mela_filtered_question_session_v18(p_program_key,null,null,p_count,p_difficulty::integer,'mastery');
  end if;
  if v_uid is null then raise exception 'authentication required'; end if;
  if not exists(select 1 from public.mela_learning_programs where program_key=p_program_key and active) then raise exception 'learning program not found'; end if;
  if (select count(*) from public.mela_question_sessions where user_id=v_uid and started_at>now()-interval '1 hour') >= 60 then raise exception 'question session rate limit reached'; end if;
  if p_difficulty is not null and (p_difficulty<1 or p_difficulty>5) then raise exception 'difficulty must be 1-5'; end if;

  v_allow_sub := private.mela_user_has_question_access(v_uid,'subscription');
  v_allow_one := private.mela_user_has_question_access(v_uid,'one_time');
  select coalesce(extended_time_multiplier,1.0) into v_mult from public.learner_accessibility_preferences where user_id=v_uid;
  v_mult := coalesce(v_mult,1.0);
  v_start := 1 + mod(abs(hashtextextended(v_uid::text||p_program_key||clock_timestamp()::text,0))::bigint,800)::int;

  select coalesce(array_agg(id order by question_number),'{}'::uuid[]) into v_ids
  from (select id,question_number from public.mela_question_bank
        where program_key=p_program_key and active and question_number>=v_start
          and (p_difficulty is null or difficulty=p_difficulty)
          and (access_tier='free' or (access_tier='subscription' and v_allow_sub) or (access_tier='one_time' and v_allow_one))
        order by question_number limit v_count) a;

  if cardinality(v_ids)<v_count then
    select coalesce(array_agg(id order by question_number),'{}'::uuid[]) into v_more
    from (select id,question_number from public.mela_question_bank
          where program_key=p_program_key and active and question_number<v_start
            and (p_difficulty is null or difficulty=p_difficulty)
            and (access_tier='free' or (access_tier='subscription' and v_allow_sub) or (access_tier='one_time' and v_allow_one))
          order by question_number limit (v_count-cardinality(v_ids))) b;
    v_ids := v_ids || v_more;
  end if;
  if cardinality(v_ids)<5 then raise exception 'not enough accessible questions for this filter'; end if;

  insert into public.mela_question_sessions(user_id,program_key,question_ids,requested_count,difficulty,seed,expires_at)
  values(v_uid,p_program_key,v_ids,cardinality(v_ids)::smallint,p_difficulty,v_start::text,now()+(interval '2 hours'*v_mult)) returning id into v_session;

  return jsonb_build_object(
    'session_id',v_session,
    'program_key',p_program_key,
    'expires_at',(select expires_at from public.mela_question_sessions where id=v_session),
    'access',jsonb_build_object('subscription',v_allow_sub,'one_time',v_allow_one),
    'accessibility',coalesce((select to_jsonb(a)-'user_id'-'preference_note'-'created_at'-'updated_at' from public.learner_accessibility_preferences a where a.user_id=v_uid),'{}'::jsonb),
    'questions',(select jsonb_agg(jsonb_build_object(
      'id',q.id,'question_number',q.question_number,'question_type',q.question_type,'prompt',q.prompt,'choices',q.choices,
      'difficulty',q.difficulty,'cognitive_level',q.cognitive_level,'access_tier',q.access_tier,'narration_text',q.narration_text,
      'response_schema',q.response_schema,'estimated_seconds',round(q.estimated_seconds*v_mult),'accessibility_support',q.accessibility_support
    ) order by array_position(v_ids,q.id)) from public.mela_question_bank q where q.id=any(v_ids))
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION private.start_practice_session(p_topic_id uuid, p_mode text DEFAULT 'untimed'::text, p_question_count integer DEFAULT 10, p_difficulty smallint DEFAULT NULL::smallint)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid := auth.uid(); v_session uuid; v_count int; v_profile public.profiles%rowtype; v_topic public.practice_topics%rowtype;
begin
  select * into v_profile from public.profiles where id=v_uid and account_status='active' and deleted_at is null;
  if not found or v_profile.role is distinct from 'student' then raise exception 'active learner access required';end if;
  select * into v_topic from public.practice_topics where id=p_topic_id and is_published;
  if not found then raise exception 'Practice topic not found';end if;
  if v_profile.education_stage_key like 'school_%' then
    if v_profile.grade_level is null or v_profile.grade_level not between 1 and 12 then raise exception 'complete your grade level before practicing';end if;
    if v_topic.grade_level is distinct from v_profile.grade_level::text then raise exception 'practice topic is not available for your grade; use the curriculum Question Bank';end if;
  elsif v_profile.education_stage_key in ('college_tvet','university') then
    if v_topic.grade_level is distinct from 'career' then raise exception 'practice topic is not available for your education stage';end if;
  else raise exception 'complete your education profile before practicing';end if;
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_mode not in ('learn','untimed','timed','mock','daily','weak_skill') then raise exception 'Invalid practice mode'; end if;
  if p_question_count < 1 or p_question_count > 30 then raise exception 'question_count must be between 1 and 30'; end if;
  if p_difficulty is not null and (p_difficulty < 1 or p_difficulty > 3) then raise exception 'Invalid difficulty'; end if;
  if not exists(select 1 from public.practice_topics t where t.id=p_topic_id and t.is_published=true) then raise exception 'Practice topic not found'; end if;

  insert into public.practice_sessions(user_id,topic_id,mode,difficulty,time_limit_seconds)
  values(v_uid,p_topic_id,p_mode,p_difficulty,case when p_mode in ('timed','mock','daily') then greatest(300,p_question_count*90) else null end)
  returning id into v_session;

  insert into public.practice_session_questions(session_id,question_id,question_order,max_points)
  select v_session,q.id,row_number() over(order by md5(q.id::text||v_session::text)),q.max_points
  from public.practice_questions q
  where q.topic_id=p_topic_id and q.is_published=true and (p_difficulty is null or q.difficulty=p_difficulty)
  order by md5(q.id::text||v_session::text)
  limit p_question_count;

  select count(*) into v_count from public.practice_session_questions where session_id=v_session;
  if v_count=0 then delete from public.practice_sessions where id=v_session; raise exception 'No published practice questions match this selection'; end if;
  update public.practice_sessions set question_count=v_count, updated_at=now() where id=v_session;
  return v_session;
end $function$
;

CREATE OR REPLACE FUNCTION private.submit_mela_question_session_v12(p_session_id uuid, p_answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_session public.mela_question_sessions%rowtype;
  v_answered int:=0;
  v_correct int:=0;
  v_score numeric:=0;
  v_details jsonb:='[]'::jsonb;
  r record;
  v_resp jsonb;
  v_ok boolean;
  v_norm text;
begin
  if v_uid is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(p_answers) is distinct from 'array' then raise exception 'answers must be a JSON array'; end if;
  select * into v_session from public.mela_question_sessions where id=p_session_id and user_id=v_uid for update;
  if not found then raise exception 'question session not found'; end if;
  if v_session.status='submitted' then
    return jsonb_build_object('session_id',v_session.id,'answered_count',v_session.answered_count,'correct_count',v_session.correct_count,'question_count',cardinality(v_session.question_ids),'score_percent',v_session.score_percent,'details','[]'::jsonb,'already_submitted',true);
  end if;
  if v_session.status<>'started' then raise exception 'question session already submitted'; end if;
  if v_session.expires_at<now() then raise exception 'question session expired'; end if;

  if jsonb_array_length(p_answers)<>cardinality(v_session.question_ids)
    or (select count(distinct a->>'question_id') from jsonb_array_elements(p_answers) a)<>cardinality(v_session.question_ids)
    or exists(select 1 from jsonb_array_elements(p_answers) a where not ((a->>'question_id')::uuid=any(v_session.question_ids)) or a->'response' is null or a->'response'='null'::jsonb or (jsonb_typeof(a->'response')='string' and trim(a->>'response')='')) then
    raise exception 'answer every session question exactly once';
  end if;

  for r in
    select q.id,q.question_number,q.question_type,g.grading_kind,g.correct_response,g.accepted_variants,g.tolerance,g.rationale
    from public.mela_question_bank q join private.mela_question_grading_v12 g on g.question_id=q.id
    where q.id=any(v_session.question_ids)
    order by array_position(v_session.question_ids,q.id)
  loop
    select a->'response' into v_resp from jsonb_array_elements(p_answers) a where a->>'question_id'=r.id::text limit 1;
    if v_resp is null then
      v_ok:=false;
    else
      v_answered:=v_answered+1;
      if r.grading_kind in ('single_choice','true_false') then
        v_ok := lower(trim(coalesce(case when jsonb_typeof(v_resp)='string' then trim(both '\"' from v_resp::text) else v_resp->>'choice' end,''))) = lower(trim(r.correct_response->>'choice'));
      elsif r.grading_kind='multi_select' then
        v_ok := (select coalesce(array_agg(lower(value) order by lower(value)),'{}'::text[]) from jsonb_array_elements_text(case when jsonb_typeof(v_resp)='array' then v_resp else coalesce(v_resp->'choices','[]'::jsonb) end))
                = (select coalesce(array_agg(lower(value) order by lower(value)),'{}'::text[]) from jsonb_array_elements_text(r.correct_response->'choices'));
      elsif r.grading_kind='numeric' then
        begin
          v_ok := abs((case when jsonb_typeof(v_resp)='number' then v_resp::text::numeric else trim(both '\"' from v_resp::text)::numeric end) - (r.correct_response->>'value')::numeric) <= coalesce(r.tolerance,0);
        exception when others then v_ok:=false; end;
      elsif r.grading_kind='short_answer' then
        v_norm := lower(regexp_replace(trim(case when jsonb_typeof(v_resp)='string' then trim(both '\"' from v_resp::text) else coalesce(v_resp->>'text','') end),'[^[:alnum:] ]','','g'));
        v_ok := v_norm = lower(regexp_replace(trim(r.correct_response->>'text'),'[^[:alnum:] ]','','g')) or exists(select 1 from jsonb_array_elements_text(r.accepted_variants) x where v_norm=lower(regexp_replace(trim(x),'[^[:alnum:] ]','','g')));
      elsif r.grading_kind='matching' then
        v_ok := coalesce(case when jsonb_typeof(v_resp)='array' then v_resp else v_resp->'pairs' end,'[]'::jsonb) = r.correct_response->'pairs';
      elsif r.grading_kind='ordering' then
        v_ok := coalesce(case when jsonb_typeof(v_resp)='array' then v_resp else v_resp->'order' end,'[]'::jsonb) = r.correct_response->'order';
      else v_ok:=false;
      end if;
    end if;
    if v_ok then v_correct:=v_correct+1; end if;
    v_details := v_details || jsonb_build_array(jsonb_build_object('question_id',r.id,'question_number',r.question_number,'question_type',r.question_type,'correct',v_ok,'rationale',r.rationale));
  end loop;

  v_score := case when cardinality(v_session.question_ids)>0 then round(100.0*v_correct/cardinality(v_session.question_ids),2) else 0 end;
  update public.mela_question_sessions set status='submitted',selected_answers=p_answers,answered_count=v_answered::smallint,correct_count=v_correct::smallint,score_percent=v_score,submitted_at=now() where id=p_session_id;

  insert into public.mela_question_user_program_stats(user_id,program_key,sessions_completed,questions_answered,correct_answers,cumulative_score,average_score,best_score,last_score,last_practiced_at)
  values(v_uid,v_session.program_key,1,cardinality(v_session.question_ids),v_correct,v_score,v_score,v_score,v_score,now())
  on conflict(user_id,program_key) do update set
    sessions_completed=public.mela_question_user_program_stats.sessions_completed+1,
    questions_answered=public.mela_question_user_program_stats.questions_answered+excluded.questions_answered,
    correct_answers=public.mela_question_user_program_stats.correct_answers+excluded.correct_answers,
    cumulative_score=public.mela_question_user_program_stats.cumulative_score+excluded.cumulative_score,
    average_score=round((public.mela_question_user_program_stats.cumulative_score+excluded.cumulative_score)/(public.mela_question_user_program_stats.sessions_completed+1),2),
    best_score=greatest(coalesce(public.mela_question_user_program_stats.best_score,0),excluded.best_score),
    last_score=excluded.last_score,last_practiced_at=now(),updated_at=now();

  return jsonb_build_object('session_id',p_session_id,'answered_count',v_answered,'correct_count',v_correct,'question_count',cardinality(v_session.question_ids),'score_percent',v_score,'details',v_details);
end;
$function$
;

-- Keep earlier clients compatible with the typed, retry-safe grader.
create or replace function private.submit_mela_question_session(p_session_id uuid,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path='' as $compat$
declare v_answers jsonb; v_result jsonb;
begin
 if jsonb_typeof(p_answers)='object' then
   select coalesce(jsonb_agg(jsonb_build_object('question_id',key,'response',value)),'[]'::jsonb) into v_answers from jsonb_each(p_answers);
 elsif jsonb_typeof(p_answers)='array' then
   select coalesce(jsonb_agg(case when a ? 'response' then a else jsonb_build_object('question_id',a->'question_id','response',a->'selected_choice') end),'[]'::jsonb) into v_answers from jsonb_array_elements(p_answers) a;
 else raise exception 'answers must be an object or array';end if;
 v_result:=private.submit_mela_question_session_v12(p_session_id,v_answers);
 return v_result||jsonb_build_object('correct',v_result->'correct_count','answered',v_result->'answered_count','total',v_result->'question_count');
end $compat$;

