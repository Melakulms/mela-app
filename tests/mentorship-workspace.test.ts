import { describe, expect, it, vi } from 'vitest'
vi.mock('../src/lib/supabase', () => ({ supabase: {} }))
import { assignmentProgress, mentorshipActionSummary, validatedAssignmentDue, type MentorshipWorkspace } from '../src/lib/mentorship-workspace'

describe('Mentorship learner assignment progress', () => {
  const empty: MentorshipWorkspace = {
    goals: [], assignments: [], submissions: [], feedback: [], resources: [], groups: [],
  }
  it('does not fabricate progress or verified certificates when no work exists', () => {
    expect(assignmentProgress(empty)).toEqual({ assigned: 0, submitted: 0, reviewed: 0 })
  })
  it('counts genuine related task responses once and excludes unrelated records', () => {
    const records: MentorshipWorkspace = {
      ...empty,
      assignments: [
        { id:'a', request_id:'r', learner_id:'l', mentor_id:'m', title:'Task', instructions:'Detailed work', due_at:null, created_at:'2026-10-27' },
        { id:'b', request_id:'r', learner_id:'l', mentor_id:'m', title:'Task 2', instructions:'Detailed work', due_at:null, created_at:'2026-10-27' },
      ],
      submissions: [
        { id:'s', assignment_id:'a', learner_id:'l', response:'Done', created_at:'2026-10-27' },
        { id:'not-owned', assignment_id:'other', learner_id:'l', response:'Done', created_at:'2026-10-27' },
      ],
      feedback: [
        { id:'f', assignment_id:'a', mentor_id:'m', feedback:'Improved', created_at:'2026-10-27' },
        { id:'f-other', assignment_id:'other', mentor_id:'m', feedback:'Not relevant', created_at:'2026-10-27' },
      ],
    }
    expect(assignmentProgress(records)).toEqual({ assigned:2, submitted:1, reviewed:1 })
  })
})

describe('Mentorship progress and scheduling integrity', () => {
  const empty: MentorshipWorkspace = { goals: [], assignments: [], submissions: [], feedback: [], resources: [], groups: [] }
  it('counts unique assignment IDs rather than duplicate submission or feedback rows', () => {
    const assignment = { id:'a',request_id:'r',mentor_id:'m',learner_id:'l',title:'Task',
      instructions:'Practice the skill',due_at:null,created_at:'2026-10-27' }
    const submitted = {id:'s1',assignment_id:'a',learner_id:'l',response:'Answer',created_at:'2026-10-27'}
    const reviewed = {id:'f1',assignment_id:'a',mentor_id:'m',feedback:'Good',created_at:'2026-10-28'}
    expect(assignmentProgress({...empty, assignments:[assignment], submissions:[submitted,{...submitted,id:'s2'}],
      feedback:[reviewed,{...reviewed,id:'f2'}]})).toEqual({assigned:1,submitted:1,reviewed:1})
  })
  it('distinguishes overdue goals, overdue submissions and feedback pending', () => {
    const data: MentorshipWorkspace = {
      ...empty,
      goals:[
        {id:'g1',learner_id:'l',title:'Practice',detail:'',status:'in_progress',target_date:'2026-10-20',created_at:'2026-10-10'},
        {id:'g2',learner_id:'l',title:'Finished',detail:'',status:'completed',target_date:'2026-10-01',created_at:'2026-09-10'},
        {id:'g3',learner_id:'l',title:'Next',detail:'',status:'planned',target_date:'2026-10-29',created_at:'2026-10-20'},
      ],
      assignments:[
        {id:'old',request_id:'r',mentor_id:'m',learner_id:'l',title:'Old',instructions:'Work',due_at:'2026-10-25T00:00:00Z',created_at:'2026-10-10'},
        {id:'sent',request_id:'r',mentor_id:'m',learner_id:'l',title:'Sent',instructions:'Work',due_at:'2026-10-24T00:00:00Z',created_at:'2026-10-10'},
      ],
      submissions:[{id:'sub',assignment_id:'sent',learner_id:'l',response:'Completed',created_at:'2026-10-25'}],
    }
    expect(mentorshipActionSummary(data,new Date(2026,9,28,12))).toEqual({
      activeGoals:2, overdueGoals:1, assignmentsToSubmit:1, overdueAssignments:1, awaitingFeedback:1,
    })
  })
  it('rejects invalid and past assignment due times before sending them', () => {
    expect(() => validatedAssignmentDue('invalid',Date.parse('2026-10-28T00:00:00Z'))).toThrow(/future date/)
    expect(() => validatedAssignmentDue('2020-01-01',Date.parse('2026-10-28T00:00:00Z'))).toThrow(/future date/)
    expect(validatedAssignmentDue('2099-01-01T10:00:00Z',Date.parse('2026-10-28T00:00:00Z'))).toBe('2099-01-01T10:00:00.000Z')
  })
})
