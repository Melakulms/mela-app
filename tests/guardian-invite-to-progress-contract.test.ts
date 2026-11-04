// @vitest-environment node
import {readFileSync} from 'node:fs'
import {expect,it} from 'vitest'

const migration=readFileSync(new URL('../supabase/migrations/20261104132000_guardian_invite_issuer_execute_parity.sql',import.meta.url),'utf8')
const test=readFileSync(new URL('sql/guardian_invite_to_approved_progress_rollback.sql',import.meta.url),'utf8')
const learner=readFileSync(new URL('../src/pages/Profile.tsx',import.meta.url),'utf8')
const parent=readFileSync(new URL('../src/pages/RoleDashboard.tsx',import.meta.url),'utf8')
const progress=readFileSync(new URL('../src/components/ParentLearnerProgress.tsx',import.meta.url),'utf8')

it('learner and parent UIs call separately authorized invitation and pending-redemption functions',()=>{
  expect(learner).toContain("supabase.rpc('create_parent_link_invite_v35')")
  expect(parent).toContain("supabase.rpc('redeem_parent_link_invite_v36'")
  expect(parent).toContain('guardian-link-consent')
  expect(parent).toContain('independent verification')
  expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.create_parent_link_invite_v35()')
  expect(migration).not.toMatch(/GRANT\s+EXECUTE.*\bredeem_parent_link_invite_v35\b/i)
})

it('verified guardian alone can request learner progress and staging SQL tests the full boundary',()=>{
  expect(progress).toContain("supabase.rpc('get_my_guardian_learner_progress'")
  expect(progress).toContain(".eq('status', 'verified')")
  for(const action of [
    'public.create_parent_link_invite_v35()', 'public.redeem_parent_link_invite_v36',
    'public.review_guardian_consent', 'public.get_my_guardian_learner_progress',
    'private.guardian_decision_audit', 'ROLLBACK;',
  ]) expect(test).toContain(action)
  expect(test).toContain("FAIL: child progress disclosed before approval")
  expect(test).toContain("FAIL: unrelated account accessed progress after approval")
  expect(test).toContain("FAIL: AAL1 admin approved guardian")
})
