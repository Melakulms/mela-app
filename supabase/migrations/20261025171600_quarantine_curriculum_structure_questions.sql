-- Quarantine only old curriculum-structure recall question generations.
-- Those questions ask about chapter numbers, names and topic mappings rather
-- than the subject skills being studied. Keep records for editorial audit.
-- Applied to production on 2026-10-25 after verifying all v11/v12 questions
-- and counting affected rows. Idempotent for staged schema imports.
update public.mela_question_bank
set active=false, updated_at=now()
where active=true and generation_version in ('v11','v12');
