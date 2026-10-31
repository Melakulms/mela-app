DO $check$
BEGIN
  IF to_regclass('public.mentorship_resources') IS NULL THEN
    RAISE EXCEPTION 'Mentorship guidance table is missing';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.mentorship_resources'::regclass) THEN
    RAISE EXCEPTION 'Mentorship guidance lacks row-level security';
  END IF;
  IF has_table_privilege('anon','public.mentorship_resources','SELECT') THEN
    RAISE EXCEPTION 'Anonymous users can query unpublished resources';
  END IF;
  IF NOT has_table_privilege('authenticated','public.mentorship_resources','SELECT')
    OR has_table_privilege('authenticated','public.mentorship_resources','INSERT')
    OR has_table_privilege('authenticated','public.mentorship_resources','UPDATE')
    OR has_table_privilege('authenticated','public.mentorship_resources','DELETE') THEN
    RAISE EXCEPTION 'Resource grants are unexpectedly broad or missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='mentorship_resources'
      AND policyname='mentorship_resources_published_read' AND cmd='SELECT'
      AND qual LIKE '%published%') THEN
    RAISE EXCEPTION 'Published-only RLS policy missing';
  END IF;
  IF (SELECT count(*) FROM public.mentorship_resources WHERE status='published') <> 6 THEN
    RAISE EXCEPTION 'Expected six original safety and career guidance materials';
  END IF;
END;
$check$;
