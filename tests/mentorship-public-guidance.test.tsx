// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ from: vi.fn(), limit: vi.fn() }))
vi.mock('../src/lib/supabase', () => ({
  supabase: { from: mocks.from },
}))
import MentorshipGuidanceResources from '../src/components/MentorshipGuidanceResources'

const published = {
  id: 'guide-one', title: 'Prepare for a mentor session', category: 'preparation',
  description: 'Write your questions', content: 'Do not share passwords.', status: 'published',
}
const unpublished = { ...published, id: 'draft-one', title: 'Staff draft', status: 'draft' }

beforeEach(() => {
  vi.resetAllMocks()
  window.localStorage.clear()
  mocks.from.mockReturnValue({
    select: () => ({ eq: () => ({ order: () => ({ limit: mocks.limit }) }) }),
  })
  mocks.limit.mockResolvedValue({ data: [published], error: null })
})
afterEach(cleanup)

it('reads only published guidance and renders text safely, with no booking action', async () => {
  render(<MentorshipGuidanceResources />)
  expect(mocks.from).toHaveBeenCalledWith('mentorship_resources')
  const title = await screen.findByText('Prepare for a mentor session')
  fireEvent.click(title)
  expect(screen.getByText('Do not share passwords.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Request mentorship' })).toBeNull()
})

it('excludes any unexpected unpublished entries even if returned by a misconfigured provider', async () => {
  mocks.limit.mockResolvedValue({ data: [published, unpublished], error: null })
  render(<MentorshipGuidanceResources />)
  await screen.findByText('Prepare for a mentor session')
  expect(screen.queryByText('Staff draft')).toBeNull()
  const cached = JSON.parse(window.localStorage.getItem('mela-public-mentorship-guidance-v1') || '[]')
  expect(cached).toHaveLength(1)
  expect(cached[0].status).toBe('published')
})

it('serves only public cached guidance when offline and supports retry', async () => {
  window.localStorage.setItem('mela-public-mentorship-guidance-v1', JSON.stringify([published]))
  mocks.limit.mockRejectedValueOnce(new Error('Network unavailable'))
  mocks.limit.mockResolvedValue({ data: [published], error: null })
  render(<MentorshipGuidanceResources />)
  expect(await screen.findByText(/Showing saved public guides/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Refresh mentorship learning resources' }))
  await waitFor(() => expect(mocks.limit).toHaveBeenCalledTimes(2))
  await waitFor(() => expect(screen.queryByText(/Showing saved public guides/)).toBeNull())
})
