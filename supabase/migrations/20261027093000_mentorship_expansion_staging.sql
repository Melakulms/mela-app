-- MELA mentorship expansion: STAGING-first, no payment or video activation.
-- Requires the pre-existing profiles, mentor_profiles and mentorship_requests tables.
-- All records are private unless explicitly marked as a published resource or program.

create table if not exists public.mentorship_goals (
 id uuid primary key default extensions.gen_random_uuid(),
 learner_id uuid not null references public.profiles(id) on delete cascade,
 title text not null check (char_length(btrim(title)) between 3 and 160),
 detail text not null default '' check (char_length(detail) <= 2000),
 status text not null default 'planned' check (status in ('planned','in_progress','completed','paused')),
 target_date date,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists mentorship_goals_learner_idx on public.mentorship_goals(learner_id, created_at desc);
alter table public.mentorship_goals enable row level security;
create policy mentorship_goals_learner_read on public.mentorship_goals for select to authenticated
 using (learner_id = (select auth.uid()));
create policy mentorship_goals_learner_insert on public.mentorship_goals for insert to authenticated
 with check (learner_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id=learner_id and p.role='student' and p.deleted_at is null));
create policy mentorship_goals_learner_update on public.mentorship_goals for update to authenticated
 using (learner_id = (select auth.uid()))
 with check (learner_id = (select auth.uid()));
create policy mentorship_goals_learner_delete on public.mentorship_goals for delete to authenticated
 using (learner_id = (select auth.uid()));
revoke all on public.mentorship_goals from anon, authenticated;
grant select,insert,update,delete on public.mentorship_goals to authenticated;

create table if not exists public.mentorship_assignments (
 id uuid primary key default extensions.gen_random_uuid(),
 request_id uuid not null references public.mentorship_requests(id) on delete cascade,
 mentor_id uuid not null references public.mentor_profiles(user_id),
 learner_id uuid not null references public.profiles(id) on delete cascade,
 title text not null check (char_length(btrim(title)) between 3 and 160),
 instructions text not null check (char_length(btrim(instructions)) between 10 and 4000),
 due_at timestamptz,
 created_at timestamptz not null default now(),
 unique(id, mentor_id, learner_id)
);
create index if not exists mentorship_assignments_learner_idx on public.mentorship_assignments(learner_id,created_at desc);
create index if not exists mentorship_assignments_mentor_idx on public.mentorship_assignments(mentor_id,created_at desc);
alter table public.mentorship_assignments enable row level security;
create policy mentorship_assignments_participant_read on public.mentorship_assignments for select to authenticated
 using (mentor_id=(select auth.uid()) or learner_id=(select auth.uid()));
create policy mentorship_assignments_verified_mentor_insert on public.mentorship_assignments for insert to authenticated
 with check (
 mentor_id=(select auth.uid())
 and exists(select 1 from public.mentor_profiles m where m.user_id=mentor_id and m.verified and m.active)
 and exists(select 1 from public.mentorship_requests r where r.id=request_id and r.mentor_id=mentor_id and r.mentee_id=learner_id and r.status='accepted')
 and exists(select 1 from public.profiles p where p.id=learner_id and p.role='student' and p.deleted_at is null and p.account_status='active'
   and coalesce(p.education_stage_key,'') not in ('school_1_6','school_7_8','school_9_10'))
 );
revoke all on public.mentorship_assignments from anon,authenticated;
grant select,insert on public.mentorship_assignments to authenticated;

create table if not exists public.mentorship_submissions (
 id uuid primary key default extensions.gen_random_uuid(),
 assignment_id uuid not null references public.mentorship_assignments(id) on delete cascade,
 learner_id uuid not null references public.profiles(id) on delete cascade,
 response text not null check (char_length(btrim(response)) between 2 and 4000),
 created_at timestamptz not null default now(),
 unique(assignment_id,learner_id)
);
create index if not exists mentorship_submissions_assignment_idx on public.mentorship_submissions(assignment_id);
alter table public.mentorship_submissions enable row level security;
create policy mentorship_submissions_participant_read on public.mentorship_submissions for select to authenticated
 using (learner_id=(select auth.uid()) or exists (select 1 from public.mentorship_assignments a where a.id=assignment_id and a.mentor_id=(select auth.uid())));
create policy mentorship_submissions_assigned_learner_insert on public.mentorship_submissions for insert to authenticated
 with check (learner_id=(select auth.uid())
 and exists (select 1 from public.mentorship_assignments a where a.id=assignment_id and a.learner_id=learner_id)
 and exists (select 1 from public.mentorship_assignments a join public.mentorship_requests r on r.id=a.request_id
  where a.id=assignment_id and r.status='accepted'));
revoke all on public.mentorship_submissions from anon,authenticated;
grant select,insert on public.mentorship_submissions to authenticated;

create table if not exists public.mentorship_feedback (
 id uuid primary key default extensions.gen_random_uuid(),
 assignment_id uuid not null unique references public.mentorship_assignments(id) on delete cascade,
 mentor_id uuid not null references public.mentor_profiles(user_id),
 feedback text not null check (char_length(btrim(feedback)) between 2 and 4000),
 created_at timestamptz not null default now()
);
alter table public.mentorship_feedback enable row level security;
create policy mentorship_feedback_participant_read on public.mentorship_feedback for select to authenticated
 using (mentor_id=(select auth.uid()) or exists (select 1 from public.mentorship_assignments a where a.id=assignment_id and a.learner_id=(select auth.uid())));
create policy mentorship_feedback_verified_mentor_insert on public.mentorship_feedback for insert to authenticated
 with check (mentor_id=(select auth.uid())
 and exists(select 1 from public.mentor_profiles m where m.user_id=mentor_id and m.verified and m.active)
 and exists(select 1 from public.mentorship_assignments a where a.id=assignment_id and a.mentor_id=mentor_id)
 and exists(select 1 from public.mentorship_submissions s where s.assignment_id=assignment_id));
revoke all on public.mentorship_feedback from anon,authenticated;
grant select,insert on public.mentorship_feedback to authenticated;

create table if not exists public.mentorship_resources (
 id uuid primary key default extensions.gen_random_uuid(),
 title text not null check (char_length(btrim(title)) between 3 and 160),
 category text not null,
 description text not null default '',
 content text not null default '',
 status text not null default 'draft' check (status in ('draft','published','archived')),
 created_at timestamptz not null default now()
);
alter table public.mentorship_resources enable row level security;
create policy mentorship_resources_published_read on public.mentorship_resources for select to authenticated
 using (status='published');
revoke all on public.mentorship_resources from anon,authenticated;
grant select on public.mentorship_resources to authenticated;

create table if not exists public.mentorship_groups (
 id uuid primary key default extensions.gen_random_uuid(),
 title text not null check (char_length(btrim(title)) between 3 and 160),
 description text not null default '',
 category text not null,
 mentor_id uuid not null references public.mentor_profiles(user_id),
 starts_at timestamptz,
 capacity integer not null default 20 check(capacity between 2 and 200),
 status text not null default 'draft' check (status in ('draft','published','closed')),
 created_at timestamptz not null default now()
);
alter table public.mentorship_groups enable row level security;
create policy mentorship_groups_verified_published_read on public.mentorship_groups for select to authenticated
 using (status='published' and exists (select 1 from public.mentor_profiles m where m.user_id=mentor_id and m.verified and m.active));
revoke all on public.mentorship_groups from anon,authenticated;
grant select on public.mentorship_groups to authenticated;

-- Original, self-contained learning guidance; no fabricated mentor listings, events, or certificates.
insert into public.mentorship_resources(title,category,description,content,status) values
 ('Prepare for your first mentorship session','preparation',
  'Get ready to make your mentor meeting productive.',
  'Choose one specific goal. Write three questions. Explain what you have already tried. Ask for one practical next step. Never share passwords, payment credentials, PINs or private identity documents.', 'published'),
 ('Career exploration checklist','career',
  'A structured guide to exploring careers.',
  'Identify three career fields. List the skills each needs. Review education pathways, entry requirements and local opportunities. Note two realistic actions for the next month.', 'published'),
 ('Scholarship application preparation','scholarships',
  'Organize your scholarship research and application work.',
  'Check the scholarship source and eligibility. Create a deadline checklist. Prepare your academic documents privately. Draft a motivation letter in your own words. Never send confidential documents directly to strangers.', 'published'),
 ('Project and portfolio review','technology',
  'Use constructive feedback to improve your project.',
  'Describe the problem, users, your contribution, and what you built. Demonstrate working results. Ask for three prioritized improvements. Record next steps in your learning plan.', 'published'),
 ('Study planning for examinations','academic',
  'Build a realistic study plan without overload.',
  'List subjects and target topics. Set a weekly study routine with breaks. Practice with questions and review mistakes. Share progress with your educator or approved guardian where appropriate.', 'published'),
 ('Mentorship safety and boundaries','safety',
  'Learn how to participate in a respectful, safe program.',
  'Stay inside approved MELA communication pathways. Do not share OTPs, addresses, money or personal documents. Report inappropriate contact promptly through the Safety Center. Children must follow guardian and school safeguarding rules.', 'published')
on conflict do nothing;
