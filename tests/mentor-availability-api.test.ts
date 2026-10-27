import { beforeEach, expect, it, vi } from 'vitest'
import { addMentorAvailability, removeMentorAvailability, validateAvailability } from '../src/lib/mentor-availability'
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn(), insert: vi.fn(), single: vi.fn(), eq: vi.fn(), delete: vi.fn() }))
vi.mock('../src/lib/supabase', () => ({ supabase: { auth: { getUser: mocks.getUser }, from: mocks.from } }))
beforeEach(() => {
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'signed-in-mentor' } }, error: null })
  const chain = { insert: mocks.insert, select: () => chain, single: mocks.single, eq: mocks.eq, delete: mocks.delete }
  mocks.from.mockReturnValue(chain); mocks.insert.mockReturnValue(chain); mocks.eq.mockReturnValue(chain); mocks.delete.mockReturnValue(chain)
  mocks.single.mockResolvedValue({ data: { id: 'slot' }, error: null })
})
it('validates clock time, weekday, timezone and ordering before writes', async () => {
  expect(() => validateAvailability(1, '10:00', '09:00', 'Africa/Addis_Ababa')).toThrow()
  expect(() => validateAvailability(7, '09:00', '10:00', 'Africa/Addis_Ababa')).toThrow()
  expect(() => validateAvailability(1, '25:00', '26:00', 'Africa/Addis_Ababa')).toThrow()
  expect(() => validateAvailability(1, '09:00', '10:00', 'invalid')).toThrow()
  await expect(addMentorAvailability(1, '10:00', '09:00', 'Africa/Addis_Ababa')).rejects.toThrow()
  expect(mocks.insert).not.toHaveBeenCalled()
})
it('binds inserts and deletion filters to the signed-in mentor', async () => {
  await addMentorAvailability(1, '09:00', '10:00', 'Africa/Addis_Ababa')
  expect(mocks.insert).toHaveBeenCalledWith({ mentor_id: 'signed-in-mentor', weekday: 1, start_time: '09:00', end_time: '10:00', timezone: 'Africa/Addis_Ababa', active: true })
  await removeMentorAvailability('slot')
  expect(mocks.eq).toHaveBeenCalledWith('mentor_id', 'signed-in-mentor')
  expect(mocks.eq).toHaveBeenCalledWith('id', 'slot')
})
it('treats zero-row mutations as failures', async () => {
  mocks.single.mockResolvedValue({ data: null, error: null })
  await expect(removeMentorAvailability('other-user-slot')).rejects.toThrow('not removed')
})
