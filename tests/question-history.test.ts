import { beforeEach, expect, it, vi } from 'vitest'
import { fetchSchoolPracticeHistory } from '../src/lib/question-history'

const mock = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }))
vi.mock('../src/lib/supabase', () => ({
  supabase: { auth: { getUser: mock.getUser }, from: mock.from },
}))

function query(rows: unknown[] | null, error: unknown = null) {
  const q: any = {
    select: vi.fn(), eq: vi.fn(), in: vi.fn(), order: vi.fn(),
    limit: vi.fn().mockResolvedValue({ data: rows, error }),
  }
  q.select.mockReturnValue(q)
  q.eq.mockReturnValue(q)
  q.in.mockReturnValue(q)
  q.order.mockReturnValue(q)
  mock.from.mockReturnValue(q)
  return q
}

beforeEach(() => {
  vi.resetAllMocks()
  mock.getUser.mockResolvedValue({ data: { user: { id: 'learner-1' } }, error: null })
})

it('fetches only completed sessions for the signed-in learner and their enrolled subjects', async () => {
  const rows = [{ id: 'session-1', program_key: 'grade1-math', score_percent: 75, submitted_at: '2026-10-31T12:00:00Z' }]
  const q = query(rows)
  expect(await fetchSchoolPracticeHistory(['grade1-math'])).toEqual(rows)
  expect(mock.from).toHaveBeenCalledWith('mela_question_sessions')
  expect(q.eq).toHaveBeenCalledWith('user_id', 'learner-1')
  expect(q.eq).toHaveBeenCalledWith('status', 'submitted')
  expect(q.in).toHaveBeenCalledWith('program_key', ['grade1-math'])
  expect(q.order).toHaveBeenCalledWith('submitted_at', { ascending: false })
  expect(q.limit).toHaveBeenCalledWith(8)
  expect(q.select).toHaveBeenCalledWith('id,program_key,answered_count,correct_count,score_percent,submitted_at')
})

it('does not make an unrestricted history query when no subjects are enrolled', async () => {
  expect(await fetchSchoolPracticeHistory([])).toEqual([])
  expect(mock.getUser).not.toHaveBeenCalled()
  expect(mock.from).not.toHaveBeenCalled()
})

it('refuses signed-out access to private session history', async () => {
  mock.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
  await expect(fetchSchoolPracticeHistory(['grade1-math'])).rejects.toThrow(/Sign in/)
  expect(mock.from).not.toHaveBeenCalled()
})

it('surfaces database failures rather than claiming that the student has zero results', async () => {
  query(null, new Error('Connection interrupted'))
  await expect(fetchSchoolPracticeHistory(['grade1-math'])).rejects.toThrow(/Connection interrupted/)
})
