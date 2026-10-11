import { expect, it, vi } from 'vitest'
vi.mock('../src/lib/supabase', () => ({ supabase: {} }))
import {
  EMPTY_DISCOVERY_PROFILE,
  rankScholarships,
  rankOpportunities,
  SCHOOL_STAGE_FOR_GRADE,
} from '../src/lib/learner-discovery'
import { audienceAllowsStudentModule, audienceAllowsStudentView } from '../src/lib/feature-audience'

const prefs = {
  ...EMPTY_DISCOVERY_PROFILE,
  interest_fields: ['Computer Science'],
  preferred_study_countries: ['Germany'],
  target_degree_level: 'bachelor' as const,
}

it('keeps grades separate from subject discovery and school stages', () => {
  expect(SCHOOL_STAGE_FOR_GRADE(6)).toBe('school_1_6')
  expect(SCHOOL_STAGE_FOR_GRADE(7)).toBe('school_7_8')
  expect(SCHOOL_STAGE_FOR_GRADE(10)).toBe('school_9_10')
  expect(SCHOOL_STAGE_FOR_GRADE(11)).toBe('school_11_12')
})

it('ranks profile-matched scholarships but does not claim the student is eligible', () => {
  const items = [
    { title: 'Medicine award', fields_of_study: ['Medicine'], study_country: 'France', degree_levels: ['Master'], program_name: 'Medicine', deadline: '2027-02-10' },
    { title: 'Software scholarship', fields_of_study: ['Computer Science'], study_country: 'Germany', degree_levels: ['Bachelor'], program_name: 'Software', deadline: '2027-03-10' },
  ]
  const ordered = rankScholarships(items, prefs)
  expect(ordered[0].item.title).toBe('Software scholarship')
  expect(ordered[0].score).toBeGreaterThan(ordered[1].score)
  expect(ordered[0].reasons).toContain('Matches a field you selected')
  expect(ordered[0].reasons.join(' ')).not.toMatch(/eligible|guarantee|admission/i)
})

it('respects an opt-out of personalized suggestions', () => {
  const items = [
    { title: 'Medicine', fields_of_study: [], study_country: null, degree_levels: [], program_name: null, deadline: null },
    { title: 'Computer Science', fields_of_study: [], study_country: 'Germany', degree_levels: [], program_name: null, deadline: null },
  ]
  expect(rankScholarships(items, { ...prefs, enable_suggestions: false }).map(x => x.item.title))
    .toEqual(['Medicine','Computer Science'])
})

it('ranks opportunity interests without revealing financial modules', () => {
  const items = [
    { title: 'Agriculture workshop', summary: 'Sustainable farming', skills_required: [] },
    { title: 'Computer Science workshop', summary: 'Digital learning', skills_required: [] },
  ]
  expect(rankOpportunities(items, prefs)[0].item.title).toBe('Computer Science workshop')
  expect(audienceAllowsStudentModule('wallet', { stage: 'university', grade: null })).toBe(false)
  expect(audienceAllowsStudentView('earn-work', { stage: 'school_11_12', grade: 12 })).toBe(false)
  expect(audienceAllowsStudentModule('assessments', { stage: 'school_1_6', grade: 5 })).toBe(false)
  expect(audienceAllowsStudentModule('assessments', { stage: 'school_11_12', grade: 11 })).toBe(true)
})
