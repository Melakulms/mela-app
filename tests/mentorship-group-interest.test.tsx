import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import MentorshipGroupInterest from '../src/components/MentorshipGroupInterest'

const mocks = vi.hoisted(() => ({ user:vi.fn(), read:vi.fn(), insert:vi.fn() }))
vi.mock('../src/lib/supabase', () => ({
  supabase:{
    auth:{getUser:mocks.user},
    from:()=>({
      select:()=>({eq:mocks.read}),
      insert:mocks.insert,
    }),
  },
}))
const groups = [{
  id:'group-1',title:'Career Portfolio Workshop',category:'career',
  description:'A supervised adult-group mentorship program',
  mentor_id:'mentor-1', starts_at:'2099-10-27T09:00:00Z',capacity:12,
}]

beforeEach(()=>{
  vi.clearAllMocks()
  mocks.user.mockResolvedValue({data:{user:{id:'learner-1'}},error:null})
  mocks.read.mockResolvedValue({data:[],error:null})
  mocks.insert.mockResolvedValue({error:null})
})
afterEach(cleanup)

describe('mentorship group applications',()=>{
  it('submits interest only, never claims a confirmed session',async()=>{
    render(<MentorshipGroupInterest groups={groups}/>)
    expect(await screen.findByRole('button',{name:'Request to join'})).toBeTruthy()
    fireEvent.click(screen.getByRole('button',{name:'Request to join'}))
    await waitFor(()=>expect(mocks.insert).toHaveBeenCalledTimes(1))
    expect(mocks.insert.mock.calls[0][0]).toEqual({group_id:'group-1',learner_id:'learner-1'})
    expect(await screen.findByText(/No meeting or place is confirmed/)).toBeTruthy()
    expect(screen.queryByText(/Your place is booked/)).toBeNull()
  })
  it('shows a denied eligibility decision and does not falsely confirm',async()=>{
    mocks.insert.mockResolvedValue({error:{message:'group mentoring requires a verified eligible adult learner'}})
    render(<MentorshipGroupInterest groups={groups}/>)
    const button=await screen.findByRole('button',{name:'Request to join'})
    fireEvent.click(button)
    const alert=await screen.findByRole('alert')
    expect(alert.textContent).toContain('verified eligible adult learner')
    expect(screen.queryByText(/No meeting or place is confirmed/)).toBeNull()
  })
  it('shows real empty directory without invented programs',async()=>{
    render(<MentorshipGroupInterest groups={[]}/>)
    expect(screen.getByText(/No approved group programs currently published/)).toBeTruthy()
    expect(screen.queryByRole('button',{name:'Request to join'})).toBeNull()
  })
})
