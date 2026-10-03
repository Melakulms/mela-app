import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import LearnerTools from '../src/pages/LearnerTools'
import AiCareerCoach from '../src/pages/AiCareerCoach'
import EducatorContentReview from '../src/components/EducatorContentReview'
import { goalOptionsForStage } from '../src/lib/transition-goals'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), coach: vi.fn() }))
vi.mock('../src/lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))
vi.mock('../src/lib/coach', () => ({ askCareerCoach: mocks.coach }))
beforeEach(() => vi.resetAllMocks())
afterEach(cleanup)
it.each(['school_1_6', 'school_7_8'])('restricts %s goals to next grade', stage => {
  expect(goalOptionsForStage(stage).map(x => x.value)).toEqual(['next_grade'])
})
it('fails closed for missing or unknown education stages', () => {
  expect(goalOptionsForStage(undefined)).toEqual([])
  expect(goalOptionsForStage('unknown')).toEqual([])
})
it('offers the server-supported choices for older learners', () => {
  expect(goalOptionsForStage('school_9_10').map(x => x.value)).toEqual(['next_grade', 'college_tvet', 'university', 'career_path'])
  for (const stage of ['school_11_12', 'college_tvet', 'university']) {
    expect(new Set(goalOptionsForStage(stage).map(x => x.value))).toEqual(new Set(['college_tvet', 'university', 'career_path', 'scholarship', 'employment', 'entrepreneurship']))
  }
})
it('sends a valid default goal and preserves the draft when the server refuses it', async () => {
  mocks.rpc.mockImplementation(async (name: string) => name === 'get_my_mela_next'
    ? { data: { audience: { stage_key: 'school_1_6' }, steps: [] }, error: null }
    : { error: { message: 'Please retry later' } })
  render(<LearnerTools view="next" onBack={vi.fn()} />)
  const input = await screen.findByLabelText('Goal')
  fireEvent.change(input, { target: { value: 'Complete grade six' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save goal' }))
  await screen.findByText('Please retry later')
  expect(mocks.rpc).toHaveBeenCalledWith('set_my_mela_next_goal', expect.objectContaining({ p_goal_type: 'next_grade', p_goal_title: 'Complete grade six' }))
  expect((input as HTMLInputElement).value).toBe('Complete grade six')
})
it('recovers from a thrown coach request without losing or duplicating the question', async () => {
  mocks.coach.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({ kind: 'reply', reply: { response: 'Practice algebra.' } })
  render(<AiCareerCoach onBack={vi.fn()} />)
  const input = screen.getByLabelText('Question for your career coach') as HTMLInputElement
  fireEvent.change(input, { target: { value: 'What should I learn?' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  await screen.findByRole('alert')
  expect(input.value).toBe('What should I learn?')
  expect(input.disabled).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  await screen.findByText('Practice algebra.')
  expect(screen.getAllByText('What should I learn?')).toHaveLength(1)
  expect(input.value).toBe('')
})
it.each([false, true])('distinguishes access-check failures from denied educator access (throw=%s)', async thrown => {
  if (thrown) mocks.rpc.mockRejectedValueOnce(new Error('Network unavailable'))
  else mocks.rpc.mockResolvedValueOnce({ error: { message: 'Network unavailable' } })
  mocks.rpc.mockResolvedValueOnce({ data: false, error: null })
  render(<EducatorContentReview />)
  expect((await screen.findByRole('alert')).textContent).toContain('Network unavailable')
  expect(screen.queryByText('Reviewer access is not active for this account.')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Retry access check' }))
  await screen.findByText('Reviewer access is not active for this account.')
  await waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(2))
})
