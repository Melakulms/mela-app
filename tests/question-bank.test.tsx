import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import QuestionBank from '../src/pages/QuestionBank'
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), profile: vi.fn(), programs: vi.fn(), rpc: vi.fn() }))
vi.mock('../src/lib/supabase', () => ({ supabase: {
  auth: { getUser: mocks.getUser }, rpc: mocks.rpc,
  from: () => { const query: any = { select: () => query, eq: () => query, maybeSingle: mocks.profile, order: mocks.programs }; return query },
} }))
const detail = { program: { mastery_count: 20, review_required_count: 10 }, chapters: [{ chapter_id: 'c1', chapter_title: 'Algebra', mastery_count: 20, topics: [{ topic_id: 't1', topic_title: 'Equations', mastery_count: 20 }] }] }
beforeEach(() => {
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'learner' } } })
  mocks.profile.mockResolvedValue({ data: { education_stage_key: 'school_7_8', grade_level: 8 } })
  mocks.programs.mockResolvedValue({ data: [{ program_key: 'math', subject_title: 'Math', track_key: 'common' }] })
  mocks.rpc.mockImplementation(async (name: string) => name === 'get_question_subject_detail_v18' ? { data: detail } : { data: { session_id: 'session', questions: [{ id: 'q1', prompt: 'Calculate', choices: [], question_type: 'numeric' }, { id: 'q2', prompt: 'Choose one', choices: [{ id: 'A', text: 'First choice' }, { id: 'B', text: 'Second choice' }], question_type: 'single_choice' }] } })
})
afterEach(cleanup)
it('surfaces network errors and reloads subjects', async () => {
  mocks.getUser.mockRejectedValueOnce(new Error('Offline'))
  render(<QuestionBank onBack={vi.fn()} />)
  await screen.findByRole('alert'); fireEvent.click(screen.getByText('Reload subjects'))
  await screen.findByRole('option', { name: 'Math' })
  expect(screen.queryByRole('alert')).toBeNull()
})
it('requires a school grade instead of exposing all grades', async () => {
  mocks.profile.mockResolvedValue({ data: { education_stage_key: 'school_7_8', grade_level: null } })
  render(<QuestionBank onBack={vi.fn()} />)
  expect((await screen.findByRole('alert')).textContent).toContain('school grade')
  expect(mocks.programs).not.toHaveBeenCalled()
})
it('filters curriculum and submits typed answers; retry preserves answers and shows real counts', async () => {
  render(<QuestionBank onBack={vi.fn()} />)
  await screen.findByRole('option', { name: 'Algebra (20 validated)' })
  fireEvent.change(screen.getByLabelText('Chapter'), { target: { value: 'c1' } })
  fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 't1' } })
  fireEvent.change(screen.getByLabelText('Difficulty'), { target: { value: '2' } })
  fireEvent.click(screen.getByText('Start practice'))
  const written = await screen.findByLabelText('Calculate')
  expect(mocks.rpc).toHaveBeenCalledWith('start_mela_filtered_question_session_v18', { p_program_key: 'math', p_chapter_id: 'c1', p_topic_id: 't1', p_count: 10, p_difficulty: 2, p_practice_mode: 'mastery' })
  expect((written as HTMLInputElement).type).toBe('number')
  fireEvent.click(screen.getByText('First choice'))
  expect((screen.getByText('Submit session') as HTMLButtonElement).disabled).toBe(true)
  fireEvent.change(written, { target: { value: '42' } })
  mocks.rpc.mockResolvedValueOnce({ error: { message: 'Network interrupted' } })
  fireEvent.click(screen.getByText('Submit session'))
  await screen.findByText('Network interrupted')
  expect((written as HTMLInputElement).value).toBe('42')
  mocks.rpc.mockResolvedValueOnce({ data: { score_percent: 100, correct_count: 2, answered_count: 2, details: [{ question_id: 'q1', correct: true, rationale: 'Explanation' }] } })
  fireEvent.click(screen.getByText('Submit session'))
  await screen.findByText('Question Bank Result')
  expect(mocks.rpc).toHaveBeenLastCalledWith('submit_mela_question_session_v12', { p_session_id: 'session', p_answers: [{ question_id: 'q1', response: '42' }, { question_id: 'q2', response: 'A' }] })
  expect(screen.getByText('Explanation')).toBeTruthy()
  await waitFor(() => expect(screen.getByText('2')).toBeTruthy())
})
