import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import MentorshipLearningWorkspace from '../src/components/MentorshipLearningWorkspace'

const mocks = vi.hoisted(()=>({
  load:vi.fn(),assign:vi.fn(),feedback:vi.fn(),getUser:vi.fn(),accepted:vi.fn(),
}))
vi.mock('../src/components/MentorshipGroupInterest',()=>({default:()=>null}))
vi.mock('../src/lib/supabase',()=>({supabase:{
  auth:{getUser:mocks.getUser},
  from:(table:string)=>{
    if(table!=='mentorship_requests') throw new Error('Unexpected table '+table)
    return {select:()=>({eq:()=>({eq:()=>({order:()=>({limit:mocks.accepted})})})})}
  },
}}))
vi.mock('../src/lib/mentorship-workspace',()=>({
  loadMentorshipWorkspace:mocks.load,
  createMentorshipAssignment:mocks.assign,
  assignmentProgress:()=>({assigned:0,submitted:0,reviewed:0}),
  mentorshipActionSummary:()=>({activeGoals:0,overdueGoals:0,assignmentsToSubmit:0,overdueAssignments:0,awaitingFeedback:0}),
  addMentorshipGoal:vi.fn(),deleteMentorshipGoal:vi.fn(),updateMentorshipGoal:vi.fn(),
  setMentorshipGoalStatus:vi.fn(),sendMentorshipFeedback:mocks.feedback,submitMentorshipAssignment:vi.fn(),
}))

beforeEach(()=>{
  vi.clearAllMocks()
  mocks.getUser.mockResolvedValue({data:{user:{id:'verified-mentor'}},error:null})
  mocks.accepted.mockResolvedValue({data:[{
    id:'accepted-request',mentee_id:'eligible-learner',topic:'Career guidance',status:'accepted',
  }],error:null})
  mocks.assign.mockResolvedValue(undefined)
  mocks.feedback.mockResolvedValue(undefined)
  mocks.load.mockResolvedValue({goals:[],assignments:[],submissions:[],feedback:[],resources:[],groups:[]})
})
afterEach(cleanup)

it('fills a real mentor assignment template but never writes until an accepted learner is selected and the mentor submits',async()=>{
  render(<MentorshipLearningWorkspace mode="mentor" section={11}/>)
  await screen.findByRole('button',{name:'Use: Career research task'})
  fireEvent.click(screen.getByRole('button',{name:'Use: Career research task'}))
  expect((screen.getByLabelText('Assignment title') as HTMLInputElement).value).toBe('Compare two career paths')
  expect((screen.getByLabelText('Instructions') as HTMLTextAreaElement).value).toContain('entry requirements')
  expect(mocks.assign).not.toHaveBeenCalled()
  const button=screen.getByRole('button',{name:'Assign to learner'}) as HTMLButtonElement
  expect(button.disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Accepted mentorship request'),{target:{value:'accepted-request'}})
  expect(button.disabled).toBe(false)
  fireEvent.click(button)
  await waitFor(()=>expect(mocks.assign).toHaveBeenCalledWith(
    'accepted-request','eligible-learner','Compare two career paths',expect.stringContaining('entry requirements'),''))
  expect(await screen.findByText('Your mentorship update was saved.')).toBeTruthy()
})

it('does not schedule a past assignment due time; failed saves preserve the mentor draft for retry',async()=>{
  mocks.assign.mockRejectedValueOnce(new Error('Assignment connection lost')).mockResolvedValue(undefined)
  render(<MentorshipLearningWorkspace mode="mentor" section={11}/>)
  await screen.findByRole('button',{name:'Use: Weekly study task'})
  fireEvent.click(screen.getByRole('button',{name:'Use: Weekly study task'}))
  fireEvent.change(screen.getByLabelText('Accepted mentorship request'),{target:{value:'accepted-request'}})
  fireEvent.change(screen.getByLabelText('Due date (optional)'),{target:{value:'2020-01-01T10:00'}})
  const submit=screen.getByRole('button',{name:'Assign to learner'}) as HTMLButtonElement
  expect(submit.disabled).toBe(true)
  expect(screen.getByText(/Choose a future due date and time/)).toBeTruthy()
  expect(mocks.assign).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Due date (optional)'),{target:{value:'2099-01-01T10:00'}})
  expect(submit.disabled).toBe(false)
  fireEvent.click(submit)
  expect((await screen.findByRole('alert')).textContent).toContain('Assignment connection lost')
  expect((screen.getByLabelText('Assignment title') as HTMLInputElement).value).toBe('One-week study reflection')
  fireEvent.click(submit)
  await waitFor(()=>expect(mocks.assign).toHaveBeenCalledTimes(2))
  expect(mocks.assign).toHaveBeenCalledWith('accepted-request','eligible-learner',
    'One-week study reflection',expect.stringContaining('practice activities'),'2099-01-01T10:00')
})

it('orders actual task deadlines and prioritizes tasks awaiting mentor feedback',async()=>{
  mocks.load.mockResolvedValue({goals:[],groups:[],resources:[],
    assignments:[
      {id:'late',title:'Late task',request_id:'r',mentor_id:'verified-mentor',learner_id:'l',instructions:'Review',due_at:'2099-12-01T10:00:00Z',created_at:'2026-10-27'},
      {id:'soon',title:'Soon task',request_id:'r',mentor_id:'verified-mentor',learner_id:'l',instructions:'Review',due_at:'2099-01-01T10:00:00Z',created_at:'2026-10-26'},
      {id:'waiting',title:'Review submitted work',request_id:'r',mentor_id:'verified-mentor',learner_id:'l',instructions:'Review',due_at:null,created_at:'2026-10-28'},
    ],
    submissions:[{id:'response',assignment_id:'waiting',learner_id:'l',response:'My work',created_at:'2026-10-28'}],
    feedback:[],
  })
  render(<MentorshipLearningWorkspace mode="mentor" section={11}/>)
  await screen.findByText('Late task')
  fireEvent.change(screen.getByLabelText('Order assignments'),{target:{value:'due_soon'}})
  const titles=()=>Array.from(document.querySelectorAll('article.list-row > strong')).map(node=>node.textContent)
  expect(titles()).toEqual(['Soon task','Late task','Review submitted work'])
  fireEvent.change(screen.getByLabelText('Order assignments'),{target:{value:'needs_action'}})
  expect(titles()[0]).toBe('Review submitted work')
  expect(mocks.assign).not.toHaveBeenCalled()
})


it('provides a feedback structure but rejects unchanged template placeholders and sends only actual mentor feedback',async()=>{
  mocks.load.mockResolvedValue({goals:[],groups:[],resources:[],
    assignments:[{id:'task-1',title:'Review career plan',request_id:'r',mentor_id:'verified-mentor',
      learner_id:'l',instructions:'Compare two careers',due_at:null,created_at:'2026-10-28'}],
    submissions:[{id:'answer-1',assignment_id:'task-1',learner_id:'l',
      response:'I compared required skills and daily activities.',created_at:'2026-10-28'}],
    feedback:[],
  })
  render(<MentorshipLearningWorkspace mode="mentor" section={11}/>)
  const draft=await screen.findByRole('button',{name:'Use structured feedback draft'})
  fireEvent.click(draft)
  const text=screen.getByLabelText('Give constructive feedback') as HTMLTextAreaElement
  expect(text.value).toContain('[describe actual evidence]')
  expect(screen.getByText(/Replace every bracketed example/)).toBeTruthy()
  const send=screen.getByRole('button',{name:'Send feedback'}) as HTMLButtonElement
  expect(send.disabled).toBe(true)
  expect(mocks.feedback).not.toHaveBeenCalled()
  fireEvent.change(text,{target:{value:'Observed work: compared two careers and requirements. Improvement: add a citation for each source. Next step: complete a skills comparison table.'}})
  expect(send.disabled).toBe(false)
  fireEvent.click(send)
  await waitFor(()=>expect(mocks.feedback).toHaveBeenCalledWith('task-1',expect.stringContaining('add a citation')))
})
