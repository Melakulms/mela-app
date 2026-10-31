import { beforeEach, expect, it, vi } from 'vitest'
import { fetchSavedScholarshipIds, setScholarshipTaskCompleted, toggleSavedScholarship } from '../src/lib/scholarships'

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }))
vi.mock('../src/lib/supabase', () => ({
  supabase: { auth: { getUser: mocks.getUser }, from: mocks.from },
}))

const ownerId = '11111111-1111-4111-8111-111111111111'
const offerId = '22222222-2222-4222-8222-222222222222'

function dbQuery(response: { data?: unknown; error?: unknown }) {
  const result = { data: response.data ?? null, error: response.error ?? null }
  const query: any = {
    select: vi.fn(), eq: vi.fn(), insert: vi.fn(), delete: vi.fn(),
    update: vi.fn(), single: vi.fn().mockResolvedValue(result),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.insert.mockReturnValue(query)
  query.delete.mockReturnValue(query)
  query.update.mockReturnValue(query)
  mocks.from.mockReturnValue(query)
  return query
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: ownerId } }, error: null })
})

it('saves a scholarship with its required owner ID and a returned database receipt', async () => {
  const query = dbQuery({ data: { id: 'bookmark-id', opportunity_id: offerId } })
  await toggleSavedScholarship(offerId, false)
  expect(mocks.from).toHaveBeenCalledWith('scholarship_saved')
  expect(query.insert).toHaveBeenCalledWith({ user_id: ownerId, opportunity_id: offerId })
  expect(query.select).toHaveBeenCalledWith('id,opportunity_id')
  expect(query.single).toHaveBeenCalledOnce()
})

it('rejects an insert when PostgREST does not return the saved row', async () => {
  dbQuery({ data: null })
  await expect(toggleSavedScholarship(offerId, false)).rejects.toThrow(/not confirmed as saved/)
})

it('removes only the signed-in user bookmark, requiring a returned deletion row', async () => {
  const query = dbQuery({ data: [{ id: 'bookmark-id' }] })
  await toggleSavedScholarship(offerId, true)
  expect(query.delete).toHaveBeenCalledOnce()
  expect(query.eq).toHaveBeenCalledWith('user_id', ownerId)
  expect(query.eq).toHaveBeenCalledWith('opportunity_id', offerId)
})

it('reports an absent bookmark instead of claiming a successful removal', async () => {
  dbQuery({ data: [] })
  await expect(toggleSavedScholarship(offerId, true)).rejects.toThrow(/not removed/)
})

it('checks bookmark ownership on read', async () => {
  const query = dbQuery({ data: [{ opportunity_id: offerId }] })
  expect(await fetchSavedScholarshipIds()).toEqual(new Set([offerId]))
  expect(query.eq).toHaveBeenCalledWith('user_id', ownerId)
})

it('confirms that an owned checklist task actually changed', async () => {
  const query = dbQuery({ data: { id: 'task-one', completed: true } })
  await setScholarshipTaskCompleted('task-one', true)
  expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ completed: true, completed_at: expect.any(String) }))
  expect(query.eq).toHaveBeenCalledWith('user_id', ownerId)
  expect(query.select).toHaveBeenCalledWith('id,completed')
})

it('does not show success for a zero-row or mismatched checklist update', async () => {
  dbQuery({ data: null })
  await expect(setScholarshipTaskCompleted('task-one', true)).rejects.toThrow(/not confirmed/)
  dbQuery({ data: { id: 'task-two', completed: true } })
  await expect(setScholarshipTaskCompleted('task-one', true)).rejects.toThrow(/not confirmed/)
})

it('does not attempt private writes if the user is signed out', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
  await expect(toggleSavedScholarship(offerId, false)).rejects.toThrow(/sign in again/)
  await expect(setScholarshipTaskCompleted('task-one', true)).rejects.toThrow(/sign in again/)
  expect(mocks.from).not.toHaveBeenCalled()
})
