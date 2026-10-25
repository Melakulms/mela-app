-- Preserve existing paid-entitlement row access, and restrict enrolled school curriculum resources.

ALTER POLICY mela_learning_chapter_content_authenticated ON public.mela_learning_chapter_material_content USING (((private.is_admin_user() OR (EXISTS ( SELECT 1
   FROM mela_learning_chapter_materials m
  WHERE ((m.id = mela_learning_chapter_material_content.material_id) AND (m.status = 'published'::text) AND ((m.access_tier = 'free'::text) OR ((m.access_tier = 'subscription'::text) AND (EXISTS ( SELECT 1
           FROM (mela_user_learning_entitlements e
             JOIN mela_learning_products p ON ((p.product_key = e.product_key)))
          WHERE ((e.user_id = ( SELECT auth.uid() AS uid)) AND (e.status = 'active'::text) AND (p.product_type = ANY (ARRAY['subscription'::text, 'institution'::text])) AND (e.starts_at <= now()) AND ((e.ends_at IS NULL) OR (e.ends_at > now())))))) OR ((m.access_tier = 'one_time'::text) AND (EXISTS ( SELECT 1
           FROM mela_user_learning_entitlements e
          WHERE ((e.user_id = ( SELECT auth.uid() AS uid)) AND (e.status = 'active'::text) AND (e.product_key = m.product_key) AND (e.starts_at <= now()) AND ((e.ends_at IS NULL) OR (e.ends_at > now())))))))))))) AND (EXISTS (SELECT 1 FROM public.mela_learning_chapter_materials mm JOIN public.mela_learning_chapters c ON c.id=mm.chapter_id JOIN public.mela_learning_programs p ON p.program_key=c.program_key WHERE mm.id=mela_learning_chapter_material_content.material_id AND (p.program_kind IS DISTINCT FROM 'school_subject' OR private.mela_school_enrolled_program_allowed(p.program_key)))));

ALTER POLICY mela_learning_chapter_materials_authenticated_read ON public.mela_learning_chapter_materials USING (((private.is_admin_user() OR ((status = 'published'::text) AND ((access_tier = 'free'::text) OR ((access_tier = 'subscription'::text) AND (EXISTS ( SELECT 1
   FROM (mela_user_learning_entitlements e
     JOIN mela_learning_products p ON ((p.product_key = e.product_key)))
  WHERE ((e.user_id = ( SELECT auth.uid() AS uid)) AND (e.status = 'active'::text) AND (p.product_type = ANY (ARRAY['subscription'::text, 'institution'::text])) AND (e.starts_at <= now()) AND ((e.ends_at IS NULL) OR (e.ends_at > now())))))) OR ((access_tier = 'one_time'::text) AND (EXISTS ( SELECT 1
   FROM mela_user_learning_entitlements e
  WHERE ((e.user_id = ( SELECT auth.uid() AS uid)) AND (e.status = 'active'::text) AND (e.product_key = mela_learning_chapter_materials.product_key) AND (e.starts_at <= now()) AND ((e.ends_at IS NULL) OR (e.ends_at > now())))))))))) AND (EXISTS (SELECT 1 FROM public.mela_learning_chapters c JOIN public.mela_learning_programs p ON p.program_key=c.program_key WHERE c.id=mela_learning_chapter_materials.chapter_id AND (p.program_kind IS DISTINCT FROM 'school_subject' OR private.mela_school_enrolled_program_allowed(p.program_key)))));

ALTER POLICY mela_learning_material_content_authenticated ON public.mela_learning_material_content USING (((private.is_admin_user() OR (EXISTS ( SELECT 1
   FROM mela_learning_materials m
  WHERE ((m.id = mela_learning_material_content.material_id) AND (m.status = 'published'::text) AND ((m.access_tier = 'free'::text) OR ((m.access_tier = 'subscription'::text) AND (EXISTS ( SELECT 1
           FROM (mela_user_learning_entitlements e
             JOIN mela_learning_products p ON ((p.product_key = e.product_key)))
          WHERE ((e.user_id = ( SELECT auth.uid() AS uid)) AND (e.status = 'active'::text) AND (p.product_type = ANY (ARRAY['subscription'::text, 'institution'::text])) AND (e.starts_at <= now()) AND ((e.ends_at IS NULL) OR (e.ends_at > now())))))) OR ((m.access_tier = 'one_time'::text) AND (EXISTS ( SELECT 1
           FROM mela_user_learning_entitlements e
          WHERE ((e.user_id = ( SELECT auth.uid() AS uid)) AND (e.status = 'active'::text) AND (e.product_key = m.product_key) AND (e.starts_at <= now()) AND ((e.ends_at IS NULL) OR (e.ends_at > now())))))))))))) AND (EXISTS (SELECT 1 FROM public.mela_learning_materials mm JOIN public.mela_learning_units u ON u.id=mm.unit_id JOIN public.mela_learning_programs p ON p.program_key=u.program_key WHERE mm.id=mela_learning_material_content.material_id AND (p.program_kind IS DISTINCT FROM 'school_subject' OR private.mela_school_enrolled_program_allowed(p.program_key)))));

ALTER POLICY mela_learning_materials_authenticated_read ON public.mela_learning_materials USING (((private.is_admin_user() OR ((status = 'published'::text) AND ((access_tier = 'free'::text) OR ((access_tier = 'subscription'::text) AND (EXISTS ( SELECT 1
   FROM (mela_user_learning_entitlements e
     JOIN mela_learning_products p ON ((p.product_key = e.product_key)))
  WHERE ((e.user_id = ( SELECT auth.uid() AS uid)) AND (e.status = 'active'::text) AND (p.product_type = ANY (ARRAY['subscription'::text, 'institution'::text])) AND (e.starts_at <= now()) AND ((e.ends_at IS NULL) OR (e.ends_at > now())))))) OR ((access_tier = 'one_time'::text) AND (EXISTS ( SELECT 1
   FROM mela_user_learning_entitlements e
  WHERE ((e.user_id = ( SELECT auth.uid() AS uid)) AND (e.status = 'active'::text) AND (e.product_key = mela_learning_materials.product_key) AND (e.starts_at <= now()) AND ((e.ends_at IS NULL) OR (e.ends_at > now())))))))))) AND (EXISTS (SELECT 1 FROM public.mela_learning_units u JOIN public.mela_learning_programs p ON p.program_key=u.program_key WHERE u.id=mela_learning_materials.unit_id AND (p.program_kind IS DISTINCT FROM 'school_subject' OR private.mela_school_enrolled_program_allowed(p.program_key)))));

GRANT SELECT ON public.mela_learning_chapter_material_content TO authenticated;