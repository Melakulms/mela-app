CREATE OR REPLACE FUNCTION private.validate_school_enrollment_v38()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
     -- complete_my_profile_v37 uses INSERT ... ON CONFLICT UPDATE. Its BEFORE INSERT
     -- trigger fires before conflict handling, so use the already locked stream.
     IF TG_OP='INSERT' AND NEW.academic_track_key IS NULL THEN
       SELECT st.academic_track_key INTO v_track FROM public.student_profiles st
         WHERE st.user_id=NEW.user_id;
       IF v_track IN ('natural_sciences','social_sciences') THEN
         NEW.academic_track_key:=v_track;
       END IF;
     END IF;
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
$function$;