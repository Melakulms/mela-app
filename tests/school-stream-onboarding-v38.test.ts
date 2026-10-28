import { beforeEach, describe, expect, it, vi } from 'vitest'

// Fake data client only: no requests are made to a real MELA account.
const mock = vi.hoisted(() => ({
  getUser: vi.fn(), readProfile: vi.fn(), readStudent: vi.fn(), rpc: vi.fn(),
  calls: [] as string[],
}))
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: { getUser: mock.getUser },
    rpc: (...args: unknown[]) => mock.rpc(...args),
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => table === 'profiles' ? mock.readProfile() : mock.readStudent(),
        }),
      }),
    }),
  },
}))
import { saveMyEducationProfile } from '../src/lib/education-profile-save'

const base = {
  stageKey: 'school_11_12',
  grade: 11,
  school: 'School',
  trackKey: 'natural_sciences',
  subjects: ['biology', 'english'],
  interests: [],
  goals: [],
  preferredAreas: [],
  skills: [],
}

beforeEach(() => {
  vi.resetAllMocks()
  mock.calls = []
  mock.getUser.mockResolvedValue({ data: { user: { id: 'staging-test-user' } }, error: null })
  mock.readProfile
    .mockResolvedValueOnce({ data: {
      role: 'student',
      full_name: 'Staging Test User',
      preferred_language: 'en',
      education_stage_key: 'school_11_12',
      grade_level: 11,
      role_selected_at: '2026-10-25T00:00:00Z',
    }, error: null })
    .mockResolvedValueOnce({ data: {
      education_stage_key: 'school_11_12', grade_level: 11,
      education_onboarding_completed: true,
    }, error: null })
  mock.readStudent.mockResolvedValue({ data: {
    subjects: ['biology', 'english'],
    academic_track_key: 'natural_sciences',
  }, error: null })
  mock.rpc.mockImplementation(async (name: string) => {
    mock.calls.push(name)
    return { data: name === 'set_my_academic_stream_v38' ? 'natural_sciences' : {}, error: null }
  })
})

describe('staging v38 senior school profile onboarding', () => {
  it('locks the senior stream before completing the school subject profile', async () => {
    await saveMyEducationProfile(base)
    expect(mock.calls).toEqual(['set_my_academic_stream_v38', 'complete_my_profile_v37'])
    expect(mock.rpc).toHaveBeenCalledWith('set_my_academic_stream_v38', {
      p_track_key: 'natural_sciences',
    })
  })

  it('does not silently default an invalid senior academic stream', async () => {
    await expect(saveMyEducationProfile({ ...base, trackKey: '' }))
      .rejects.toThrow(/Choose your actual Grades 11–12 academic stream/)
    expect(mock.calls).toEqual([])
  })

  it('halts onboarding when server rejects an attempted stream change', async () => {
    mock.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'P0001', message: 'academic stream is locked' },
    })
    await expect(saveMyEducationProfile(base)).rejects.toThrow(/academic stream is locked/)
    expect(mock.calls).toEqual([])
    expect(mock.rpc).not.toHaveBeenCalledWith('complete_my_profile_v37', expect.anything())
  })

  it('detects a post-save stream mismatch instead of silently opening another stream', async () => {
    mock.readStudent.mockResolvedValueOnce({ data: {
      subjects: ['biology', 'english'],
      academic_track_key: 'social_sciences',
    }, error: null })
    await expect(saveMyEducationProfile(base)).rejects.toThrow(/saved academic stream/)
  })

  it('does not require a senior stream RPC for school Grades 1–10', async () => {
    mock.readProfile.mockReset()
    mock.readProfile
      .mockResolvedValueOnce({ data: {
        role: 'student', full_name: 'Staging Test User', preferred_language: 'en',
        education_stage_key: 'school_1_6', grade_level: 1,
        role_selected_at: '2026-10-25T00:00:00Z',
      }, error: null })
      .mockResolvedValueOnce({ data: {
        education_stage_key: 'school_1_6', grade_level: 1,
        education_onboarding_completed: true,
      }, error: null })
    mock.readStudent.mockResolvedValue({ data: { subjects: ['mathematics'], academic_track_key: 'common' }, error: null })
    await saveMyEducationProfile({ ...base, stageKey: 'school_1_6', grade: 1, trackKey: null, subjects: ['mathematics'] })
    expect(mock.calls).toEqual(['complete_my_profile_v37'])
  })
})
