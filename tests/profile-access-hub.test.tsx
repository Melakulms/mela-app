import {afterEach, expect, it, vi} from 'vitest'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'

vi.mock('../src/lib/profile-diagnostics',()=>({
  inspectMyProfileSetup:vi.fn().mockResolvedValue('Account role: student'),
}))
vi.mock('../src/pages/SkillAcademy',()=>({
  default:({previewOnly}:{previewOnly?:boolean})=><section>Mock course catalog · {previewOnly?'read-only':'unrestricted'}</section>,
}))
vi.mock('../src/pages/SafetyCenter',()=>({
  default:()=> <section>Safety reporting tools</section>,
}))
import ProfileAccessHub from '../src/pages/ProfileAccessHub'

afterEach(cleanup)

it('keeps the education setup accessible and lets a stranded learner browse safe features',()=>{
  render(<ProfileAccessHub role="student" stageKey="school_9_10" setup={<div>Choose grade and subjects</div>}
    onRefresh={()=>{}} onSignOut={()=>{}} />)
  expect(screen.getByRole('heading',{name:'MELA Home',exact:true})).toBeTruthy()
  expect(screen.queryByText('Choose grade and subjects')).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'Complete my profile'}))
  expect(screen.getByText('Choose grade and subjects')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'Explore MELA features'}))
  expect(screen.getByRole('heading',{name:'Student features'})).toBeTruthy()
  expect(screen.getByText('Eight Arena competition formats')).toBeTruthy()
  expect(screen.getByRole('button',{name:/Browse courses/})).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:/Browse courses/}))
  expect(screen.getByText('Mock course catalog · read-only')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'All features'}))
  fireEvent.click(screen.getByRole('button',{name:'Open Safety Center'}))
  expect(screen.getByText('Safety reporting tools')).toBeTruthy()
})
it('shows role-specific family guidance without exposing a learners private data',()=>{
  render(<ProfileAccessHub role="parent" setup={<div>Family-only setup</div>}
    onRefresh={()=>{}} onSignOut={()=>{}} />)
  fireEvent.click(screen.getByRole('button',{name:'Explore MELA features'}))
  expect(screen.getByRole('heading',{name:'Family and guardian features'})).toBeTruthy()
  expect(screen.getByText(/Child records remain private/)).toBeTruthy()
  expect(screen.queryByRole('button',{name:/Browse courses/})).toBeNull()
})
it('shows employers a verification notice, not unapproved job publishing controls',()=>{
  render(<ProfileAccessHub role="employer" setup={<div>Legacy employer setup</div>}
    onRefresh={()=>{}} onSignOut={()=>{}} />)
  fireEvent.click(screen.getByRole('button',{name:'Explore MELA features'}))
  expect(screen.getByText(/administrator review/)).toBeTruthy()
  expect(screen.queryByRole('button',{name:'Publish vacancies'})).toBeNull()
})

it('returns an incomplete profile to Home instead of trapping it in setup after reload', () => {
  const props={role:'student' as const,setup:<div>Required subject setup</div>,onRefresh:()=>{},onSignOut:()=>{}}
  const first=render(<ProfileAccessHub {...props}/>)
  fireEvent.click(screen.getByRole('button',{name:'Complete my profile'}))
  expect(screen.getByText('Required subject setup')).toBeTruthy()
  act(()=>window.dispatchEvent(new Event('mela:go-home')))
  expect(screen.getByRole('heading',{name:'MELA Home',exact:true})).toBeTruthy()
  expect(screen.queryByText('Required subject setup')).toBeNull()
  first.unmount()
  render(<ProfileAccessHub {...props}/>)
  expect(screen.getByRole('heading',{name:'MELA Home',exact:true})).toBeTruthy()
  expect(screen.queryByText('Required subject setup')).toBeNull()
})
