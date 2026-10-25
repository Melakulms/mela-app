import { beforeEach, expect, it, vi } from 'vitest'
import { startSession } from '../src/lib/practice'

const mock = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../src/lib/supabase', () => ({ supabase: { rpc: mock.rpc } }))

beforeEach(() => {
  vi.resetAllMocks()
  mock.rpc.mockResolvedValue({ data: 'session-123', error: null })
})

it('requests all published difficulty levels so a five-question session can use all available questions', async () => {
  expect(await startSession('topic-1')).toBe('session-123')
  expect(mock.rpc).toHaveBeenCalledWith('start_practice_session', {
    p_topic_id: 'topic-1',
    p_mode: 'weak_skill',
    p_question_count: 5,
    p_difficulty: null,
  })
})

it('does not falsely claim a session began after the API rejected it', async () => {
  mock.rpc.mockResolvedValueOnce({ error: { message: 'No published practice questions match this selection' } })
  await expect(startSession('topic-1')).rejects.toMatchObject({ message: 'No published practice questions match this selection' })
})
