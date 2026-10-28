import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getUser: vi.fn(),
}))
vi.mock('../src/lib/supabase', () => ({
  supabase: { auth: { getUser: mocks.getUser }, from: mocks.from },
}))

import { loadMentorshipWorkspace } from '../src/lib/mentorship-workspace'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id:'valid-account' } }, error: null })
  mocks.from.mockImplementation((table: string) => ({
    select: () => ({
      eq: () => ({
        order: () => ({
          limit: () => Promise.resolve({
            data: table === 'mentorship_resources'
              ? [{id:'guide-1',title:'Guide',category:'Study',description:'Sample',content:'Published guide'}]
              : [],
            error: null,
          }),
          gt: () => ({
            order: () => ({limit: () => Promise.resolve({data:[],error:null})}),
          }),
        }),
        gt: () => ({
          order: () => ({
            limit: () => Promise.resolve({data:[],error:null}),
          }),
        }),
      }),
      order: () => ({
        limit: () => Promise.resolve({data:[],error:null}),
      }),
    }),
  }))
})

describe('Mentorship workspace subsection isolation', () => {
  it('loads a mentor task workspace without unrelated learner-only resources/groups/goals', async () => {
    const data = await loadMentorshipWorkspace('mentor')
    expect(mocks.from.mock.calls.map(call=>call[0])).toEqual(['mentorship_assignments'])
    expect(data).toEqual({goals:[],assignments:[],submissions:[],feedback:[],resources:[],groups:[]})
  })
  it('loads the resource subsection without requesting private goals or assignments', async () => {
    const data = await loadMentorshipWorkspace('learner',10)
    expect(mocks.from.mock.calls.map(call=>call[0])).toEqual(['mentorship_resources'])
    expect(data.resources).toHaveLength(1)
    expect(data.goals).toEqual([])
    expect(data.assignments).toEqual([])
  })
})
