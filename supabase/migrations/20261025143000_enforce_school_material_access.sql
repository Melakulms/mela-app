-- School material RPCs must honor the registered student grade, subjects, and academic stream.

-- Mirrors the grade entitlement checks used for question sessions; no payments are activated.

CREATE OR REPLACE FUNCTION private.mela_school_enrolled_program_allowed(p_program_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $mela_enrollment$
SELECT private.is_admin_user() OR EXISTS (
 SELECT 1 FROM public.mela_learning_programs p
 JOIN public.profiles pr ON pr.id=(SELECT auth.uid())
 JOIN public.student_profiles st ON st.user_id=pr.id
 WHERE p.program_key=p_program_key AND p.active AND p.program_kind='school_subject'
  AND pr.role='student' AND pr.account_status='active' AND pr.deleted_at IS NULL
  AND p.stage_key=pr.education_stage_key AND p.grade_level=pr.grade_level
  AND pr.grade_level BETWEEN 1 AND 12
  AND p.subject_key=ANY(st.subjects)
  AND EXISTS(SELECT 1 FROM public.mela_national_subject_catalog cat
    WHERE cat.active AND cat.stage_key=p.stage_key AND cat.track_key=p.track_key AND cat.subject_key=p.subject_key)
  AND (p.grade_level<11 OR NOT EXISTS(
    SELECT 1 FROM public.mela_national_subject_catalog required
    WHERE required.active AND required.stage_key=p.stage_key AND required.track_key=p.track_key
      AND required.optional=false AND NOT(required.subject_key=ANY(st.subjects))))
)
$mela_enrollment$;
REVOKE EXECUTE ON FUNCTION private.mela_school_enrolled_program_allowed(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.mela_school_enrolled_program_allowed(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_mela_learning_library(p_stage_key text, p_grade_level smallint DEFAULT NULL::smallint, p_track_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select jsonb_build_object(
  'stage_key',p_stage_key,
  'grade_level',p_grade_level,
  'track_key',p_track_key,
  'programs',coalesce((
    select jsonb_agg(jsonb_build_object(
      'program_key',p.program_key,'subject_key',p.subject_key,'subject_title',p.subject_title,'title',p.title,'description',p.description,
      'program_kind',p.program_kind,'track_key',p.track_key,'grade_level',p.grade_level,'optional',p.optional,'official_alignment_status',p.official_alignment_status,
      'units',coalesce((select jsonb_agg(jsonb_build_object(
        'id',u.id,'unit_number',u.unit_number,'title',u.title,'description',u.description,'learning_outcomes',u.learning_outcomes,'estimated_hours',u.estimated_hours,
        'materials',coalesce((select jsonb_agg(jsonb_build_object(
          'material_key',m.material_key,'material_type',m.material_type,'title',m.title,'summary',m.summary,'pedagogical_role',m.pedagogical_role,
          'access_tier',m.access_tier,'product_key',m.product_key,'estimated_minutes',m.estimated_minutes,'downloadable',m.downloadable,'low_bandwidth_ready',m.low_bandwidth_ready,
          'can_access',case
            when m.access_tier='free' then true
            when (select auth.uid()) is null then false
            when m.access_tier='subscription' then exists(
              select 1 from public.mela_user_learning_entitlements e join public.mela_learning_products pr on pr.product_key=e.product_key
              where e.user_id=(select auth.uid()) and e.status='active' and pr.product_type in ('subscription','institution') and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())
            ) or private.is_admin_user()
            when m.access_tier='one_time' then exists(
              select 1 from public.mela_user_learning_entitlements e where e.user_id=(select auth.uid()) and e.status='active' and e.product_key=m.product_key and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())
            ) or private.is_admin_user()
            else false end
        ) order by m.display_order,m.title) from public.mela_learning_materials m where m.unit_id=u.id and m.status='published'),'[]'::jsonb)
      ) order by u.unit_number) from public.mela_learning_units u where u.program_key=p.program_key and u.status='published'),'[]'::jsonb)
    ) order by p.display_order,p.title)
    from public.mela_learning_programs p
    where p.active and p.stage_key=p_stage_key
      and (p_grade_level is null or p.grade_level=p_grade_level)
      and (p_track_key is null or p.track_key=p_track_key)
      and (p.program_kind is distinct from 'school_subject' or private.mela_school_enrolled_program_allowed(p.program_key))
  ),'[]'::jsonb),
  'products',coalesce((select jsonb_agg(jsonb_build_object(
    'product_key',x.product_key,'product_name',x.product_name,'product_type',x.product_type,'billing_period',x.billing_period,
    'recommended_price_minor',x.recommended_price_minor,'active_price_minor',x.active_price_minor,'currency',x.currency,'description',x.description,
    'features',x.features,'sale_enabled',x.sale_enabled
  ) order by x.display_order) from public.mela_learning_products x where x.active and (cardinality(x.audience_stage_keys)=0 or p_stage_key=any(x.audience_stage_keys))),'[]'::jsonb)
);
$function$;

CREATE OR REPLACE FUNCTION public.get_mela_learning_material(p_material_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_m public.mela_learning_materials%rowtype; v_u public.mela_learning_units%rowtype; v_p public.mela_learning_programs%rowtype; v_c public.mela_learning_material_content%rowtype; v_uid uuid := (select auth.uid()); v_allowed boolean := false; begin select * into v_m from public.mela_learning_materials where material_key=p_material_key and status='published'; if v_m.id is null then raise exception 'learning material not found'; end if; select * into v_u from public.mela_learning_units where id=v_m.unit_id and status='published'; select * into v_p from public.mela_learning_programs where program_key=v_u.program_key; if v_p.program_kind='school_subject' and not private.mela_school_enrolled_program_allowed(v_p.program_key) then raise exception 'material is not in your registered grade and enrolled subjects'; end if; if v_m.access_tier='free' then v_allowed:=true; elsif v_uid is not null and private.is_admin_user() then v_allowed:=true; elsif v_uid is not null and v_m.access_tier='subscription' then v_allowed:=exists(select 1 from public.mela_user_learning_entitlements e join public.mela_learning_products pr on pr.product_key=e.product_key where e.user_id=v_uid and e.status='active' and pr.product_type in ('subscription','institution') and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())); elsif v_uid is not null and v_m.access_tier='one_time' then v_allowed:=exists(select 1 from public.mela_user_learning_entitlements e where e.user_id=v_uid and e.status='active' and e.product_key=v_m.product_key and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())); end if; if not v_allowed then return jsonb_build_object('material_key',v_m.material_key,'title',v_m.title,'summary',v_m.summary,'material_type',v_m.material_type,'access_tier',v_m.access_tier,'product_key',v_m.product_key,'subject_title',v_p.subject_title,'grade_level',v_p.grade_level,'stage_key',v_p.stage_key,'track_key',v_p.track_key,'program_title',v_p.title,'unit_title',v_u.title,'official_alignment_status',v_u.official_alignment_status,'locked',true); end if; select * into v_c from public.mela_learning_material_content where material_id=v_m.id; return jsonb_build_object('material_key',v_m.material_key,'title',v_m.title,'summary',v_m.summary,'material_type',v_m.material_type,'access_tier',v_m.access_tier,'product_key',v_m.product_key,'subject_title',v_p.subject_title,'grade_level',v_p.grade_level,'stage_key',v_p.stage_key,'track_key',v_p.track_key,'program_title',v_p.title,'unit_title',v_u.title,'official_alignment_status',v_u.official_alignment_status,'content_markdown',v_c.content_markdown,'answer_key',v_c.answer_key,'locked',false); end $function$;

CREATE OR REPLACE FUNCTION public.get_mela_chapter_material(p_material_key text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
select jsonb_build_object(
 'material_key',m.material_key,'title',m.title,'summary',m.summary,'material_type',m.material_type,'access_tier',m.access_tier,'product_key',m.product_key,
 'subject_title',p.subject_title,'grade_level',p.grade_level,'stage_key',p.stage_key,'track_key',p.track_key,'program_title',p.title,
 'chapter_key',c.chapter_key,'chapter_number',c.chapter_number,'chapter_title',c.title,'chapter_title_local',c.title_local,
 'official_alignment_status',c.official_alignment_status,'source_name',c.source_name,'source_url',c.source_url,'source_kind',c.source_kind,'source_verified',c.source_verified,
 'content_markdown',mc.content_markdown,'answer_key','[]'::jsonb,'locked',mc.material_id is null
)
from public.mela_learning_chapter_materials m
join public.mela_learning_chapters c on c.id=m.chapter_id
join public.mela_learning_programs p on p.program_key=c.program_key
left join public.mela_learning_chapter_material_content mc on mc.material_id=m.id
where m.material_key=p_material_key and m.status='published'
 and (p.program_kind is distinct from 'school_subject' or private.mela_school_enrolled_program_allowed(p.program_key));
$function$;