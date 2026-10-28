// @vitest-environment jsdom
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest'
import { act,cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react'
import MentorshipOutcomeReview from '../src/components/MentorshipOutcomeReview'

const mocks=vi.hoisted(()=>({
 getUser:vi.fn(),read:vi.fn(),verificationRead:vi.fn(),insert:vi.fn(),update:vi.fn(),
}))
vi.mock('../src/lib/supabase',()=>({
 supabase:{
  auth:{getUser:mocks.getUser},
  from:()=>({
   select:()=>({eq:()=>({order:()=>({limit:mocks.read})}),in:mocks.verificationRead}),
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
 mocks.verificationRead.mockResolvedValue({data:[],error:null})
 mocks.insert.mockReturnValue({select:async()=>({data:[{id:'claim-1'}],error:null})})
 mocks.update.mockReturnValue({eq:()=>({eq:()=>({eq:()=>({select:async()=>({data:[{id:'outcome-1'}],error:null})})})})})
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
  await waitFor(()=>expect((screen.getByRole('button',{name:'Submit for mentor review'}) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button',{name:'Submit for mentor review'}))
  await waitFor(()=>expect(mocks.insert).toHaveBeenCalledTimes(1))
  expect(mocks.insert).toHaveBeenCalledWith({
   session_id:'session-1',learner_id:'learner-1',mentor_id:'mentor-1',
   category:'career',outcome_text:'I prepared a detailed practice CV using feedback from my mentor.',
  })
  expect(await screen.findByText(/No credential or certificate has been issued/)).toBeTruthy()
 })
 it('shows an independent learner evidence decision without issuing a credential',async()=>{
  mocks.read.mockResolvedValue({data:[{
    id:'claim-1',session_id:'session-1',learner_id:'learner-1',mentor_id:'mentor-1',
    category:'career',outcome_text:'I completed a detailed career planning worksheet.',
    status:'mentor_supported',review_notes:'I supported the outcome after reviewing the work.',
    created_at:'2026-10-25T10:41:00Z',
  }],error:null})
  mocks.verificationRead.mockResolvedValue({data:[{
    claim_id:'claim-1',decision:'evidence_supported',
    public_reason:'Independent reviewers inspected the submitted work and approved evidence for this specific learning outcome.',
  }],error:null})
  render(<MentorshipOutcomeReview mode="learner" sessions={[completedSession]}/>)
  expect(await screen.findByText(/Supporting evidence reviewed by MELA administration/)).toBeTruthy()
  expect(screen.getByText(/This review does not issue a certificate/)).toBeTruthy()
  expect(mocks.verificationRead).toHaveBeenCalledTimes(1)
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


it('does not present an unreadable learner outcome history as empty or allow a duplicate submission',async()=>{
  mocks.read.mockResolvedValueOnce({data:null,error:{message:'Outcome history offline'}})
    .mockResolvedValue({data:[],error:null})
  render(<MentorshipOutcomeReview mode="learner" sessions={[completedSession]}/>)
  expect((await screen.findByRole('alert')).textContent).toContain('Outcome history offline')
  expect(screen.getByText(/not a confirmed empty history/)).toBeTruthy()
  expect(screen.queryByText('No recorded outcome claims yet.')).toBeNull()
  const submit=screen.getByRole('button',{name:'Submit for mentor review'}) as HTMLButtonElement
  expect(submit.disabled).toBe(true)
  expect(mocks.insert).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button',{name:'Refresh outcome reviews'}))
  await waitFor(()=>expect(screen.getByText('No recorded outcome claims yet.')).toBeTruthy())
  expect(screen.queryByText(/not a confirmed empty history/)).toBeNull()
})

it('does not show a new submission action until the signed-in learner can read existing claims',async()=>{
  let releaseRead: ((response:unknown)=>void)|null = null
  mocks.read.mockImplementationOnce(()=>new Promise(resolve=>{releaseRead=resolve}))
  render(<MentorshipOutcomeReview mode="learner" sessions={[completedSession]}/>)
  const submit=screen.getByRole('button',{name:'Submit for mentor review'}) as HTMLButtonElement
  expect(submit.disabled).toBe(true)
  expect(mocks.insert).not.toHaveBeenCalled()
  if(!releaseRead) await waitFor(()=>expect(releaseRead).toBeTruthy())
  releaseRead!({data:[],error:null})
  await waitFor(()=>expect(screen.getByText('No recorded outcome claims yet.')).toBeTruthy())
})

it('prevents learner evidence submission when existing category already has a claim',async()=>{
  mocks.read.mockResolvedValue({data:[{
    id:'claim-1',session_id:'session-1',learner_id:'learner-1',mentor_id:'mentor-1',
    category:'career',outcome_text:'A practice portfolio with explained learning evidence.',
    status:'submitted',review_notes:null,created_at:'2026-10-25',
  }],error:null})
  render(<MentorshipOutcomeReview mode="learner" sessions={[completedSession]}/>)
  await screen.findByText(/A practice portfolio with explained learning evidence/)
  fireEvent.change(screen.getByLabelText('Completed session'),{target:{value:'session-1'}})
  expect(screen.getByText(/already submitted an outcome in this category/)).toBeTruthy()
  expect((screen.getByRole('button',{name:'Submit for mentor review'}) as HTMLButtonElement).disabled).toBe(true)
  expect(mocks.insert).not.toHaveBeenCalled()
})


it('shows actual saved claims when independent administrator verification read fails',async()=>{
  mocks.read.mockResolvedValue({data:[{
    id:'saved-claim',session_id:'session-1',learner_id:'learner-1',mentor_id:'mentor-1',
    category:'career',outcome_text:'I learned how to improve my practical CV and planning process.',
    status:'mentor_supported',review_notes:'Observed the learner exercise.',
    created_at:'2026-10-25',
  }],error:null})
  mocks.verificationRead.mockResolvedValue({data:null,error:{message:'Independent verification offline'}})
  render(<MentorshipOutcomeReview mode="learner" sessions={[completedSession]}/>)
  expect(await screen.findByText(/I learned how to improve my practical CV/)).toBeTruthy()
  expect(screen.getByText(/independent administrator verification details could not be loaded/)).toBeTruthy()
  expect(screen.getByText(/Independent verification offline/)).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Completed session'),{target:{value:'session-1'}})
  expect((screen.getByRole('button',{name:'Submit for mentor review'}) as HTMLButtonElement).disabled).toBe(true)
  expect(mocks.insert).not.toHaveBeenCalled()
  expect(screen.queryByText(/Supporting evidence reviewed by MELA administration/)).toBeNull()
})

it('requires a returned saved outcome row before claiming success or clearing the draft',async()=>{
  mocks.insert.mockReturnValueOnce({select:async()=>({data:[],error:null})})
  render(<MentorshipOutcomeReview mode="learner" sessions={[completedSession]}/>)
  fireEvent.change(screen.getByLabelText('Completed session'),{target:{value:'session-1'}})
  fireEvent.change(screen.getByLabelText('What did you actually learn or produce?'),{target:{value:'I improved my CV and learned to explain three projects.'}})
  await waitFor(()=>expect((screen.getByRole('button',{name:'Submit for mentor review'}) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button',{name:'Submit for mentor review'}))
  expect((await screen.findByRole('alert')).textContent).toContain('not confirmed by the database')
  expect((screen.getByLabelText('What did you actually learn or produce?') as HTMLTextAreaElement).value).toContain('three projects')
  expect(screen.queryByText(/No credential or certificate has been issued/)).toBeNull()
})

it('clears unsent evidence and rejects a previous account delayed read',async()=>{
 let resolveRead!: (value:unknown)=>void
 mocks.read.mockImplementationOnce(()=>new Promise(resolve=>{resolveRead=resolve}))
 render(<MentorshipOutcomeReview mode="learner" sessions={[completedSession]}/>)
 await waitFor(()=>expect(resolveRead).toBeTruthy())
 fireEvent.change(screen.getByLabelText('What did you actually learn or produce?'),{target:{value:'Private evidence draft from the old account'}})
 mocks.getUser.mockResolvedValue({data:{user:null},error:null})
 fireEvent(window,new Event('mela:session-boundary'))
 expect((screen.getByLabelText('What did you actually learn or produce?') as HTMLTextAreaElement).value).toBe('')
 await screen.findByRole('alert')
 await act(async()=>{resolveRead({data:[{id:'old',category:'career',outcome_text:'Confidential previous account evidence',created_at:'2026-10-25'}],error:null})})
 expect(mocks.verificationRead).not.toHaveBeenCalled()
 expect(screen.queryByText('Confidential previous account evidence')).toBeNull()
 expect((screen.getByRole('button',{name:'Submit for mentor review'}) as HTMLButtonElement).disabled).toBe(true)
})

it('ignores a delayed saved outcome after sign-out',async()=>{
 let resolveSave!: (value:unknown)=>void
 mocks.insert.mockReturnValue({select:()=>new Promise(resolve=>{resolveSave=resolve})})
 render(<MentorshipOutcomeReview mode="learner" sessions={[completedSession]}/>)
 await screen.findByText('No recorded outcome claims yet.')
 fireEvent.change(screen.getByLabelText('Completed session'),{target:{value:'session-1'}})
 fireEvent.change(screen.getByLabelText('What did you actually learn or produce?'),{target:{value:'Private evidence for my completed portfolio project'}})
 fireEvent.click(screen.getByRole('button',{name:'Submit for mentor review'}))
 await waitFor(()=>expect(resolveSave).toBeTruthy())
 mocks.getUser.mockResolvedValue({data:{user:null},error:null})
 fireEvent(window,new Event('mela:session-boundary'))
 await screen.findByRole('alert')
 await act(async()=>{resolveSave({data:[{id:'saved'}],error:null})})
 expect(screen.queryByText(/No credential or certificate has been issued/)).toBeNull()
 expect((screen.getByLabelText('What did you actually learn or produce?') as HTMLTextAreaElement).value).toBe('')
})

it('clears learner drafts when switching to mentor mode and back',async()=>{
 const view=render(<MentorshipOutcomeReview mode="learner" sessions={[completedSession]}/>)
 await screen.findByText('No recorded outcome claims yet.')
 fireEvent.change(screen.getByLabelText('What did you actually learn or produce?'),{target:{value:'Private draft belonging to learner mode'}})
 view.rerender(<MentorshipOutcomeReview mode="mentor"/>)
 await screen.findByText('No recorded outcome claims yet.')
 view.rerender(<MentorshipOutcomeReview mode="learner" sessions={[completedSession]}/>)
 expect((screen.getByLabelText('What did you actually learn or produce?') as HTMLTextAreaElement).value).toBe('')
})
