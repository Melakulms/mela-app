CREATE OR REPLACE FUNCTION private.get_mela_academy_catalog()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',c.id,'slug',c.slug,'prepared_lesson_count',(select count(*) from public.mela_ai_course_lessons d where d.course_id=c.id),'title',c.title,'description',c.description,'category',c.category,'level',c.level,
  'duration_minutes',c.duration_minutes,'price_cents',c.price_cents,'prerequisites',c.prerequisites,
  'learning_outcomes',c.learning_outcomes,'audience',c.audience,'career_track',c.career_track,
  'lesson_count',i.lesson_count,'preview_lesson_count',i.preview_lesson_count,
  'content_available',coalesce(i.content_available,false)
 ) order by c.featured_rank nulls last,c.title,c.id),'[]'::jsonb)
 from public.courses c join admin.course_content_inventory i on i.id=c.id where c.is_published;
$function$;

CREATE OR REPLACE FUNCTION private.review_question_slice_v18(p_slice_id bigint, p_decisions jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_uid uuid:=(select auth.uid()); s private.mela_question_review_slices_v18%rowtype; x jsonb; v_q uuid; v_dec text; v_total int; v_done int; v_approved int; v_changes int; v_rebuild jsonb; begin
 if v_uid is null then raise exception 'authentication required'; end if;
 if jsonb_typeof(p_decisions) is distinct from 'array' then raise exception 'decisions must be an array'; end if;
 if jsonb_array_length(p_decisions) not between 1 and 100 then raise exception 'Provide 1 to 100 decisions'; end if;
 select * into s from private.mela_question_review_slices_v18 where id=p_slice_id for update;
 if not found then raise exception 'review slice not found'; end if;
 if not private.question_reviewer_allowed_v18(v_uid,s.program_key) then raise exception 'verified educator subject access required'; end if;
 foreach x in array(select array_agg(value) from jsonb_array_elements(p_decisions)) loop
   v_q:=(x->>'question_id')::uuid; v_dec:=x->>'decision';
   if v_q is null or not (v_q=any(s.question_ids)) then raise exception 'question does not belong to this review slice'; end if;
   if v_dec is null or v_dec not in ('approved','changes_required') then raise exception 'invalid review decision'; end if;
   if length(btrim(coalesce(x->>'note',''))) < 5 or length(coalesce(x->>'note','')) > 2000 then raise exception 'A review note of 5 to 2000 characters is required'; end if;
   if v_dec='approved' and (coalesce(x->>'note','') not like 'Teacher test response: %' or position(E'\nVerification: ' in coalesce(x->>'note',''))=0) then raise exception 'Independent teacher test response and verification note required'; end if;
   insert into private.mela_question_review_decisions_v18(slice_id,question_id,reviewer_id,decision,note,reviewed_at)
   values(s.id,v_q,v_uid,v_dec,nullif(btrim(coalesce(x->>'note','')),''),now())
   on conflict(slice_id,question_id) do update set reviewer_id=excluded.reviewer_id,decision=excluded.decision,note=excluded.note,reviewed_at=excluded.reviewed_at;
   if v_dec='approved' then
     update public.mela_question_bank set validation_status='educator_verified',quality_checks=quality_checks||jsonb_build_object('v18_educator_verified',true,'v18_educator_verified_at',now()),updated_at=now() where id=v_q;
   else
     update public.mela_question_bank set validation_status='review_required',machine_quality_score=least(machine_quality_score,60),quality_checks=quality_checks||jsonb_build_object('v18_educator_changes_required',true,'v18_educator_reviewed_at',now()),updated_at=now() where id=v_q;
   end if;
 end loop;
 select count(*) into v_total from unnest(s.question_ids);
 select count(*),count(*) filter(where decision='approved'),count(*) filter(where decision='changes_required') into v_done,v_approved,v_changes from private.mela_question_review_decisions_v18 where slice_id=s.id;
 update private.mela_question_review_slices_v18 set status=case when v_done=v_total and v_changes=0 then 'approved' when v_done=v_total and v_changes>0 then 'changes_required' when v_done>0 then 'in_review' else 'pending' end,reviewed_at=case when v_done=v_total then now() else reviewed_at end,updated_at=now() where id=s.id;
 v_rebuild:=private.reconcile_program_replacement_targets_v18(s.program_key);
 update public.mela_question_review_batches b set educator_verified_count=(select count(*) from public.mela_question_bank q where q.program_key=s.program_key and q.active and q.validation_status='educator_verified'),deterministic_validated_count=(select count(*) from public.mela_question_bank q where q.program_key=s.program_key and q.active and q.validation_status in ('deterministic_validated','educator_verified')),review_status=case when (v_rebuild->>'questions_needed')::int>0 or exists(select 1 from public.mela_question_bank q where q.program_key=s.program_key and q.active and q.validation_status='review_required') then 'changes_required' else 'in_review' end,updated_at=now() where b.program_key=s.program_key;
 return jsonb_build_object('slice_id',s.id,'reviewed',v_done,'approved',v_approved,'changes_required',v_changes,'total',v_total,'rebuild_state',v_rebuild);
end $function$;

create index mela_ai_lessons_reviewer_idx on public.mela_ai_course_lessons(reviewed_by);
create index mela_ai_assignments_user_idx on private.mela_ai_course_reviewer_assignments(user_id);
create index mela_ai_assignments_author_idx on private.mela_ai_course_reviewer_assignments(assigned_by);
create index mela_ai_reviews_lesson_idx on private.mela_ai_lesson_reviews(lesson_key);
create index mela_ai_reviews_reviewer_idx on private.mela_ai_lesson_reviews(reviewer_id);

create table private.mela_question_review_history_v19 (
 id bigint generated always as identity primary key,
 slice_id bigint not null,
 question_id uuid not null,
 reviewer_id uuid not null,
 decision text not null,
 note text,
 previous_decision jsonb,
 recorded_at timestamptz not null default now()
);
alter table private.mela_question_review_history_v19 enable row level security;
revoke all on private.mela_question_review_history_v19 from public,anon,authenticated;
create function private.audit_question_review_v19() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into private.mela_question_review_history_v19(slice_id,question_id,reviewer_id,decision,note,previous_decision)
 values(new.slice_id,new.question_id,new.reviewer_id,new.decision,new.note,case when tg_op='UPDATE' then to_jsonb(old) else null end);
 return new;
end $$;
revoke all on function private.audit_question_review_v19() from public,anon,authenticated;
create trigger question_review_history_v19 after insert or update on private.mela_question_review_decisions_v18 for each row execute function private.audit_question_review_v19();
notify pgrst,'reload schema';

