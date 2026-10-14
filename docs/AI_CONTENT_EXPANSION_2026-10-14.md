# AI course content expansion — 14 October 2026

This revision adds course-specific explanations, terminology, methods, worked calculations, practice feedback and project deliverables to all 318 existing English draft lessons across 53 courses. It adds approximately 19,800 words, including shared offline-study and submission instructions. Counts do not imply educator approval.

Existing lesson IDs, original teaching text, assessment prompts, private teacher answer keys, enrollment records and completion rules are preserved. Only content_text and content_version change. All target lessons must remain draft, unreviewed and unchanged from their captured content checksum; otherwise the entire transaction rolls back. Previously reviewed material must never be overwritten with this script.

## Install and rollback

Run `python3 scripts/ai_content_revision.py > /tmp/mela-ai-install.sql`, inspect it, then execute through an authorized connection to the MELA project. Use `--rollback` to generate the reverse transaction. Do not run generated SQL against an unrelated project.

Both operations require exactly 318 matching records and abort on any mismatch. They are intentionally not silently repeatable: an already applied revision requires investigation, not a forced overwrite. Rollback also refuses reviewed or subsequently modified lessons.

The JSON contains learner-facing additions only. Formative feedback is deliberately visible; private summative teacher keys are not included. Learners use Skill Academy → their course → Read 6 prepared lessons. The existing reader loads content_text from Supabase, so this data-only revision needs no frontend redeployment.

## Validation and limits

- Coverage: 53 exact existing course slugs, six unique lesson positions each, 318 unique lesson keys.
- Python reference example: normal inputs, zero, empty list, booleans, strings, out-of-range, missing and non-finite values checked.
- Installation must be followed by database checks for version, exact content and active-reader RLS visibility.
- The six-lesson packs are introductory study drafts, not complete year-long professional qualifications. The separate 52-week shared foundation remains a draft.
- English only. Teacher review, native-language translation review and professional curriculum expansion remain necessary.
- No certification, teacher approval, payments, learner completion or private review data is changed.

## Verified live installation

Installed version 1.1.0 in the configured MELA project on 14 October 2026.
Read back every learner lesson and compared it exactly with its original text plus the authored addition: 318 matches, zero mismatches.
All 318 remain draft; 53 distinct courses are covered.
A transaction using the authenticated database role and an existing active profile's subject claim could read all 318 revised lessons. The catalog RPC returned 53 courses, each with six prepared lessons.
This is a database-role access test, not a real signed-in Android/browser acceptance test.
The standard-library Python reference example passed all included normal and invalid-input checks.
No frontend code or database access policy changed in this revision.
