import { describe, expect, it, vi } from 'vitest'
vi.mock('../src/lib/supabase', () => ({ supabase: {} }))
import { assignmentProgress, type MentorshipWorkspace } from '../src/lib/mentorship-workspace'

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
