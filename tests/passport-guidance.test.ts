import { describe, expect, it } from 'vitest'
import { buildPassportPathway } from '../src/lib/passport-guidance'
import type { MelaDashboard } from '../src/lib/dashboard'

const passport = (overrides: Partial<MelaDashboard['passport']> = {}) => ({
  badge_count: 0, profile_score: 0, project_count: 0, document_count: 0,
  language_count: 0, education_count: 0, experience_count: 0,
  verified_skill_count: 0, verified_document_count: 0, ...overrides,
})

describe('Career Passport guidance', () => {
  it('uses a safe school pathway for Grade 10 and unknown stages', () => {
    const result = buildPassportPathway({ passport: passport(), skills: [], certificates: [], stageKey: 'secondary', gradeLevel: 10 })
    expect(result.schoolPath).toBe(true)
    expect(result.steps.some((step) => step.destination === 'opportunities')).toBe(false)
    expect(result.steps.some((step) => step.destination === 'practice')).toBe(true)
    expect(buildPassportPathway({ passport: null, skills: null, certificates: null }).schoolPath).toBe(true)
  })
  it('never describes a saved project or unverified skill as verified', () => {
    const result = buildPassportPathway({
      passport: passport({ project_count: 1, verified_skill_count: 0 }),
      skills: [{ id: 's', skill_name: 'Design', level: 'advanced', score: 100, verified: false }],
      certificates: [], stageKey: 'college_tvet',
    })
    expect(result.steps.find((step) => step.id === 'project')?.status).toBe('recorded')
    expect(result.steps.find((step) => step.id === 'verified-skills')?.status).toBe('next')
    expect(result.steps.find((step) => step.id === 'credentials')?.status).toBe('next')
    expect(result.steps.some((step) => step.destination === 'opportunities')).toBe(true)
  })
  it('does not count revoked certificates as valid', () => {
    const result = buildPassportPathway({
      passport: passport(), skills: [],
      certificates: [{ id: 'c', course_id: 'course', course_title: 'Course', certificate_code: 'ABC', credential_type: 'course', issued_at: '2026-01-01', revoked_at: '2026-02-01' }],
      stageKey: 'university',
    })
    expect(result.steps.find((step) => step.id === 'credentials')?.status).toBe('next')
  })
  it('represents failed or missing section data as unavailable, not as zero progress', () => {
    const result = buildPassportPathway({ passport: null, skills: null, certificates: null, stageKey: 'university' })
    expect(result.steps.filter((step) => step.status === 'unavailable').map((step) => step.id)).toEqual(['project', 'verified-skills', 'credentials'])
  })
  it('counts true verified skills and active credentials only', () => {
    const result = buildPassportPathway({
      passport: passport(), skills: [{ id: 'v', skill_name: 'Math', level: null, score: null, verified: true }],
      certificates: [{ id: 'c', course_id: 'c', course_title: 'Course', certificate_code: 'code', credential_type: 'course', issued_at: '2026-01-01', revoked_at: null }],
      stageKey: 'university',
    })
    expect(result.steps.find((step) => step.id === 'verified-skills')?.status).toBe('recorded')
    expect(result.steps.find((step) => step.id === 'credentials')?.status).toBe('recorded')
  })
})
