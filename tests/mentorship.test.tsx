import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Mentorship from '../src/pages/Mentorship'

const mocks = vi.hoisted(() => ({
  fetchVerifiedMentors: vi.fn(),
  fetchMyMentorshipRequests: vi.fn(),
  fetchMyMentorshipSessions: vi.fn(),
  requestMentor: vi.fn(),
  cancelMentorshipRequest: vi.fn(),
  cancelMentorshipSession: vi.fn(),
}))

vi.mock('../src/lib/mentorship', () => ({
  fetchVerifiedMentors: mocks.fetchVerifiedMentors,
  fetchMyMentorshipRequests: mocks.fetchMyMentorshipRequests,
  fetchMyMentorshipSessions: mocks.fetchMyMentorshipSessions,
  requestMentor: mocks.requestMentor,
  cancelMentorshipRequest: mocks.cancelMentorshipRequest,
  cancelMentorshipSession: mocks.cancelMentorshipSession,
}))

const mentor = {
  user_id: 'mentor-1',
  full_name: 'Mentor One',
  headline: 'Software engineer',
  bio: null,
  organization: null,
  years_experience: 5,
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.fetchVerifiedMentors.mockResolvedValue([mentor])
  mocks.fetchMyMentorshipRequests.mockResolvedValue([])
  mocks.fetchMyMentorshipSessions.mockResolvedValue([])
  mocks.requestMentor.mockResolvedValue(undefined)
  mocks.cancelMentorshipRequest.mockResolvedValue(undefined)
  mocks.cancelMentorshipSession.mockResolvedValue(undefined)
})

afterEach(cleanup)

describe('Mentorship', () => {
  it('surfaces load failures and retries without leaving a stale error', async () => {
    mocks.fetchVerifiedMentors.mockRejectedValueOnce(new Error('Network unavailable'))
    render(<Mentorship onBack={vi.fn()} />)

    expect((await screen.findByRole('alert')).textContent).toContain('Network unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Retry mentorship' }))

    expect(await screen.findByText('Mentor One')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('validates the topic and serializes request submission', async () => {
    render(<Mentorship onBack={vi.fn()} />)
    await screen.findByText('Mentor One')

    fireEvent.click(screen.getByRole('button', { name: 'Request mentorship' }))
    const topic = screen.getByLabelText('Topic')
    const send = screen.getByRole('button', { name: 'Send request' }) as HTMLButtonElement
    expect(send.disabled).toBe(true)

    fireEvent.change(topic, { target: { value: 'CV review' } })
    fireEvent.change(screen.getByLabelText('Message (optional)'), { target: { value: 'Please review my CV.' } })
    fireEvent.click(send)
    fireEvent.click(send)

    await waitFor(() => expect(mocks.requestMentor).toHaveBeenCalledTimes(1))
    expect(mocks.requestMentor).toHaveBeenCalledWith('mentor-1', 'CV review', 'Please review my CV.')
    await waitFor(() => expect(mocks.fetchVerifiedMentors).toHaveBeenCalledTimes(2))
  })

  it('allows learners to cancel a pending request and a scheduled session', async () => {
    mocks.fetchMyMentorshipRequests.mockResolvedValue([{ id: 'request-1', mentor_id: 'mentor-1', topic: 'Interview prep', status: 'pending', created_at: '2026-10-02T10:00:00Z' }])
    mocks.fetchMyMentorshipSessions.mockResolvedValue([{ id: 'session-1', request_id: 'request-2', mentor_id: 'mentor-1', mentee_id: 'learner', scheduled_at: '2026-10-04T10:00:00Z', duration_min: 30, status: 'scheduled', call_room_id: null, completed_at: null, cancelled_at: null }])
    render(<Mentorship onBack={vi.fn()} />)

    await screen.findByText('Your sessions')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel session' }))
    await waitFor(() => expect(mocks.cancelMentorshipSession).toHaveBeenCalledWith('session-1', 'Cancelled by learner'))

    await waitFor(() => expect(mocks.fetchMyMentorshipRequests).toHaveBeenCalledTimes(2))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel request' }))
    await waitFor(() => expect(mocks.cancelMentorshipRequest).toHaveBeenCalledWith('request-1'))
  })
})
