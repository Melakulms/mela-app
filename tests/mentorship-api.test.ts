import { beforeEach, expect, it, vi } from 'vitest'
import { requestMentor, completeMentorshipSession } from '../src/lib/mentorship'
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), insert: vi.fn(), rpc: vi.fn(), from: vi.fn() }))
vi.mock('../src/lib/supabase', () => ({ supabase: { auth: { getUser: mocks.getUser }, from: mocks.from, rpc: mocks.rpc } }))
beforeEach(() => {
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'learner' } }, error: null })
  mocks.from.mockReturnValue({ insert: mocks.insert })
  mocks.insert.mockResolvedValue({ error: null })
  mocks.rpc.mockResolvedValue({ error: null })
})
it('rejects invalid and past preferred times before writing a request', async () => {
  for (const time of ['invalid', '2000-01-01T10:00:00Z']) {
    await expect(requestMentor('mentor', 'CV review', '', time)).rejects.toThrow('future preferred time')
  }
  expect(mocks.insert).not.toHaveBeenCalled()
})
it('saves the preferred time in UTC with authenticated learner ownership', async () => {
  await requestMentor('mentor', ' CV review ', ' Please help ', '2099-11-01T10:00:00+03:00')
  expect(mocks.insert).toHaveBeenCalledWith({ mentor_id: 'mentor', mentee_id: 'learner', topic: 'CV review', message: 'Please help', status: 'pending', preferred_at: '2099-11-01T07:00:00.000Z' })
})
it('rejects oversized follow-up notes without calling the completion RPC', async () => {
  await expect(completeMentorshipSession('session', 'a'.repeat(2001))).rejects.toThrow('2000')
  expect(mocks.rpc).not.toHaveBeenCalled()
})
