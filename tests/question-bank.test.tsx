import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import QuestionBank from '../src/pages/QuestionBank'
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), profile: vi.fn(), programs: vi.fn(), rpc: vi.fn() }))
vi.mock('../src/lib/supabase', () => ({ supabase: {
  auth: { getUser: mocks.getUser }, rpc: mocks.rpc,
  from: (table: string) => { const query: any = { select: () => query, eq: () => query, maybeSingle: mocks.profile, order: mocks.programs }; return query },
} }))
beforeEach(() => {
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'learner' } } })
  mocks.profile.mockResolvedValue({ data: { education_stage_key: 'secondary', grade_level: null } })
  mocks.programs.mockResolvedValue({ data: [{ program_key: 'math', subject_title: 'Math' }] })
})
afterEach(cleanup)
it('surfaces network errors and allows subject loading to recover', async () => {
  mocks.getUser.mockRejectedValueOnce(new Error('Offline'))
  render(<QuestionBank onBack={vi.fn()} />)
  await screen.findByRole('alert'); fireEvent.click(screen.getByText('Reload subjects'))
  await screen.findByRole('option', { name: 'Math' })
  expect(screen.queryByRole('alert')).toBeNull()
})
it('blocks blank written answers and locks choices during submission', async () => {
  mocks.rpc.mockResolvedValueOnce({ data: { session_id: 'session', questions: [{ id: 'q1', prompt: 'Explain your answer', choices: null }, { id: 'q2', prompt: 'Choose one', choices: ['A', 'B'] }] } })
  render(<QuestionBank onBack={vi.fn()} />)
  await screen.findByRole('option', { name: 'Math' }); fireEvent.click(screen.getByText('Start practice'))
  const written = await screen.findByLabelText('Explain your answer')
  fireEvent.change(written, { target: { value: '   ' } }); fireEvent.click(screen.getByText('A'))
  expect((screen.getByText('Submit session') as HTMLButtonElement).disabled).toBe(true)
  fireEvent.change(written, { target: { value: 'A real answer' } })
  mocks.rpc.mockReturnValueOnce(new Promise(() => {})); fireEvent.click(screen.getByText('Submit session'))
  expect((screen.getByText('A') as HTMLButtonElement).disabled).toBe(true)
  expect((written as HTMLInputElement).disabled).toBe(true)
  expect(mocks.rpc).toHaveBeenLastCalledWith('submit_mela_question_session', { p_session_id: 'session', p_answers: { q1: 'A real answer', q2: 'A' } })
})
