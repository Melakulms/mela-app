import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import MentorshipLearningWorkspace from '../src/components/MentorshipLearningWorkspace'
const mocks=vi.hoisted(()=>({load:vi.fn(),add:vi.fn(),remove:vi.fn()}))
vi.mock('../src/lib/supabase',()=>({supabase:{}}))
vi.mock('../src/components/MentorshipGroupInterest',()=>({default:()=>null}))
vi.mock('../src/lib/mentorship-workspace',()=>({
 loadMentorshipWorkspace:mocks.load,addMentorshipGoal:mocks.add,
 assignmentProgress:()=>({assigned:0,submitted:0,reviewed:0}),
 mentorshipActionSummary:()=>({activeGoals:0,overdueGoals:0,assignmentsToSubmit:0,overdueAssignments:0,awaitingFeedback:0}),
 deleteMentorshipGoal:mocks.remove,createMentorshipAssignment:vi.fn(),sendMentorshipFeedback:vi.fn(),setMentorshipGoalStatus:vi.fn(),submitMentorshipAssignment:vi.fn()
}))
beforeEach(()=>{
 vi.resetAllMocks()
 mocks.load.mockResolvedValue({goals:[],assignments:[],submissions:[],feedback:[],groups:[],resources:[{id:'r1',title:'Prepare for mentoring',category:'Preparation',description:'Make a plan',content:'Write three questions.'}]})
 mocks.add.mockResolvedValue(undefined)
 mocks.remove.mockResolvedValue(undefined)
})
afterEach(cleanup)
it('shows actual resource content without unrelated goal forms and switches to goal creation',async()=>{
 const {rerender}=render(<MentorshipLearningWorkspace mode="learner" section={10}/>)
 await screen.findByText('Prepare for mentoring')
 expect(mocks.load).toHaveBeenCalledWith('learner',10)
 expect(screen.queryByRole('textbox',{name:'Goal title'})).toBeNull()
 fireEvent.click(screen.getByText('Prepare for mentoring'))
 expect(screen.getByText('Write three questions.')).toBeTruthy()
 rerender(<MentorshipLearningWorkspace mode="learner" section={9}/>)
 fireEvent.change(await screen.findByRole('textbox',{name:'Goal title'}),{target:{value:'Prepare a portfolio'}})
 fireEvent.click(screen.getByRole('button',{name:'Add personal goal'}))
 await waitFor(()=>expect(mocks.add).toHaveBeenCalledWith('Prepare a portfolio','',''))
 expect(mocks.load).toHaveBeenCalledWith('learner',9)
})
it('shows a recoverable error rather than leaving a section blank',async()=>{
 mocks.load.mockRejectedValueOnce(new Error('Resources unavailable'))
 render(<MentorshipLearningWorkspace mode="learner" section={10}/>)
 expect((await screen.findByRole('alert')).textContent).toContain('Resources unavailable')
 fireEvent.click(screen.getByRole('button',{name:'Retry'}))
 await screen.findByText('Prepare for mentoring')
 expect(screen.queryByRole('alert')).toBeNull()
})

it('offers age-appropriate suggested goals but saves only after the learner confirms', async () => {
 render(<MentorshipLearningWorkspace mode="learner" section={9} stageKey="school_1_6" />)
 await screen.findByRole('button',{name:'Use: Build a weekly study routine'})
 fireEvent.click(screen.getByRole('button',{name:'Use: Build a weekly study routine'}))
 expect((screen.getByRole('textbox',{name:'Goal title'}) as HTMLInputElement).value).toBe('Build a weekly study routine')
 expect(mocks.add).not.toHaveBeenCalled()
 fireEvent.click(screen.getByRole('button',{name:'Add personal goal'}))
 await waitFor(()=>expect(mocks.add).toHaveBeenCalledWith('Build a weekly study routine',expect.stringContaining('Choose a subject'), ''))
})

it('requires a second tap before permanently removing a saved goal', async () => {
 mocks.load.mockResolvedValue({goals:[{
  id:'my-goal',learner_id:'my-user',title:'Study Plan',detail:'Review a chapter',
  target_date:null,status:'planned',created_at:'2026-10-28'
 }],assignments:[],submissions:[],feedback:[],groups:[],resources:[]})
 render(<MentorshipLearningWorkspace mode="learner" section={9}/>)
 await screen.findByText('Study Plan')
 fireEvent.click(screen.getByRole('button',{name:'Remove'}))
 expect(mocks.remove).not.toHaveBeenCalled()
 fireEvent.click(screen.getByRole('button',{name:'Keep goal'}))
 expect(screen.queryByRole('button',{name:'Confirm removal'})).toBeNull()
 fireEvent.click(screen.getByRole('button',{name:'Remove'}))
 fireEvent.click(screen.getByRole('button',{name:'Confirm removal'}))
 await waitFor(()=>expect(mocks.remove).toHaveBeenCalledTimes(1))
 expect(mocks.remove).toHaveBeenCalledWith('my-goal')
})

it('filters real learner assignments into pending, awaiting review, and reviewed', async () => {
  const assignment = (id:string,title:string) => ({
    id,request_id:'r',mentor_id:'mentor',learner_id:'learner',title,
    instructions:'Complete an evidence-based practice exercise',due_at:null,created_at:'2026-10-20',
  })
  mocks.load.mockResolvedValue({
    goals:[],resources:[],groups:[],
    assignments:[assignment('a','To practise'),assignment('b','Sent work'),assignment('c','Reviewed work')],
    submissions:[
      {id:'sub-b',assignment_id:'b',learner_id:'learner',response:'Answered B',created_at:'2026-10-22'},
      {id:'sub-c',assignment_id:'c',learner_id:'learner',response:'Answered C',created_at:'2026-10-22'},
    ],
    feedback:[{id:'fb-c',assignment_id:'c',mentor_id:'mentor',feedback:'Good analysis',created_at:'2026-10-23'}],
  })
  render(<MentorshipLearningWorkspace mode="learner" section={11} />)
  await screen.findByText('To practise')
  fireEvent.change(screen.getByLabelText('Show assignments'), {target:{value:'pending'}})
  expect(screen.getByText('To practise')).toBeTruthy()
  expect(screen.queryByText('Sent work')).toBeNull()
  fireEvent.change(screen.getByLabelText('Show assignments'), {target:{value:'waiting'}})
  expect(screen.getByText('Sent work')).toBeTruthy()
  expect(screen.queryByText('To practise')).toBeNull()
  fireEvent.change(screen.getByLabelText('Show assignments'), {target:{value:'reviewed'}})
  expect(screen.getByText('Reviewed work')).toBeTruthy()
  expect(screen.getByText(/Good analysis/)).toBeTruthy()
  expect(screen.queryByText('Sent work')).toBeNull()
})
