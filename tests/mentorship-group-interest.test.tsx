import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import MentorshipGroupInterest from '../src/components/MentorshipGroupInterest'

const mocks = vi.hoisted(() => ({ user:vi.fn(), read:vi.fn(), attendanceRead:vi.fn(), insert:vi.fn(), withdraw:vi.fn() }))
vi.mock('../src/lib/supabase', () => ({
  supabase:{
    auth:{getUser:mocks.user},
    from:()=>({
      select:()=>({eq:mocks.read,in:mocks.attendanceRead}),
      insert:mocks.insert,
      delete:()=>({
        eq:()=>({eq:()=>({eq:()=>({select:mocks.withdraw})})}),
      }),
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
  mocks.attendanceRead.mockResolvedValue({data:[],error:null})
  mocks.insert.mockResolvedValue({error:null})
  mocks.withdraw.mockResolvedValue({data:[{id:'interest-1'}],error:null})
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
  it('shows approved learner own manually reported group attendance without credentials',async()=>{
    mocks.read.mockResolvedValue({data:[{id:'interest-1',group_id:'group-1',status:'approved'}],error:null})
    mocks.attendanceRead.mockResolvedValue({data:[{interest_id:'interest-1',status:'reported_present'}],error:null})
    render(<MentorshipGroupInterest groups={groups}/>)
    expect(await screen.findByText(/Administrator reported attendance/)).toBeTruthy()
    expect(screen.getByText(/Approval is not proof of a completed meeting or achievement/)).toBeTruthy()
    expect(mocks.attendanceRead).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/Earned Career Passport/)).toBeNull()
  })
  it('shows real empty directory without invented programs',async()=>{
    render(<MentorshipGroupInterest groups={[]}/>)
    expect(screen.getByText(/No approved group programs currently published/)).toBeTruthy()
    expect(screen.queryByRole('button',{name:'Request to join'})).toBeNull()
  })
})

it('fails closed when membership cannot be loaded, then offers retry once read recovers', async () => {
  mocks.read.mockResolvedValueOnce({data:null,error:{message:'Membership RLS fetch unavailable'}})
    .mockResolvedValue({data:[],error:null})
  render(<MentorshipGroupInterest groups={groups}/>)
  expect((await screen.findByRole('alert')).textContent).toContain('Membership RLS fetch unavailable')
  const request = screen.getByRole('button',{name:'Request to join'}) as HTMLButtonElement
  expect(request.disabled).toBe(true)
  fireEvent.click(request)
  expect(mocks.insert).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button',{name:'Retry group status'}))
  await waitFor(()=>expect((screen.getByRole('button',{name:'Request to join'}) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button',{name:'Request to join'}))
  await waitFor(()=>expect(mocks.insert).toHaveBeenCalledOnce())
})

it('does not falsely claim a pending interest was withdrawn if no row was deleted', async () => {
  mocks.read.mockResolvedValue({data:[{id:'interest-1',group_id:'group-1',status:'pending'}],error:null})
  mocks.withdraw.mockResolvedValue({data:[],error:null})
  render(<MentorshipGroupInterest groups={groups}/>)
  fireEvent.click(await screen.findByRole('button',{name:'Withdraw interest'}))
  expect((await screen.findByRole('alert')).textContent).toContain('was not withdrawn')
  expect(screen.queryByText(/Your pending interest was withdrawn/)).toBeNull()
})
