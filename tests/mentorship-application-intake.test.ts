// @vitest-environment node
import {readFileSync} from 'node:fs'
import {expect,it} from 'vitest'

const sql=readFileSync(new URL('../supabase/migrations/20261102170000_restore_secure_mentorship_applications.sql',import.meta.url),'utf8')

it('keeps staging adult/MFA reviews intact and makes production applications owner-scoped',()=>{
  expect(sql).toContain("if to_regclass('public.mentorship_applications') is null then")
  expect(sql).toContain('enable row level security')
  expect(sql).toContain('applicant_id = (select auth.uid())')
  expect(sql).toContain("status = 'pending_review'")
  expect(sql).toContain('grant select, insert on public.mentorship_applications to authenticated')
  expect(sql).toContain('grant update(status,review_notes,reviewed_at,reviewed_by)')
  expect(sql).toContain("(auth.jwt()->>'aal') = 'aal2'")
  expect(sql).toContain('private.is_admin_user()')
  expect(sql).not.toContain('update public.profiles')
  expect(sql).not.toContain('update public.mentor_profiles')
})
