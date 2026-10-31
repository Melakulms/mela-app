import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import SchoolPracticeHistory from '../src/components/SchoolPracticeHistory'

const mock = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('../src/lib/question-history', () => ({ fetchSchoolPracticeHistory: mock.fetch }))
const programs = [{ program_key: 'grade1-math', subject_title: 'Mathematics' }]

beforeEach(() => {
  vi.resetAllMocks()
  mock.fetch.mockResolvedValue([])
})
afterEach(cleanup)

it('shows server-saved scores and the school subject instead of only visit-local totals', async () => {
  mock.fetch.mockResolvedValueOnce([{
    id: 'one', program_key: 'grade1-math', correct_count: 3, answered_count: 4,
    score_percent: 75, submitted_at: '2026-10-31T12:00:00Z',
  }])
  render(<SchoolPracticeHistory programs={programs} />)
  expect(await screen.findByText('Mathematics')).toBeTruthy()
  expect(screen.getByText('75%')).toBeTruthy()
  expect(screen.getByText(/3\/4 correct/)).toBeTruthy()
  expect(mock.fetch).toHaveBeenCalledWith(['grade1-math'])
})

it('distinguishes no saved results from a history-loading error, then retries', async () => {
  mock.fetch.mockRejectedValueOnce(new Error('Connection failed')).mockResolvedValueOnce([])
  render(<SchoolPracticeHistory programs={programs} />)
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await screen.findByText(/No saved results yet/)
  expect(mock.fetch).toHaveBeenCalledTimes(2)
})
