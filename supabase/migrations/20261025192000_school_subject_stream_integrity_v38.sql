
-- STAGING FIRST: enrolled-subject and senior-stream authority belongs to the server.
-- Existing incomplete rows are preserved, not automatically cleared.
ALTER TABLE public.student_profiles ADD COLUMN IF NOT EXISTS academic_track_key text;
ALTER TABLE public.student_profiles ADD CONSTRAINT student_academic_track_allowed_v38
 CHECK (academic_track_key IS NULL OR academic_track_key IN ('common','natural_sciences','social_sciences'));

CREATE OR REPLACE FUNCTION private.validate_school_enrollment_v38()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $guard$
DECLARE
 v_role text; v_stage text; v_grade integer; v_track text; v_expected_stage text;
 v_invalid integer; v_missing integer; v_distinct integer;
BEGIN
 SELECT role::text,education_stage_key,grade_level INTO v_role,v_stage,v_grade
 FROM public.profiles WHERE id=NEW.user_id;
 IF v_role IS DISTINCT FROM 'student' THEN
   RAISE EXCEPTION 'registered student profile required';
 END IF;
 IF TG_OP='UPDATE' THEN
   IF OLD.academic_track_key IS NOT NULL AND
      OLD.academic_track_key IS DISTINCT FROM NEW.academic_track_key AND NOT private.is_admin_user() THEN
      RAISE EXCEPTION 'academic stream is locked; administrator review required';
   END IF;
 END IF;
 IF v_stage IN ('school_1_6','school_7_8','school_9_10','school_11_12') THEN
   IF v_grade IS NULL OR v_grade NOT BETWEEN 1 AND 12 THEN
     RAISE EXCEPTION 'valid school grade required';
   END IF;
   v_expected_stage:=CASE WHEN v_grade<=6 THEN 'school_1_6'
     WHEN v_grade<=8 THEN 'school_7_8'
     WHEN v_grade<=10 THEN 'school_9_10'
     ELSE 'school_11_12' END;
   IF v_stage<>v_expected_stage THEN
     RAISE EXCEPTION 'school grade and stage do not match';
   END IF;
   IF v_grade>=11 THEN
     v_track:=NEW.academic_track_key;
     IF v_track IS NULL OR v_track NOT IN ('natural_sciences','social_sciences') THEN
       RAISE EXCEPTION 'select valid senior school stream first';
     END IF;
   ELSE
     IF NEW.academic_track_key IS NOT NULL AND NEW.academic_track_key<>'common' THEN
       RAISE EXCEPTION 'school Grades 1–10 use common curriculum';
     END IF;
     NEW.academic_track_key:='common';
     v_track:='common';
   END IF;
   IF cardinality(NEW.subjects)>0 THEN
     SELECT count(*) INTO v_invalid FROM unnest(NEW.subjects) AS selected(subject_key)
     WHERE NOT EXISTS(
       SELECT 1 FROM public.mela_national_subject_catalog c
       WHERE c.active AND c.stage_key=v_stage AND c.track_key=v_track AND c.subject_key=selected.subject_key);
     IF v_invalid>0 THEN
       RAISE EXCEPTION 'subject is outside saved grade or academic stream';
     END IF;
     SELECT count(*) INTO v_missing FROM public.mela_national_subject_catalog c
     WHERE c.active AND c.stage_key=v_stage AND c.track_key=v_track AND c.optional=false
       AND NOT (c.subject_key=ANY(NEW.subjects));
     IF v_missing>0 THEN
       RAISE EXCEPTION 'mandatory school subjects cannot be removed';
     END IF;
     SELECT count(DISTINCT selected.subject_key) INTO v_distinct
     FROM unnest(NEW.subjects) AS selected(subject_key);
     IF v_distinct<>cardinality(NEW.subjects) THEN
       RAISE EXCEPTION 'duplicate curriculum subject';
     END IF;
   END IF;
 ELSIF v_stage IN ('university','college_tvet') THEN
   IF NEW.academic_track_key IS NOT NULL THEN
     RAISE EXCEPTION 'school academic stream is not applicable';
   END IF;
 ELSE
   IF cardinality(NEW.subjects)>0 OR NEW.academic_track_key IS NOT NULL THEN
     RAISE EXCEPTION 'education stage must be saved first';
   END IF;
 END IF;
 RETURN NEW;
END;
$guard$;
DROP TRIGGER IF EXISTS trg_validate_school_enrollment_v38 ON public.student_profiles;
CREATE TRIGGER trg_validate_school_enrollment_v38
BEFORE INSERT OR UPDATE OF subjects,academic_track_key ON public.student_profiles
FOR EACH ROW EXECUTE FUNCTION private.validate_school_enrollment_v38();

-- No direct Data API write can reset enrollment, delete, or reinsert with a new stream.
REVOKE UPDATE (subjects) ON public.student_profiles FROM authenticated;
REVOKE INSERT,DELETE ON public.student_profiles FROM authenticated;

CREATE OR REPLACE FUNCTION public.set_my_academic_stream_v38(p_track_key text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $select_stream$
DECLARE
 v_uid uuid:=(SELECT auth.uid());
 v_profile public.profiles%rowtype;
 v_existing public.student_profiles%rowtype;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
 SELECT * INTO v_profile FROM public.profiles WHERE id=v_uid FOR UPDATE;
 IF NOT FOUND OR v_profile.role IS DISTINCT FROM 'student'::public.user_role
    OR v_profile.account_status <> 'active'
    OR NOT (v_profile.email_verified OR v_profile.phone_verified)
    OR v_profile.grade_level NOT IN (11,12)
    OR v_profile.education_stage_key IS DISTINCT FROM 'school_11_12' THEN
   RAISE EXCEPTION 'verified Grades 11–12 student profile required';
 END IF;
 IF p_track_key NOT IN ('natural_sciences','social_sciences') OR p_track_key IS NULL THEN
   RAISE EXCEPTION 'invalid academic stream';
 END IF;
 SELECT * INTO v_existing FROM public.student_profiles WHERE user_id=v_uid FOR UPDATE;
 IF FOUND AND v_existing.academic_track_key=p_track_key THEN RETURN p_track_key; END IF;
 IF v_profile.education_onboarding_completed OR
    (FOUND AND (v_existing.academic_track_key IS NOT NULL OR cardinality(v_existing.subjects)>0)) THEN
   RAISE EXCEPTION 'academic stream is locked; request verified MELA support for a correction';
 END IF;
 INSERT INTO public.student_profiles(user_id,academic_track_key)
 VALUES(v_uid,p_track_key)
 ON CONFLICT(user_id) DO UPDATE SET academic_track_key=EXCLUDED.academic_track_key,updated_at=now();
 RETURN p_track_key;
END;
$select_stream$;
REVOKE ALL ON FUNCTION public.set_my_academic_stream_v38(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_my_academic_stream_v38(text) TO authenticated;

CREATE OR REPLACE FUNCTION private.assert_mela_question_program_access(p_program_key text)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_profile public.profiles%rowtype;
  v_program public.mela_learning_programs%rowtype;
  v_subjects text[];
  v_track text;
begin
  if v_uid is null then raise exception 'authentication required'; end if;
  select * into v_program from public.mela_learning_programs
    where program_key=p_program_key and active;
  if not found then raise exception 'learning program not found'; end if;
  if private.is_admin_user() then return; end if;
  select * into v_profile from public.profiles
    where id=v_uid and account_status='active' and deleted_at is null;
  if not found or v_profile.role is distinct from 'student' then
    raise exception 'active learner access required';
  end if;
  if v_profile.education_stage_key is null
    or v_program.stage_key is distinct from v_profile.education_stage_key then
    raise exception 'program is not available for your education stage';
  end if;
  if v_program.program_kind='school_subject' then
    if v_profile.grade_level is null or v_profile.grade_level not between 1 and 12 then
      raise exception 'complete your school grade before practicing';
    end if;
    if v_program.grade_level is distinct from v_profile.grade_level then
      raise exception 'program is not available for your grade';
    end if;
    select s.subjects,s.academic_track_key into v_subjects,v_track from public.student_profiles s
      where s.user_id=v_uid;
    if coalesce(array_length(v_subjects,1),0)=0 then
      raise exception 'complete your enrolled school subjects before practicing';
    end if;
    if v_program.grade_level>=11 and v_program.track_key is distinct from v_track then
      raise exception 'subject is outside your locked academic stream';
    end if;
    if not (v_program.subject_key=any(v_subjects)) then
      raise exception 'subject is not in your enrolled curriculum';
    end if;
    if not exists(
      select 1 from public.mela_national_subject_catalog c
      where c.active and c.stage_key=v_program.stage_key
        and c.track_key=v_program.track_key and c.subject_key=v_program.subject_key
    ) then
      raise exception 'subject is not in the registered school curriculum';
    end if;
    if v_program.grade_level>=11 and exists(
      select 1 from public.mela_national_subject_catalog c
      where c.active and c.stage_key=v_program.stage_key
        and c.track_key=v_program.track_key and c.optional=false
        and not(c.subject_key=any(v_subjects))
    ) then
      raise exception 'subject is not in your enrolled academic stream';
    end if;
  elsif v_program.grade_level is not null
    and v_program.grade_level is distinct from v_profile.grade_level then
      raise exception 'program is not available for your grade';
  end if;
end $function$;
CREATE OR REPLACE FUNCTION private.mela_school_enrolled_program_allowed(p_program_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
SELECT private.is_admin_user() OR EXISTS (
 SELECT 1 FROM public.mela_learning_programs p
 JOIN public.profiles pr ON pr.id=(SELECT auth.uid())
 JOIN public.student_profiles st ON st.user_id=pr.id
 WHERE p.program_key=p_program_key AND p.active AND p.program_kind='school_subject'
  AND pr.role='student' AND pr.account_status='active' AND pr.deleted_at IS NULL
  AND p.stage_key=pr.education_stage_key AND p.grade_level=pr.grade_level
  AND pr.grade_level BETWEEN 1 AND 12
  AND p.subject_key=ANY(st.subjects)
  AND (p.grade_level<11 OR st.academic_track_key=p.track_key)
  AND EXISTS(SELECT 1 FROM public.mela_national_subject_catalog cat
    WHERE cat.active AND cat.stage_key=p.stage_key AND cat.track_key=p.track_key AND cat.subject_key=p.subject_key)
  AND (p.grade_level<11 OR NOT EXISTS(
    SELECT 1 FROM public.mela_national_subject_catalog required
    WHERE required.active AND required.stage_key=p.stage_key AND required.track_key=p.track_key
      AND required.optional=false AND NOT(required.subject_key=ANY(st.subjects))))
)
$function$;
