// @vitest-environment node
import {readFileSync} from 'node:fs'
import {expect,it} from 'vitest'

const sql=readFileSync(new URL('../supabase/migrations/20261102170000_restore_secure_mentorship_applications.sql',import.meta.url),'utf8')

it('mentor application intake is owner-scoped and cannot self-approve',()=>{
  expect(sql).toContain('enable row level security')
  expect(sql).toContain('applicant_id = (select auth.uid())')
  expect(sql).toContain("status = 'pending_review'")
  expect(sql).toContain('grant select, insert on public.mentorship_applications to authenticated')
  expect(sql).not.toMatch(/grant\s+.*update.*\s+to authenticated/i)
  expect(sql).not.toMatch(/create policy\s+.*\s+for update\s+to authenticated/i)
})
