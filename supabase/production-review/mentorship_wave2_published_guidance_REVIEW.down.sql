-- Non-destructive production rollback: withdraw all authenticated access
-- while retaining seeded and subsequently edited materials for export/review.
-- Do NOT drop mentorship_resources or delete content automatically.
REVOKE SELECT ON public.mentorship_resources FROM authenticated;
DROP POLICY IF EXISTS mentorship_resources_published_read ON public.mentorship_resources;
SELECT has_table_privilege('authenticated','public.mentorship_resources','SELECT')
  AS authenticated_still_has_select;
