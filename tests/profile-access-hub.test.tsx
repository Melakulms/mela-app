import {afterEach, expect, it, vi} from 'vitest'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
vi.mock('../src/lib/profile-diagnostics',()=>({
  inspectMyProfileSetup:vi.fn().mockResolvedValue('Account role: student'),
}))
vi.mock('../src/pages/SafetyCenter',()=>({
  default:()=> <section>Safety reporting tools</section>,
}))
import ProfileAccessHub from '../src/pages/ProfileAccessHub'
afterEach(cleanup)

it.each(['student','parent','teacher','company','employer'] as const)('requires the %s profile before feature browsing',role=>{
  render(<ProfileAccessHub role={role} setup={<input aria-label="Required information"/>}
    onRefresh={()=>{}} onSignOut={()=>{}} />)
  expect(screen.getByRole('textbox',{name:'Required information'})).toBeTruthy()
  expect(screen.queryByRole('button',{name:'Explore MELA features'})).toBeNull()
  expect(screen.queryByRole('button',{name:/Browse courses/})).toBeNull()
  expect(screen.queryByRole('link',{name:/Year One/})).toBeNull()
})

it('keeps setup required after Home, a saved-profile check, and reload',()=>{
  const refresh=vi.fn()
  const props={role:'student' as const,setup:<input aria-label="Required information"/>,onRefresh:refresh,onSignOut:()=>{}}
  const first=render(<ProfileAccessHub {...props}/>)
  fireEvent.click(screen.getByRole('button',{name:'Check saved profile'}))
  expect(refresh).toHaveBeenCalledOnce()
  act(()=>window.dispatchEvent(new Event('mela:go-home')))
  expect(screen.getByRole('textbox',{name:'Required information'})).toBeTruthy()
  first.unmount()
  render(<ProfileAccessHub {...props}/>)
  expect(screen.getByRole('textbox',{name:'Required information'})).toBeTruthy()
})

it('preserves entered information while accessing safety support',async()=>{
  render(<ProfileAccessHub role="student" setup={<input aria-label="Required information"/>}
    onRefresh={()=>{}} onSignOut={()=>{}} />)
  fireEvent.change(screen.getByRole('textbox',{name:'Required information'}),{target:{value:'My information'}})
  fireEvent.click(screen.getByRole('button',{name:'Safety and support'}))
  expect(await screen.findByText('Safety reporting tools')).toBeTruthy()
  expect(screen.queryByRole('textbox',{name:'Required information'})).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'Complete my profile'}))
  expect((screen.getByRole('textbox',{name:'Required information'}) as HTMLInputElement).value).toBe('My information')
})

it('allows sign out without completing the form',()=>{
  const signOut=vi.fn()
  render(<ProfileAccessHub role="parent" setup={<div>Family setup</div>}
    onRefresh={()=>{}} onSignOut={signOut} />)
  fireEvent.click(screen.getByRole('button',{name:'Sign out'}))
  expect(signOut).toHaveBeenCalledOnce()
})
