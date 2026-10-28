import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react'
import MentorshipSafetyReporting from '../src/components/MentorshipSafetyReporting'

const mocks=vi.hoisted(()=>({getUser:vi.fn(),read:vi.fn(),rpc:vi.fn()}))
vi.mock('../src/lib/supabase',()=>({
  supabase:{
    auth:{getUser:mocks.getUser},
    from:()=>({select:()=>({eq:()=>({in:()=>({order:()=>({limit:mocks.read})})})})}),
    rpc:mocks.rpc,
  },
}))
const mentors=[{user_id:'mentor-1',full_name:'Educator Alpha',headline:'Academic mentor'}] as any
const requests=[{id:'request-1',topic:'Study planning',mentor_id:'mentor-1',status:'accepted'}] as any
const sessions=[] as any

beforeEach(()=>{
  vi.clearAllMocks()
  mocks.getUser.mockResolvedValue({data:{user:{id:'learner-1'}},error:null})
  mocks.read.mockResolvedValue({data:[],error:null})
  mocks.rpc.mockResolvedValue({data:'00000000-0000-4000-8000-000000000001',error:null})
})
afterEach(cleanup)

describe('Mentorship confidential safety reporting',()=>{
  it('shows only real mentor/participant targets, not fictitious safety incidents',async()=>{
    render(<MentorshipSafetyReporting mentors={mentors} requests={requests} sessions={sessions}/>)
    const select=screen.getByLabelText('Who or what is involved?') as HTMLSelectElement
    expect(select.options.length).toBe(3)
    expect(await screen.findByText('No mentorship safety reports on this account.')).toBeTruthy()
  })
  it('submits a selected real mentorship target, reports case reference only after server success',async()=>{
    render(<MentorshipSafetyReporting mentors={mentors} requests={requests} sessions={sessions}/>)
    fireEvent.change(screen.getByLabelText('Who or what is involved?'),{target:{value:'mentorship_request:request-1'}})
    fireEvent.change(screen.getByLabelText('Concern'),{target:{value:'Harassment, discrimination or threats'}})
    fireEvent.change(screen.getByLabelText(/Describe what happened/),{target:{value:'An inappropriate message was sent in the mentoring request.'}})
    fireEvent.click(screen.getByRole('button',{name:'Send confidential safety report'}))
    await waitFor(()=>expect(mocks.rpc).toHaveBeenCalledTimes(1))
    expect(mocks.rpc).toHaveBeenCalledWith('report_mentorship_concern',{
      p_target_type:'mentorship_request',
      p_target_id:'request-1',
      p_reason:'Harassment, discrimination or threats',
      p_details:'An inappropriate message was sent in the mentoring request.',
    })
    expect(await screen.findByText(/Your safety concern was submitted to MELA moderation/)).toBeTruthy()
  })
  it('does not claim success when the safety backend rejects an unauthorized report',async()=>{
    mocks.rpc.mockResolvedValue({data:null,error:{message:'report only a mentorship request you participated in'}})
    render(<MentorshipSafetyReporting mentors={mentors} requests={requests} sessions={sessions}/>)
    fireEvent.change(screen.getByLabelText('Who or what is involved?'),{target:{value:'mentorship_request:request-1'}})
    fireEvent.change(screen.getByLabelText('Concern'),{target:{value:'Other mentorship safety concern'}})
    fireEvent.change(screen.getByLabelText(/Describe what happened/),{target:{value:'A concern that requires confidential review.'}})
    fireEvent.click(screen.getByRole('button',{name:'Send confidential safety report'}))
    expect((await screen.findByRole('alert')).textContent).toContain('report only a mentorship request')
    expect(screen.queryByText(/Your safety concern was submitted/)).toBeNull()
  })
})


it('distinguishes a failed confidential report-history read from a real empty history, without blocking new safety reports',async()=>{
  mocks.read.mockResolvedValueOnce({data:null,error:{message:'Safety history temporarily unavailable'}})
    .mockResolvedValue({data:[],error:null})
  render(<MentorshipSafetyReporting mentors={mentors} requests={requests} sessions={sessions}/>)
  expect(await screen.findByText(/Your private report history could not be verified/)).toBeTruthy()
  expect(screen.queryByText('No mentorship safety reports on this account.')).toBeNull()
  fireEvent.change(screen.getByLabelText('Who or what is involved?'),{target:{value:'mentorship_request:request-1'}})
  fireEvent.change(screen.getByLabelText('Concern'),{target:{value:'Other mentorship safety concern'}})
  fireEvent.change(screen.getByLabelText(/Describe what happened/),{target:{value:'This matter needs confidential review by the safety team.'}})
  fireEvent.click(screen.getByRole('button',{name:'Send confidential safety report'}))
  await waitFor(()=>expect(mocks.rpc).toHaveBeenCalledTimes(1))
  expect(await screen.findByText(/Your safety concern was submitted to MELA moderation/)).toBeTruthy()
  expect(await screen.findByText('No mentorship safety reports on this account.')).toBeTruthy()
})


it('removes a previous users confidential safety history and unsent draft after account switch',async()=>{
  mocks.read.mockResolvedValueOnce({data:[{
    id:'case-first-account',reason:'Confidential first-account incident',
    status:'under_review',created_at:'2026-10-27T12:00:00Z',
  }],error:null}).mockResolvedValue({data:[],error:null})
  render(<MentorshipSafetyReporting mentors={mentors} requests={requests} sessions={sessions}/>)
  await screen.findByText('Confidential first-account incident')
  fireEvent.change(screen.getByLabelText('Who or what is involved?'),{
    target:{value:'mentorship_request:request-1'},
  })
  fireEvent.change(screen.getByLabelText('Concern'),{
    target:{value:'Other mentorship safety concern'},
  })
  fireEvent.change(screen.getByLabelText(/Describe what happened/),{
    target:{value:'Unsent confidential information from the first account.'},
  })
  fireEvent(window,new Event('mela:session-boundary'))
  expect(screen.queryByText('Confidential first-account incident')).toBeNull()
  expect((screen.getByLabelText(/Describe what happened/) as HTMLTextAreaElement).value).toBe('')
  expect((screen.getByLabelText('Who or what is involved?') as HTMLSelectElement).value).toBe('')
  await waitFor(()=>expect(mocks.read).toHaveBeenCalledTimes(2))
  expect(await screen.findByText('No mentorship safety reports on this account.')).toBeTruthy()
})

it('does not show the previous users late confidential report receipt after sign-out',async()=>{
  let finish:(value:unknown)=>void=()=>{}
  mocks.rpc.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
  render(<MentorshipSafetyReporting mentors={mentors} requests={requests} sessions={sessions}/>)
  await screen.findByText('No mentorship safety reports on this account.')
  fireEvent.change(screen.getByLabelText('Who or what is involved?'),{
    target:{value:'mentorship_request:request-1'},
  })
  fireEvent.change(screen.getByLabelText('Concern'),{
    target:{value:'Other mentorship safety concern'},
  })
  fireEvent.change(screen.getByLabelText(/Describe what happened/),{
    target:{value:'A confidential report that should never appear after logout.'},
  })
  fireEvent.click(screen.getByRole('button',{name:'Send confidential safety report'}))
  await waitFor(()=>expect(mocks.rpc).toHaveBeenCalledOnce())
  fireEvent(window,new Event('mela:session-boundary'))
  finish({data:'00000000-0000-4000-8000-000000000001',error:null})
  await waitFor(()=>expect(mocks.read).toHaveBeenCalledTimes(2))
  expect(screen.queryByText(/Your safety concern was submitted/)).toBeNull()
  expect((screen.getByLabelText(/Describe what happened/) as HTMLTextAreaElement).value).toBe('')
})
