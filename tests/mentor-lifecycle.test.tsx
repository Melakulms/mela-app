import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import MentorLifecycle from '../src/components/MentorLifecycle'

const mocks = vi.hoisted(() => ({ from: vi.fn(), getUser: vi.fn(), rpc: vi.fn(), complete: vi.fn(), schedule: vi.fn(), cancel: vi.fn() }))
vi.mock('../src/lib/supabase', () => ({ supabase: { from: mocks.from, auth: { getUser: mocks.getUser }, rpc: mocks.rpc } }))
vi.mock('../src/lib/mentorship', () => ({ completeMentorshipSession: mocks.complete, scheduleMentorshipSession: mocks.schedule, cancelMentorshipSession: mocks.cancel }))
beforeEach(() => {
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'mentor' } }, error: null })
  mocks.complete.mockResolvedValue(undefined)
  mocks.from.mockImplementation((table: string) => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ error: null, data: table === 'mentorship_requests'
    ? [{ id: 'request', mentee_id: 'learner', topic: 'Career planning', message: 'Help me choose a field.', preferred_at: null, status: 'accepted', created_at: '2020-01-01' }]
    : [{ id: 'session', request_id: 'request', mentor_id: 'mentor', mentee_id: 'learner', scheduled_at: '2020-01-01T10:00:00Z', duration_min: 30, status: 'scheduled' }] }) }) }) }))
})
afterEach(cleanup)
it('shows the learner request and saves shared follow-up notes on completion', async () => {
  const changed = vi.fn()
  render(<MentorLifecycle onChanged={changed} />)
  await screen.findByText('Help me choose a field.')
  fireEvent.change(screen.getByLabelText('Follow-up notes for the learner (optional)'), { target: { value: 'Compare two training paths.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Mark complete' }))
  await waitFor(() => expect(mocks.complete).toHaveBeenCalledWith('session', 'Compare two training paths.'))
  expect(changed).toHaveBeenCalledTimes(1)
})
it('retains follow-up notes when completion fails', async () => {
  mocks.complete.mockRejectedValueOnce(new Error('Connection failed'))
  render(<MentorLifecycle onChanged={vi.fn()} />)
  await screen.findByText('Help me choose a field.')
  fireEvent.change(screen.getByLabelText('Follow-up notes for the learner (optional)'), { target: { value: 'Keep this feedback.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Mark complete' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Connection failed')
  expect((screen.getByLabelText('Follow-up notes for the learner (optional)') as HTMLTextAreaElement).value).toBe('Keep this feedback.')
})
