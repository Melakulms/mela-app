import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
}))
vi.mock('../src/lib/supabase', () => ({
  supabase: { auth:{getUser:mocks.getUser}, from:mocks.from },
}))
import { updateMentorshipGoal } from '../src/lib/mentorship-workspace'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({data:{user:{id:'signed-in-learner'}},error:null})
  const chain = {
    update:mocks.update,
    eq:mocks.eq,
    select:mocks.select,
  }
  mocks.from.mockReturnValue(chain)
  mocks.update.mockReturnValue(chain)
  mocks.eq.mockReturnValue(chain)
  mocks.select.mockResolvedValue({data:[{id:'own-goal'}],error:null})
})

describe('Private mentorship goal editor', () => {
  it('updates only the authenticated learner ID and confirms a returned row', async () => {
    await updateMentorshipGoal('own-goal','  Revised learning goal  ',' Weekly assignments ','2026-12-15')
    expect(mocks.from).toHaveBeenCalledWith('mentorship_goals')
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      title:'Revised learning goal', detail:'Weekly assignments', target_date:'2026-12-15',
    }))
    expect(mocks.eq).toHaveBeenCalledWith('id','own-goal')
    expect(mocks.eq).toHaveBeenCalledWith('learner_id','signed-in-learner')
    expect(mocks.select).toHaveBeenCalledWith('id')
  })
  it('does not falsely report success if RLS or ID matching updates nothing', async () => {
    mocks.select.mockResolvedValue({data:[],error:null})
    await expect(updateMentorshipGoal('another-goal','New goal','','')).rejects.toThrow(/not saved/)
  })
  it('rejects invalid calendar dates without writing to the database', async () => {
    await expect(updateMentorshipGoal('own-goal','Goal name','','2026-02-31')).rejects.toThrow(/valid target date/)
    await expect(updateMentorshipGoal('own-goal','Goal name','','2026-13-01')).rejects.toThrow(/valid target date/)
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('requires a real authenticated user before writing', async () => {
    mocks.getUser.mockResolvedValue({data:{user:null},error:null})
    await expect(updateMentorshipGoal('any-goal','Goal name','','')).rejects.toThrow(/sign in/)
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
