import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
vi.mock('../src/components/MentorshipLearningWorkspace', () => ({ default: () => null }))
vi.mock('../src/components/MentorApplication', () => ({ default: () => null }))
vi.mock('../src/components/MentorshipAdultEligibility', () => ({ default: () => null }))
import Mentorship from '../src/pages/Mentorship'

const mocks = vi.hoisted(() => ({
  fetchVerifiedMentors: vi.fn(),
  fetchMyMentorshipRequests: vi.fn(),
  fetchMyMentorshipSessions: vi.fn(),
  requestMentor: vi.fn(),
  cancelMentorshipRequest: vi.fn(),
  cancelMentorshipSession: vi.fn(),
  rateMentorshipSession: vi.fn(),
}))

vi.mock('../src/lib/mentorship', () => ({
  fetchVerifiedMentors: mocks.fetchVerifiedMentors,
  fetchMyMentorshipRequests: mocks.fetchMyMentorshipRequests,
  fetchMyMentorshipSessions: mocks.fetchMyMentorshipSessions,
  requestMentor: mocks.requestMentor,
  cancelMentorshipRequest: mocks.cancelMentorshipRequest,
  cancelMentorshipSession: mocks.cancelMentorshipSession,
  rateMentorshipSession: mocks.rateMentorshipSession,
}))

const mentor = {
  user_id: 'mentor-1',
  full_name: 'Mentor One',
  headline: 'Software engineer',
  bio: null,
  organization: null,
  years_experience: 5,
  rating_average: 4.75,
  rating_count: 8,
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.fetchVerifiedMentors.mockResolvedValue([mentor])
  mocks.fetchMyMentorshipRequests.mockResolvedValue([])
  mocks.fetchMyMentorshipSessions.mockResolvedValue([])
  mocks.requestMentor.mockResolvedValue(undefined)
  mocks.cancelMentorshipRequest.mockResolvedValue(undefined)
  mocks.cancelMentorshipSession.mockResolvedValue(undefined)
  mocks.rateMentorshipSession.mockResolvedValue(undefined)
})

afterEach(cleanup)

describe('Mentorship', () => {
  it('keeps unverified university adult learners out of direct mentorship requests',async()=>{
    render(<Mentorship stageKey="university" onBack={vi.fn()}/>)
    await screen.findByText('Mentor One')
    expect(screen.getByText('Verify adult eligibility above before requesting')).toBeTruthy()
    expect(screen.queryByRole('button',{name:'Request mentorship'})).toBeNull()
    expect(mocks.requestMentor).not.toHaveBeenCalled()
  })

  it('explains grade restrictions and opens the safety flow without offering a request', async () => {
    const safety = vi.fn()
    render(<Mentorship stageKey="school_9_10" onBack={vi.fn()} onOpenSafety={safety} />)
    await screen.findByText('Mentor One')
    expect(screen.queryByRole('button', { name: 'Request mentorship' })).toBeNull()
    expect(screen.getByText(/Direct mentorship is not enabled for Grades 1–10/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Safety, guardian consent & reporting' }))
    expect(safety).toHaveBeenCalledTimes(1)
    expect(mocks.requestMentor).not.toHaveBeenCalled()
  })

  it('sends the preferred time and retains the request draft after a failure', async () => {
    mocks.requestMentor.mockRejectedValueOnce(new Error('Try again'))
    render(<Mentorship onBack={vi.fn()} />)
    await screen.findByText('Mentor One')
    fireEvent.click(screen.getByRole('button', { name: 'Request mentorship' }))
    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'Study plan' } })
    fireEvent.change(screen.getByLabelText('Preferred session time (optional)'), { target: { value: '2099-11-01T10:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Try again')
    expect((screen.getByLabelText('Topic') as HTMLInputElement).value).toBe('Study plan')
    expect((screen.getByLabelText('Preferred session time (optional)') as HTMLInputElement).value).toBe('2099-11-01T10:00')
    expect(mocks.requestMentor).toHaveBeenCalledWith('mentor-1', 'Study plan', '', '2099-11-01T10:00')
  })

  it('shows follow-up notes and allows a new request after a completed session', async () => {
    mocks.fetchMyMentorshipRequests.mockResolvedValue([{ id: 'request-1', mentor_id: 'mentor-1', topic: 'CV review', status: 'accepted', created_at: '2026-10-02T10:00:00Z' }])
    mocks.fetchMyMentorshipSessions.mockResolvedValue([{ id: 'session-1', request_id: 'request-1', mentor_id: 'mentor-1', mentee_id: 'learner', scheduled_at: '2026-10-04T10:00:00Z', duration_min: 30, status: 'completed', rating: 5, rating_comment: null, notes: 'Revise the project section of your CV.' }])
    render(<Mentorship onBack={vi.fn()} />)
    await screen.findByText('Mentor One')
    expect(screen.getByText(/Revise the project section of your CV/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Request mentorship' })).toBeTruthy()
  })

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
    mocks.fetchMyMentorshipSessions.mockResolvedValue([{ id: 'session-1', request_id: 'request-2', mentor_id: 'mentor-1', mentee_id: 'learner', scheduled_at: '2026-10-04T10:00:00Z', duration_min: 30, status: 'scheduled', call_room_id: null, completed_at: null, cancelled_at: null, rating: null, rating_comment: null }])
    render(<Mentorship onBack={vi.fn()} />)

    await screen.findByText('Your sessions')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel session' }))
    await waitFor(() => expect(mocks.cancelMentorshipSession).toHaveBeenCalledWith('session-1', 'Cancelled by learner'))

    await waitFor(() => expect(mocks.fetchMyMentorshipRequests).toHaveBeenCalledTimes(2))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel request' }))
    await waitFor(() => expect(mocks.cancelMentorshipRequest).toHaveBeenCalledWith('request-1'))
  })

  it('shows mentor rating summaries and submits one rating for a completed session', async () => {
    mocks.fetchMyMentorshipSessions
      .mockResolvedValueOnce([{ id: 'session-2', request_id: 'request-3', mentor_id: 'mentor-1', mentee_id: 'learner', scheduled_at: '2026-10-03T10:00:00Z', duration_min: 45, status: 'completed', call_room_id: null, completed_at: '2026-10-03T10:45:00Z', cancelled_at: null, rating: null, rating_comment: null }])
      .mockResolvedValueOnce([{ id: 'session-2', request_id: 'request-3', mentor_id: 'mentor-1', mentee_id: 'learner', scheduled_at: '2026-10-03T10:00:00Z', duration_min: 45, status: 'completed', call_room_id: null, completed_at: '2026-10-03T10:45:00Z', cancelled_at: null, rating: 4, rating_comment: 'Helpful feedback.' }])

    render(<Mentorship onBack={vi.fn()} />)
    expect(await screen.findByText('4.75/5 · 8 ratings')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Rate this completed session'), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText('Rating comment (optional)'), { target: { value: 'Helpful feedback.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit rating' }))

    await waitFor(() => expect(mocks.rateMentorshipSession).toHaveBeenCalledTimes(1))
    expect(mocks.rateMentorshipSession).toHaveBeenCalledWith('session-2', 4, 'Helpful feedback.')
    expect(await screen.findByText('Rated 4/5 · Helpful feedback.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Submit rating' })).toBeNull()
  })
})

