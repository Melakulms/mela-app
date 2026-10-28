# Grade 1 English staging lesson-body pilot — 2026-10-25

This data-only migration adds five complete, independently written MELA-supplemental lessons to the **existing staging-only** program `staging_g1_english_pilot`. It does not include Claude's original draft files; they were not available to this session. It does not insert or change 40 previously staged practice questions.

Lessons: Greetings; Parts of the Body; Colours; Counting (English number words); Objects That We Have.

Each draft includes objectives, a teacher-led model, guided practice, independent practice, answer guidance, age-sensitive teaching notes, and source-status cautions.

**Important limits**
- The cited Grade 1 Ethiopian English book's unit titles were reported, but its pages, vocabulary, exercises and edition have **not** been independently read in this session. This is original supplementary draft material, **not approved or officially mapped**.
- The material has `status='draft'`, `editorial_status='mela_supplemental'`, and metadata `teacher_review_required=true`; public RLS only exposes `published`.
- Staging-only seed program and five chapters **must already exist**. The prior 40 question rows, grading and answer-key data are not included here because Claude's source files are unavailable; those separate seed files remain necessary for a portable full pilot.
- The migration is additive/idempotent; it does not overwrite an existing material key or content and does not run on production without an explicit separate decision.
- Teacher sign-off, textbook comparison, actual Auth/browser testing and any production integration are out of scope.

**Verification queries (staging only):**

```sql
select count(distinct m.id) material_count,
       count(c.material_id) bodies_count,
       bool_and(m.status='draft') all_draft
from public.mela_learning_chapter_materials m
join public.mela_learning_chapters ch on ch.id=m.chapter_id
left join public.mela_learning_chapter_material_content c on c.material_id=m.id
where ch.program_key='staging_g1_english_pilot';
```

Do not merge, publish, or approve without qualified teacher comparison against the complete corresponding textbook pages.