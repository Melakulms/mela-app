-- PRODUCTION WAVE 2 CANDIDATE: public non-personal educational guidance only.
-- No mentorship sessions, payments, direct messages, or personal data changes.
-- Isolated for review from PR #96's much larger staging foundation migration.
DO $preflight$
BEGIN
  IF to_regclass('public.mentorship_resources') IS NOT NULL THEN
    RAISE EXCEPTION 'Resources table already exists; review existing records first';
  END IF;
END;
$preflight$;

CREATE TABLE public.mentorship_resources (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 160),
  category text NOT NULL,
  description text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','published','archived')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX mentorship_resources_title_unique
  ON public.mentorship_resources (title);
ALTER TABLE public.mentorship_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY mentorship_resources_published_read ON public.mentorship_resources
  FOR SELECT TO authenticated USING (status='published');
REVOKE ALL ON public.mentorship_resources FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.mentorship_resources TO authenticated;

INSERT INTO public.mentorship_resources(title,category,description,content,status) VALUES
('Prepare for your first mentorship session','preparation',
 'Get ready to make your mentor meeting productive.',
 'Choose one specific goal. Write three questions. Explain what you have already tried. Ask for one practical next step. Never share passwords, payment credentials, PINs or private identity documents.','published'),
('Career exploration checklist','career',
 'A structured guide to exploring careers.',
 'Identify three career fields. List the skills each needs. Review education pathways, entry requirements and local opportunities. Note two realistic actions for the next month.','published'),
('Scholarship application preparation','scholarships',
 'Organize your scholarship research and application work.',
 'Check the scholarship source and eligibility. Create a deadline checklist. Prepare your academic documents privately. Draft a motivation letter in your own words. Never send confidential documents directly to strangers.','published'),
('Project and portfolio review','technology',
 'Use constructive feedback to improve your project.',
 'Describe the problem, users, your contribution, and what you built. Demonstrate working results. Ask for three prioritized improvements. Record next steps in your learning plan.','published'),
('Study planning for examinations','academic',
 'Build a realistic study plan without overload.',
 'List subjects and target topics. Set a weekly study routine with breaks. Practice with questions and review mistakes. Share progress with your educator or approved guardian where appropriate.','published'),
('Mentorship safety and boundaries','safety',
 'Learn how to participate in a respectful, safe program.',
 'Stay inside approved MELA communication pathways. Do not share OTPs, addresses, money or personal documents. Report inappropriate contact promptly through the Safety Center. Children must follow guardian and school safeguarding rules.','published');
