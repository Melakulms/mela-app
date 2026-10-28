import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks=vi.hoisted(()=>({
  getUser:vi.fn(),from:vi.fn(),insert:vi.fn(),select:vi.fn(),
}))
vi.mock('../src/lib/supabase',()=>({supabase:{
  auth:{getUser:mocks.getUser},from:mocks.from,
}}))
import {
  addMentorshipGoal,createMentorshipAssignment,submitMentorshipAssignment,
  sendMentorshipFeedback,validatedGoalTargetDate,assignmentProgress,
  type MentorshipWorkspace,
} from '../src/lib/mentorship-workspace'

beforeEach(()=>{
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({data:{user:{id:'signed-in-account'}},error:null})
  mocks.select.mockResolvedValue({data:[{id:'saved-id'}],error:null})
  mocks.insert.mockImplementation(()=>({select:mocks.select}))
  mocks.from.mockImplementation(()=>({insert:mocks.insert}))
})

describe('Mentorship persistence confirmations',()=>{
  it('saves a correctly scoped personal learning goal and demands a database-confirmed row',async()=>{
    await addMentorshipGoal('  Weekly mathematics  ','Practise my exercises','2026-12-31')
    expect(mocks.from).toHaveBeenCalledWith('mentorship_goals')
    expect(mocks.insert).toHaveBeenCalledWith({
      learner_id:'signed-in-account',title:'Weekly mathematics',
      detail:'Practise my exercises',target_date:'2026-12-31',
    })
    expect(mocks.select).toHaveBeenCalledWith('id')
    mocks.select.mockResolvedValueOnce({data:[],error:null})
    await expect(addMentorshipGoal('Weekly mathematics','','')).rejects.toThrow(/not confirmed/)
  })
  it('rejects invalid goal dates or oversized plans before calling the database',async()=>{
    await expect(addMentorshipGoal('Study plan','','2026-02-31')).rejects.toThrow(/valid target date/)
    await expect(addMentorshipGoal('Study plan','','not-a-date')).rejects.toThrow(/valid target date/)
    await expect(addMentorshipGoal('Study plan','x'.repeat(2001),'')).rejects.toThrow(/2000/)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(validatedGoalTargetDate('')).toBeNull()
    expect(validatedGoalTargetDate('2026-12-31')).toBe('2026-12-31')
  })
  it('requires verified persistence of a mentor assignment and does not claim an unconfirmed task',async()=>{
    await createMentorshipAssignment('accepted-request','learner-1','Portfolio exercise','Create and review a draft portfolio','2099-01-01T10:00')
    expect(mocks.from).toHaveBeenCalledWith('mentorship_assignments')
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      request_id:'accepted-request',mentor_id:'signed-in-account',learner_id:'learner-1',
      title:'Portfolio exercise',due_at:expect.any(String),
    }))
    mocks.select.mockResolvedValueOnce({data:[],error:null})
    await expect(createMentorshipAssignment('accepted-request','learner-1','Portfolio exercise','Create and review a draft portfolio')).rejects.toThrow(/not confirmed/)
  })
  it('requires confirmed learner responses and mentor feedback',async()=>{
    await submitMentorshipAssignment('assignment-1','A worked example')
    expect(mocks.from).toHaveBeenCalledWith('mentorship_submissions')
    expect(mocks.insert).toHaveBeenCalledWith({
      assignment_id:'assignment-1',learner_id:'signed-in-account',response:'A worked example',
    })
    mocks.select.mockResolvedValueOnce({data:[],error:null})
    await expect(submitMentorshipAssignment('assignment-1','Answer')).rejects.toThrow(/not confirmed/)
    await sendMentorshipFeedback('assignment-1','Review the second paragraph')
    expect(mocks.from).toHaveBeenCalledWith('mentorship_feedback')
    expect(mocks.insert).toHaveBeenCalledWith({
      assignment_id:'assignment-1',mentor_id:'signed-in-account',feedback:'Review the second paragraph',
    })
    mocks.select.mockResolvedValueOnce({data:[],error:null})
    await expect(sendMentorshipFeedback('assignment-1','Good work')).rejects.toThrow(/not confirmed/)
  })
  it('does not count disconnected feedback as progress without a learner submission',()=>{
    const assignment={id:'a',request_id:'r',mentor_id:'m',learner_id:'l',title:'Task',instructions:'Practice',
      due_at:null,created_at:'2026-10-27'}
    const empty:MentorshipWorkspace={goals:[],assignments:[assignment],submissions:[],
      feedback:[{id:'f',assignment_id:'a',mentor_id:'m',feedback:'Review',created_at:'2026-10-27'}],
      resources:[],groups:[]}
    expect(assignmentProgress(empty)).toEqual({assigned:1,submitted:0,reviewed:0})
  })
})
