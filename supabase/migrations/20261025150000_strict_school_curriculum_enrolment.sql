-- Strict grade + enrolled subject + Grades 11/12 academic stream access.
-- Existing admins retain verified review permission. Question and payment data unchanged.
CREATE OR REPLACE FUNCTION private.assert_mela_question_program_access(p_program_key text)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_uid uuid:=(select auth.uid());
 v_profile public.profiles%rowtype;
 v_program public.mela_learning_programs%rowtype;
 v_subjects text[];
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

   -- A verified grade alone is not enough: require a stored subject enrolment.
   -- Do not trust caller-provided grade, stream, selected subject, or browser state.
   select s.subjects into v_subjects from public.student_profiles s where s.user_id=v_uid;
   if cardinality(coalesce(v_subjects,'{}'::text[]))=0 then
     raise exception 'complete your enrolled school subjects before practicing';
   end if;
   if v_program.subject_key is null or not (v_program.subject_key = any(v_subjects)) then
     raise exception 'subject is not enrolled in your education profile';
   end if;
   -- The selected subject must belong to the authorized national stage + stream.
   if not exists (
     select 1 from public.mela_national_subject_catalog c
     where c.active and c.stage_key=v_program.stage_key and c.track_key=v_program.track_key
       and c.subject_key=v_program.subject_key
   ) then raise exception 'subject is not listed for your curriculum'; end if;
   -- Every compulsory subject must be present: incomplete enrollment cannot
   -- unlock sessions, and this identifies the stream for Grades 11 and 12.
   if exists (
     select 1 from public.mela_national_subject_catalog c
     where c.active and c.stage_key=v_program.stage_key and c.track_key=v_program.track_key
       and c.optional=false and not (c.subject_key = any(v_subjects))
   ) then raise exception 'complete the required subjects for your curriculum stream'; end if;
   -- Deny mixing Natural Sciences and Social Sciences, including if a caller
   -- attempts to register subjects from both streams in the saved profile.
   if v_profile.grade_level in (11,12) and exists (
     select 1 from public.mela_national_subject_catalog other_c
     where other_c.active and other_c.stage_key=v_program.stage_key
       and other_c.track_key<>v_program.track_key and other_c.subject_key=any(v_subjects)
       and not exists (
         select 1 from public.mela_national_subject_catalog own_c
         where own_c.active and own_c.stage_key=v_program.stage_key
           and own_c.track_key=v_program.track_key and own_c.subject_key=other_c.subject_key
       )
   ) then raise exception 'subject enrollment does not match your registered academic stream'; end if;
 elsif v_program.grade_level is not null and v_program.grade_level is distinct from v_profile.grade_level then
   raise exception 'program is not available for your grade';
 end if;
end $function$

