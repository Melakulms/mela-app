-- Cover the composite curriculum foreign keys for chapter/topic maintenance.
create index if not exists mela_question_chapter_program_fk_idx
  on public.mela_question_bank(chapter_id,program_key);
create index if not exists mela_question_topic_chapter_fk_idx
  on public.mela_question_bank(topic_id,chapter_id);
