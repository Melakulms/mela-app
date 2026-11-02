// @vitest-environment node
import {readFileSync} from 'node:fs'
import {expect,it} from 'vitest'

const sql=readFileSync(new URL('../supabase/migrations/20261102201000_policy_summary_review_receipts.sql',import.meta.url),'utf8')
const panel=readFileSync(new URL('../src/components/PolicySummaryReviewPanel.tsx',import.meta.url),'utf8')
const overview=readFileSync(new URL('../src/pages/AccountOverview.tsx',import.meta.url),'utf8')

it('records deliberate draft-summary review separately from legal acceptance and guardian consent',()=>{
  expect(sql).toContain('create table if not exists public.policy_summary_review_receipts')
  expect(sql).toContain('policy_summary_self_create')
  expect(sql).toContain('user_id=(select auth.uid())')
  expect(sql).toContain("review_kind='draft_summary'")
  expect(sql).toContain('enable row level security')
  expect(sql).not.toContain('insert into public.user_policy_acknowledgements')
  expect(panel).toContain('not the final approved legal document')
  expect(panel).toContain('not final Terms acceptance or legal/privacy consent')
  expect(overview).toContain('<PolicySummaryReviewPanel userId={profile.id}/>')
})
