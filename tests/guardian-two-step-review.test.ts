// @vitest-environment node
import {readFileSync} from 'node:fs'
import {expect,it} from 'vitest'

const migration=readFileSync(new URL('../supabase/migrations/20261102195000_guardian_two_step_mfa_review.sql',import.meta.url),'utf8')
const roleDashboard=readFileSync(new URL('../src/pages/RoleDashboard.tsx',import.meta.url),'utf8')

it('a parent link code must not automatically verify guardianship or grant student access',()=>{
  const pendingPath=migration.slice(migration.indexOf('create or replace function public.redeem_parent_link_invite_v36'),migration.indexOf('create or replace function public.review_guardian_consent'))
  expect(pendingPath).toContain("values (v_inv.learner_id,v_uid,'parent','pending','2026-08-14')")
  expect(pendingPath).toContain('revoke all on function public.redeem_parent_link_invite_v35')
  expect(pendingPath).not.toMatch(/set\s+learner_safety_status\s*=/i)
  expect(pendingPath).not.toMatch(/status\s*=\s*'verified'/i)
  expect(roleDashboard).toContain("supabase.rpc('redeem_parent_link_invite_v36'")
  expect(roleDashboard).toContain('Link request submitted for independent verification')
  expect(roleDashboard).toContain('guardian-link-consent')
})

it('guardian approval requires MFA, evidence, a linked active verified parent and an active learner',()=>{
  const review=migration.slice(migration.indexOf('create or replace function public.review_guardian_consent'))
  expect(review).toContain("auth.jwt()->>'aal'")
  expect(review).toContain('private.is_admin_user()')
  expect(review).toContain("status = 'pending' for update")
  expect(review).toContain('v.guardian_user_id is null')
  expect(review).toContain('record a 12-1000 character evidence-based review note')
  expect(review).toContain("'guardian_consent_review'")
})
