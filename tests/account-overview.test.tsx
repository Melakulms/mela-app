// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen} from '@testing-library/react'
vi.mock('../src/components/MembershipAndReferrals', () => ({ default: () => <div data-testid="membership-panel-mock" /> }))
import AccountOverview from '../src/pages/AccountOverview'
import {isLearnerAppRole,workspaceItems} from '../src/lib/role-workspaces'
import type {MelaProfile} from '../src/lib/auth'

afterEach(cleanup)

const example: MelaProfile = {
  id:'user-test', username:null, full_name:'Example User', email:'example@test.invalid',
  role:'teacher', account_status:'active', email_verified:true,
  profile_completion:100, coin_balance:0, preferred_language:'English',
  education_stage_key:null, grade_level:null, education_onboarding_completed:false,
}

it('provides shared account information without displaying private records from other users',()=>{
  const back=vi.fn()
  render(<AccountOverview profile={example} onBack={back}/>)
  expect(screen.getByRole('heading',{name:'My account'})).toBeTruthy()
  expect(screen.getByText('Example User')).toBeTruthy()
  expect(screen.getByText('Subject- and grade-scoped question review')).toBeTruthy()
  expect(screen.getByText(/Approved qualification and assigned questions/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'Back to my workspace'}))
  expect(back).toHaveBeenCalledOnce()
})

it('keeps professional capabilities tied to verified requirements, not public sign-up',()=>{
  expect(workspaceItems('mentor').some(item=>/Verified, active mentor profile/.test(item.requirement))).toBe(true)
  expect(workspaceItems('teacher').some(item=>/Approved qualification/.test(item.requirement))).toBe(true)
  expect(workspaceItems('partner').some(item=>/Approved partner organization/.test(item.requirement))).toBe(true)
  expect(workspaceItems('parent').some(item=>/Verified guardian relationship/.test(item.requirement))).toBe(true)
})

it('does not give admin roles a workspace in the learner app',()=>{
  expect(isLearnerAppRole('admin')).toBe(false)
  expect(isLearnerAppRole('super_admin')).toBe(false)
  expect(workspaceItems('admin')).toEqual([])
  expect(workspaceItems('__proto__')).toEqual([])
})

it('dispatches device settings only on request',()=>{
  const notify=vi.fn()
  window.addEventListener('mela:open-settings',notify)
  render(<AccountOverview profile={{...example, role:'company'}} onBack={vi.fn()}/>)
  fireEvent.click(screen.getByRole('button',{name:'Open settings'}))
  expect(notify).toHaveBeenCalledOnce()
  window.removeEventListener('mela:open-settings',notify)
})
