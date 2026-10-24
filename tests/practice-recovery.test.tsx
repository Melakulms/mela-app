import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import Practice from '../src/pages/Practice'
const mocks = vi.hoisted(() => ({ topics: vi.fn() }))
vi.mock('../src/lib/practice', () => ({ fetchTopics: mocks.topics, startSession: vi.fn(), fetchSessionQuestions: vi.fn(), submitResponse: vi.fn(), completeSession: vi.fn() }))
vi.mock('../src/lib/dashboard', () => ({ fetchDashboard: vi.fn().mockResolvedValue({ practice: { recommendations: [] } }) }))
afterEach(cleanup)
it('offers profile repair and recovers from a topic load failure without reopening the page', async () => {
  mocks.topics.mockRejectedValueOnce(new Error('Complete your education profile to practice.')).mockResolvedValueOnce([{ id: 'topic', subject: 'Study', topic: 'Safe study habits', grade_level: 'career' }])
  const openProfile = vi.fn()
  render(<Practice onBack={vi.fn()} onOpenProfile={openProfile} />)
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: 'Complete education profile' }))
  expect(openProfile).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: 'Retry topics' }))
  await screen.findByText('Safe study habits')
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Open curriculum Question Bank' })).toBeNull()
})
