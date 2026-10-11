-- Additive content installation; existing lessons, progress and reviews are preserved.
create table public.mela_ai_course_lessons (
 lesson_key text primary key,
 course_id uuid not null references public.courses(id),
 content_version text not null,
 title text not null,
 module_title text not null,
 position integer not null check(position between 1 and 6),
 duration_minutes integer not null check(duration_minutes>0),
 content_text text not null check(length(btrim(content_text))>0),
 review_status text not null default 'draft' check(review_status in ('draft','changes_required','approved')),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 unique(course_id,content_version,position)
);
alter table public.mela_ai_course_lessons enable row level security;
revoke all on public.mela_ai_course_lessons from public,anon,authenticated;
grant select on public.mela_ai_course_lessons to authenticated;
create policy ai_lessons_active_reader on public.mela_ai_course_lessons for select to authenticated
using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_status='active' and p.deleted_at is null));

create table private.mela_ai_lesson_answer_keys (
 lesson_key text primary key references public.mela_ai_course_lessons(lesson_key),
 assessment jsonb not null
);
create table private.mela_ai_course_reviewer_assignments (
 course_id uuid not null references public.courses(id),
 user_id uuid not null references auth.users(id),
 assigned_by uuid not null references auth.users(id),
 active boolean not null default true,
 assigned_at timestamptz not null default now(),
 primary key(course_id,user_id)
);
create table private.mela_ai_lesson_reviews (
 id bigint generated always as identity primary key,
 lesson_key text not null references public.mela_ai_course_lessons(lesson_key),
 content_version text not null,
 reviewer_id uuid not null references auth.users(id),
 decision text not null check(decision in ('approved','changes_required')),
 independent_answer text not null,
 note text not null,
 reviewed_at timestamptz not null default now()
);
alter table private.mela_ai_lesson_answer_keys enable row level security;
alter table private.mela_ai_course_reviewer_assignments enable row level security;
alter table private.mela_ai_lesson_reviews enable row level security;
revoke all on private.mela_ai_lesson_answer_keys,private.mela_ai_course_reviewer_assignments,private.mela_ai_lesson_reviews from public,anon,authenticated;

create function private.can_review_ai_course_v1(p_course_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and (
 private.is_admin_user() or exists(
 select 1 from private.mela_ai_course_reviewer_assignments a
 join public.teacher_profiles t on t.user_id=a.user_id and t.verification_status='approved'
 join public.profiles p on p.id=a.user_id and p.account_status='active' and p.deleted_at is null
 where a.user_id=(select auth.uid()) and a.course_id=p_course_id and a.active));
$$;
revoke all on function private.can_review_ai_course_v1(uuid) from public,anon,authenticated;

create function private.assign_ai_course_reviewer_v1(p_course_id uuid,p_user_id uuid,p_active boolean default true) returns void
language plpgsql security definer set search_path='' as $$
begin
 if (select auth.uid()) is null or not private.is_admin_user() then raise exception 'MFA-protected administrator access required'; end if;
 if not exists(select 1 from public.teacher_profiles t join public.profiles p on p.id=t.user_id where t.user_id=p_user_id and t.verification_status='approved' and p.account_status='active' and p.deleted_at is null) then raise exception 'An approved active teacher is required'; end if;
 insert into private.mela_ai_course_reviewer_assignments(course_id,user_id,assigned_by,active)
 values(p_course_id,p_user_id,(select auth.uid()),p_active)
 on conflict(course_id,user_id) do update set active=excluded.active,assigned_by=excluded.assigned_by,assigned_at=now();
end $$;
create function public.assign_ai_course_reviewer_v1(p_course_id uuid,p_user_id uuid,p_active boolean default true) returns void
language sql set search_path='' as $$ select private.assign_ai_course_reviewer_v1(p_course_id,p_user_id,p_active); $$;

create function private.get_ai_lesson_review_queue_v1() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('lesson_key',l.lesson_key,'course_id',c.id,'course_title',c.title,'title',l.title,'position',l.position,'review_status',l.review_status,'content_version',l.content_version) order by c.title,l.position)
 from public.mela_ai_course_lessons l join public.courses c on c.id=l.course_id where private.can_review_ai_course_v1(c.id)),'[]'::jsonb);
end $$;
create function public.get_ai_lesson_review_queue_v1() returns jsonb language sql stable set search_path='' as $$ select private.get_ai_lesson_review_queue_v1(); $$;

create function private.get_ai_lesson_review_detail_v1(p_lesson_key text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare l public.mela_ai_course_lessons%rowtype;
begin
 select * into l from public.mela_ai_course_lessons where lesson_key=p_lesson_key;
 if not found or not private.can_review_ai_course_v1(l.course_id) then raise exception 'Assigned verified course reviewer required'; end if;
 return jsonb_build_object('lesson',to_jsonb(l),'answer_key',(select assessment from private.mela_ai_lesson_answer_keys where lesson_key=l.lesson_key));
end $$;
create function public.get_ai_lesson_review_detail_v1(p_lesson_key text) returns jsonb language sql stable set search_path='' as $$ select private.get_ai_lesson_review_detail_v1(p_lesson_key); $$;

create function private.review_ai_lesson_v1(p_lesson_key text,p_content_version text,p_decision text,p_attempt text,p_note text,p_checked boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare l public.mela_ai_course_lessons%rowtype;
begin
 select * into l from public.mela_ai_course_lessons where lesson_key=p_lesson_key for update;
 if not found or not private.can_review_ai_course_v1(l.course_id) then raise exception 'Assigned verified course reviewer required'; end if;
 if p_content_version is distinct from l.content_version then raise exception 'Lesson version changed; reload before reviewing'; end if;
 if p_decision is null or p_decision not in ('approved','changes_required') or length(btrim(coalesce(p_attempt,'')))<1 or length(btrim(coalesce(p_note,'')))<5 or p_checked is distinct from true then raise exception 'Independent attempt, decision, checklist and review note required'; end if;
 if length(p_note)>4000 or length(p_attempt)>4000 then raise exception 'Review fields exceed 4000 characters'; end if;
 insert into private.mela_ai_lesson_reviews(lesson_key,content_version,reviewer_id,decision,independent_answer,note)
 values(l.lesson_key,l.content_version,(select auth.uid()),p_decision,p_attempt,p_note);
 update public.mela_ai_course_lessons set review_status=p_decision,reviewed_by=(select auth.uid()),reviewed_at=now() where lesson_key=l.lesson_key;
 return jsonb_build_object('lesson_key',l.lesson_key,'review_status',p_decision);
end $$;
create function public.review_ai_lesson_v1(p_lesson_key text,p_content_version text,p_decision text,p_attempt text,p_note text,p_checked boolean) returns jsonb
language sql set search_path='' as $$ select private.review_ai_lesson_v1(p_lesson_key,p_content_version,p_decision,p_attempt,p_note,p_checked); $$;

-- Every current bank question becomes reachable without replacing prior slices.
lock table private.mela_question_review_slices_v18 in share row exclusive mode;
with covered as materialized (select unnest(question_ids) id from private.mela_question_review_slices_v18),
 missing as (select q.id,q.program_key,q.question_number from public.mela_question_bank q where not exists(select 1 from covered x where x.id=q.id)),
 numbered as (select *,((row_number() over(partition by program_key order by question_number,id)-1)/100)::int batch from missing),
 offsets as (select program_key,max(slice_number) last_slice from private.mela_question_review_slices_v18 group by program_key)
insert into private.mela_question_review_slices_v18(program_key,slice_number,question_ids,question_count,review_scope,status)
select n.program_key,coalesce(o.last_slice,0)+n.batch+1,array_agg(n.id order by n.question_number,n.id),count(*)::int,'complete_bank_teacher_review','pending'
from numbered n left join offsets o using(program_key) group by n.program_key,o.last_slice,n.batch;

create function private.get_question_review_queue_v19(p_program_key text default null,p_grade integer default null,p_status text default null,p_after bigint default 0,p_limit integer default 50) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=(select auth.uid()); allowed text[]; result jsonb; lim int:=least(greatest(coalesce(p_limit,50),1),100); total bigint; questions bigint; last_id bigint; more boolean;
begin
 if u is null then raise exception 'Authentication required'; end if;
 select coalesce(array_agg(p.program_key),'{}'::text[]) into allowed from public.mela_learning_programs p
 where (p_program_key is null or p.program_key=p_program_key) and (p_grade is null or p.grade_level=p_grade)
 and private.question_reviewer_allowed_v18(u,p.program_key);
 select count(*),coalesce(sum(question_count),0) into total,questions from private.mela_question_review_slices_v18 s
 where s.program_key=any(allowed) and (p_status is null or s.status=p_status);
 select coalesce(jsonb_agg(to_jsonb(z) order by z.slice_id),'[]'::jsonb),max(z.slice_id) into result,last_id from (
 select s.id slice_id,s.program_key,p.grade_level,p.subject_title,s.slice_number,s.question_count,s.status,s.assigned_to,s.reviewed_at
 from private.mela_question_review_slices_v18 s join public.mela_learning_programs p using(program_key)
 where s.program_key=any(allowed) and (p_status is null or s.status=p_status) and s.id>coalesce(p_after,0) order by s.id limit lim) z;
 select exists(select 1 from private.mela_question_review_slices_v18 s where s.program_key=any(allowed) and (p_status is null or s.status=p_status) and s.id>last_id) into more;
 return jsonb_build_object('items',result,'total_slices',total,'total_questions',questions,'next_after',case when more then last_id else null end);
end $$;
create function public.get_question_review_queue_v19(p_program_key text default null,p_grade integer default null,p_status text default null,p_after bigint default 0,p_limit integer default 50) returns jsonb
language sql stable set search_path='' as $$ select private.get_question_review_queue_v19(p_program_key,p_grade,p_status,p_after,p_limit); $$;

-- Private implementation and invoker wrapper grants: no anonymous execution.
revoke all on function private.assign_ai_course_reviewer_v1(uuid,uuid,boolean),public.assign_ai_course_reviewer_v1(uuid,uuid,boolean),private.get_ai_lesson_review_queue_v1(),public.get_ai_lesson_review_queue_v1(),private.get_ai_lesson_review_detail_v1(text),public.get_ai_lesson_review_detail_v1(text),private.review_ai_lesson_v1(text,text,text,text,text,boolean),public.review_ai_lesson_v1(text,text,text,text,text,boolean),private.get_question_review_queue_v19(text,integer,text,bigint,integer),public.get_question_review_queue_v19(text,integer,text,bigint,integer) from public,anon,authenticated;
grant execute on function private.assign_ai_course_reviewer_v1(uuid,uuid,boolean),public.assign_ai_course_reviewer_v1(uuid,uuid,boolean),private.get_ai_lesson_review_queue_v1(),public.get_ai_lesson_review_queue_v1(),private.get_ai_lesson_review_detail_v1(text),public.get_ai_lesson_review_detail_v1(text),private.review_ai_lesson_v1(text,text,text,text,text,boolean),public.review_ai_lesson_v1(text,text,text,text,text,boolean),private.get_question_review_queue_v19(text,integer,text,bigint,integer),public.get_question_review_queue_v19(text,integer,text,bigint,integer) to authenticated;
notify pgrst,'reload schema';
