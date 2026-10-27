// @vitest-environment jsdom
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest'
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react'
import MentorshipOutcomeReview from '../src/components/MentorshipOutcomeReview'

const mocks=vi.hoisted(()=>({
 getUser:vi.fn(),read:vi.fn(),insert:vi.fn(),update:vi.fn(),
}))
vi.mock('../src/lib/supabase',()=>({
 supabase:{
  auth:{getUser:mocks.getUser},
  from:()=>({
   select:()=>({eq:()=>({order:()=>({limit:mocks.read})})}),
   insert:mocks.insert,
   update:mocks.update,
  }),
 },
}))
const completedSession={
 id:'session-1',status:'completed',scheduled_at:'2026-10-25T10:00:00Z',
 completed_at:'2026-10-25T10:40:00Z',mentor_id:'mentor-1',mentee_id:'learner-1',
} as any

beforeEach(()=>{
 vi.clearAllMocks()
 mocks.getUser.mockResolvedValue({data:{user:{id:'learner-1'}},error:null})
 mocks.read.mockResolvedValue({data:[],error:null})
 mocks.insert.mockResolvedValue({data:null,error:null})
 mocks.update.mockReturnValue({eq:()=>({eq:()=>({select:async()=>({data:[{id:'outcome-1'}],error:null})})})})
})
afterEach(cleanup)

describe('mentorship outcome evidence review',()=>{
 it('does not let a learner claim an outcome before a completed session',async()=>{
  render(<MentorshipOutcomeReview mode="learner" sessions={[]}/>)
  expect(screen.getByText(/No completed mentorship sessions are available/)).toBeTruthy()
  expect(screen.queryByRole('button',{name:'Submit for mentor review'})).toBeNull()
  expect(mocks.insert).not.toHaveBeenCalled()
 })
 it('submits only real completed-session evidence without awarding credentials',async()=>{
  render(<MentorshipOutcomeReview mode="learner" sessions={[completedSession]}/>)
  fireEvent.change(screen.getByLabelText('Completed session'),{target:{value:'session-1'}})
  fireEvent.change(screen.getByLabelText('What did you actually learn or produce?'),{
   target:{value:'I prepared a detailed practice CV using feedback from my mentor.'},
  })
  fireEvent.click(screen.getByRole('button',{name:'Submit for mentor review'}))
  await waitFor(()=>expect(mocks.insert).toHaveBeenCalledTimes(1))
  expect(mocks.insert).toHaveBeenCalledWith({
   session_id:'session-1',learner_id:'learner-1',mentor_id:'mentor-1',
   category:'career',outcome_text:'I prepared a detailed practice CV using feedback from my mentor.',
  })
  expect(await screen.findByText(/No credential or certificate has been issued/)).toBeTruthy()
 })
 it('requires a verified mentor review note and preserves server denial',async()=>{
  mocks.getUser.mockResolvedValue({data:{user:{id:'mentor-1'}},error:null})
  mocks.read.mockResolvedValue({data:[{
   id:'outcome-1',session_id:'session-1',learner_id:'learner-1',
   mentor_id:'mentor-1',category:'technical',
   outcome_text:'I learned to explain a safe programming pattern for websites.',
   status:'submitted',review_notes:null,created_at:'2026-10-25T10:41:00Z',
  }],error:null})
  render(<MentorshipOutcomeReview mode="mentor"/>)
  await screen.findByText(/I learned to explain a safe programming pattern/)
  const support=screen.getByRole('button',{name:'Support this outcome'}) as HTMLButtonElement
  expect(support.disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Review evidence and explain your decision'),{
   target:{value:'I reviewed the actual work shown in the completed session and support the learner statement.'},
  })
  fireEvent.click(support)
  await waitFor(()=>expect(mocks.update).toHaveBeenCalledTimes(1))
  expect(mocks.update.mock.calls[0][0]).toMatchObject({
   status:'mentor_supported',reviewer_id:'mentor-1',
  })
  expect(await screen.findByText(/not a Career Passport credential/)).toBeTruthy()
 })
})
