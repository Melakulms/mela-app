# AI lessons and complete teacher review installation

Live project: duizgtmbptmlbyipreqg. Source lesson pack: MELA-AI-Courses-Teacher-Pack.zip, version 1.0.0, prepared 11 October 2026.

Installed 318 original English draft lesson units for all 53 existing courses in public.mela_ai_course_lessons. Existing course_lessons, enrollments and progress are preserved. The prepared reader does not confer course completion or certificates. Teacher keys are in private.mela_ai_lesson_answer_keys and never committed to this public frontend repository.

The live question bank contains 142,396 questions. Before the change, 1,012 review batches covered 84,296 unique questions. Added 630 batches for 58,100 missing questions without modifying existing batch IDs or reviews. All 142,396 questions are now covered exactly once in 1,642 batches. The new v19 queue has keyset pagination and grade, subject and status filters. Existing v18 reads remain compatible. Approval now requires a teacher-test and verification note server-side; all future decisions also have append-only private history.

No teacher profiles or approved teacher reviewers existed at installation time. No questions or lessons were automatically approved. Teacher registration and administrator qualification verification remain necessary. AI course assignments are separately granted per course by an MFA-protected super administrator and checked again on every key-read and save.

Learner navigation: Skill Academy → course → Read 6 prepared lessons.
Teacher navigation: Teacher dashboard → Educator content review → Question reviews. AI course lesson review is a separate section.
Admin navigation: Moderation → Teacher reviewer verification → Approved → Review teacher → AI course reviewer assignments.

Validation: live installed counts and private-key count match; all question IDs have batch coverage. SQL checks deny anonymous access and unqualified/unassigned review access. Administrator-context SQL checks cover exact queue counts, non-overlapping pages, end-of-queue and grade filtering. These transactional checks do not substitute for a real signed-in teacher session. Security advisors show no newly exposed public SECURITY DEFINER functions; the private tables intentionally have no client policies. Existing unrelated advisor warnings remain outside this installation.

The data import was performed in 14 bounded transactions matching existing course slugs, using insert-on-conflict-do-nothing. The original teacher package is the content backup. Do not place its private keys in a public frontend or repository. Applied migration filenames match the actual live migration history.
