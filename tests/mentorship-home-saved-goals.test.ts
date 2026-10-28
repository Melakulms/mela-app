import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({from:vi.fn(),getUser:vi.fn()}))
vi.mock('../src/lib/supabase', () => ({
  supabase: {auth:{getUser:mocks.getUser},from:mocks.from},
}))
import { fetchMentorshipHomeExtras } from '../src/lib/mentorship-home-data'

const saved = {id:'goal-1',title:'Build a programming portfolio',status:'in_progress',target_date:'2026-12-01'}
let goalsFail = false

beforeEach(() => {
  vi.resetAllMocks()
  goalsFail = false
  mocks.getUser.mockResolvedValue({data:{user:{id:'learner-1'}},error:null})
  mocks.from.mockImplementation((table:string) => {
    const data = table === 'student_profiles' ? {goals:['Improve my English'],learning_interests:[],preferred_learning_areas:[]}
      : table === 'profiles' ? {preferred_language:'Amharic'}
      : table === 'mentorship_goals' ? [saved] : []
    const query:any = {
      select: () => query, eq: () => query, in: () => query, order: () => query,
      maybeSingle: () => Promise.resolve({data,error:null}),
      limit: () => Promise.resolve(table==='mentorship_goals' && goalsFail
        ? {data:null,error:{message:'Goal service unavailable'}} : {data,error:null}),
    }
    return query
  })
})

describe('Saved mentorship goals on Home', () => {
  it('includes goals created in My Mentorship #9 in Home and matching signals', async () => {
    const result = await fetchMentorshipHomeExtras()
    expect(result.goals).toEqual(['Build a programming portfolio','Improve my English'])
    expect(result.interests).toContain('Build a programming portfolio')
    expect(result.warnings).toEqual([])
    expect(mocks.from.mock.calls.map(([name])=>name)).toContain('mentorship_goals')
  })
  it('keeps unrelated home information when the saved goals endpoint fails', async () => {
    goalsFail = true
    const result = await fetchMentorshipHomeExtras()
    expect(result.goals).toEqual(['Improve my English'])
    expect(result.preferredLanguage).toBe('Amharic')
    expect(result.warnings.join(' ')).toMatch(/Saved mentorship goals are temporarily unavailable/)
  })
})
