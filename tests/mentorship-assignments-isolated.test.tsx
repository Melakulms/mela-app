import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import MentorshipAssignments from '../src/components/MentorshipAssignments'

const mocks=vi.hoisted(()=>({
  load:vi.fn(),create:vi.fn(),submit:vi.fn(),review:vi.fn(),
}))
vi.mock('../src/lib/mentorship-assignments',()=>({
  loadAssignmentWorkspace:mocks.load,
  createAssignment:mocks.create,
  submitAssignment:mocks.submit,
  reviewAssignment:mocks.review,
  assignmentDueIso:(value:string)=>value?new Date(value).toISOString():null,
}))
const accepted={id:'accepted-r',mentee_id:'verified-learner',topic:'Career planning'}
const task={id:'task-a',request_id:'accepted-r',mentor_id:'mentor-1',learner_id:'verified-learner',
  title:'Compare careers',instructions:'Compare two career paths with official resources.',
  due_at:null,created_at:'2026-10-28T10:00:00Z'}
const submission={id:'s-1',assignment_id:'task-a',learner_id:'verified-learner',
  response:'I compared entry requirements.',created_at:'2026-10-28T10:00:00Z'}
const feedback={id:'f-1',assignment_id:'task-a',mentor_id:'mentor-1',
  feedback:'Include a source for each claim.',created_at:'2026-10-28T11:00:00Z'}
beforeEach(()=>{
  vi.clearAllMocks()
  mocks.create.mockResolvedValue(undefined)
  mocks.submit.mockResolvedValue(undefined)
  mocks.review.mockResolvedValue(undefined)
  mocks.load.mockResolvedValue({assignments:[],submissions:[],feedback:[],accepted:[accepted]})
})
afterEach(cleanup)

it('requires explicit mentor submission and keeps prior evidence when preparing a new revision task',async()=>{
  mocks.load.mockResolvedValue({assignments:[task],submissions:[submission],feedback:[feedback],accepted:[accepted]})
  render(<MentorshipAssignments role="mentor"/>)
  const prepare=await screen.findByRole('button',{name:'Prepare revision task'})
  expect(screen.getByText(/I compared entry requirements/)).toBeTruthy()
  expect(screen.getByText(/Include a source for each claim/)).toBeTruthy()
  fireEvent.click(prepare)
  expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Revision: Compare careers')
  expect((screen.getByLabelText('Instructions') as HTMLTextAreaElement).value).toContain('Include a source for each claim.')
  expect(mocks.create).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button',{name:'Assign task'}))
  await waitFor(()=>expect(mocks.create).toHaveBeenCalledWith(accepted,
    'Revision: Compare careers',expect.stringContaining('Include a source for each claim.'),''))
})

it('does not allow a mentor to create a revision without a current accepted relationship',async()=>{
  mocks.load.mockResolvedValue({assignments:[task],submissions:[submission],feedback:[feedback],accepted:[]})
  render(<MentorshipAssignments role="mentor"/>)
  await screen.findByText('Compare careers')
  expect(screen.queryByRole('button',{name:'Prepare revision task'})).toBeNull()
  expect((screen.getByRole('button',{name:'Assign task'}) as HTMLButtonElement).disabled).toBe(true)
})

it('lets the assigned learner submit once, and preserves the draft after a network failure',async()=>{
  mocks.load.mockResolvedValue({assignments:[task],submissions:[],feedback:[],accepted:[]})
  mocks.submit.mockRejectedValueOnce(new Error('Connection interrupted')).mockResolvedValue(undefined)
  render(<MentorshipAssignments role="learner"/>)
  const field=await screen.findByLabelText('Your response') as HTMLTextAreaElement
  fireEvent.change(field,{target:{value:'I investigated two career requirements.'}})
  const action=screen.getByRole('button',{name:'Submit response'})
  fireEvent.click(action)
  expect((await screen.findByRole('alert')).textContent).toContain('Connection interrupted')
  expect(field.value).toContain('two career requirements')
  fireEvent.click(action)
  await waitFor(()=>expect(mocks.submit).toHaveBeenCalledTimes(2))
  expect(mocks.submit).toHaveBeenCalledWith('task-a','I investigated two career requirements.')
})

it('requires real learner work before the mentor feedback editor appears',async()=>{
  mocks.load.mockResolvedValue({assignments:[task],submissions:[],feedback:[],accepted:[accepted]})
  render(<MentorshipAssignments role="mentor"/>)
  await screen.findByText('Compare careers')
  expect(screen.queryByRole('button',{name:'Send feedback'})).toBeNull()
  mocks.load.mockResolvedValue({assignments:[task],submissions:[submission],feedback:[],accepted:[accepted]})
  fireEvent.click(screen.getByRole('button',{name:'Refresh assignments'}))
  const outline=await screen.findByRole('button',{name:'Use feedback outline'})
  fireEvent.click(outline)
  expect((screen.getByRole('button',{name:'Send feedback'}) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Your review'),{target:{value:'Please cite the official requirements page.'}})
  fireEvent.click(screen.getByRole('button',{name:'Send feedback'}))
  await waitFor(()=>expect(mocks.review).toHaveBeenCalledWith('task-a','Please cite the official requirements page.'))
})

it('clears private task data and ignores a late request after account sign-out',async()=>{
  let resolveFirst:((value:any)=>void)|null=null
  mocks.load.mockImplementationOnce(()=>new Promise(resolve=>{resolveFirst=resolve}))
  render(<MentorshipAssignments role="learner"/>)
  expect(screen.getByText('Loading assignments…')).toBeTruthy()
  window.dispatchEvent(new Event('mela:session-boundary'))
  await waitFor(()=>expect(screen.queryByText('Loading assignments…')).toBeNull())
  expect(screen.queryByText('Secret previous learner assignment')).toBeNull()
  resolveFirst!({assignments:[{...task,title:'Secret previous learner assignment'}],
    submissions:[],feedback:[],accepted:[]})
  await waitFor(()=>expect(screen.queryByText('Secret previous learner assignment')).toBeNull())
})

it('does not display success or reload old-account data after sign-out during submission',async()=>{
  let resolveSubmit:((value:unknown)=>void)|null=null
  mocks.submit.mockImplementationOnce(()=>new Promise(resolve=>{resolveSubmit=resolve}))
  mocks.load.mockResolvedValue({assignments:[task],submissions:[],feedback:[],accepted:[]})
  render(<MentorshipAssignments role="learner"/>)
  const field=await screen.findByLabelText('Your response')
  fireEvent.change(field,{target:{value:'Finished under the previous learner account.'}})
  fireEvent.click(screen.getByRole('button',{name:'Submit response'}))
  expect(mocks.submit).toHaveBeenCalledTimes(1)
  window.dispatchEvent(new Event('mela:session-boundary'))
  resolveSubmit!(undefined)
  await waitFor(()=>expect(screen.queryByText('Your response was submitted.')).toBeNull())
  expect(screen.queryByText('Compare careers')).toBeNull()
  expect(mocks.load).toHaveBeenCalledTimes(1)
})
