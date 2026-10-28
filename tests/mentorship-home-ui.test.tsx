import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import MentorshipHome from '../src/components/MentorshipHome'
import type { Mentor, MentorshipSession } from '../src/lib/mentorship'

const mocks = vi.hoisted(() => ({ load: vi.fn() }))
vi.mock('../src/lib/mentorship-home-data', () => ({ fetchMentorshipHomeExtras: mocks.load }))

const mentor: Mentor = {
  user_id: 'mentor-1', full_name: 'Verified Engineer', headline: 'Software engineering',
  bio: 'Guidance in AI', organization: 'University', years_experience: 4,
  rating_average: 4.5, rating_count: 6, expertise: ['AI careers'],
  languages: ['Amharic'], availability: [],
}
const session: MentorshipSession = {
  id: 'session-1', request_id: 'request-1', mentor_id: 'mentor-1', mentee_id: 'learner',
  scheduled_at: '2099-11-01T10:00:00Z', duration_min: 30, status: 'scheduled',
  call_room_id: null, completed_at: null, cancelled_at: null, rating: null, rating_comment: null,
}

beforeEach(() => {
  mocks.load.mockReset()
  mocks.load.mockResolvedValue({
    goals: ['Complete my programming portfolio'], interests: ['AI'], preferredLanguage: 'Amharic',
    updates: [{ id: 'u1', title: 'Session reminder', body: 'Your mentor replied', created_at: '2026-10-27' }],
    announcements: [{ id: 'a1', title: 'Career event', body: 'Public workshop', created_at: '2026-10-27', audience: 'all' }],
    warnings: [],
  })
})
afterEach(cleanup)

describe('Mentorship Home UI', () => {
  it('shows real upcoming sessions, saved goals, verified recommendations and announcements', async () => {
    render(<MentorshipHome mentors={[mentor]} requests={[]} sessions={[session]} revision={0} />)
    expect(await screen.findByText('Complete my programming portfolio')).toBeTruthy()
    expect(screen.getByText('Verified Engineer')).toBeTruthy()
    expect(screen.getByText('Career event')).toBeTruthy()
    expect(screen.getByText('Session reminder')).toBeTruthy()
  })

  it('does not offer mentor suggestions to a restricted learner', async () => {
    render(<MentorshipHome mentors={[mentor]} requests={[]} sessions={[]} stageKey="school_9_10" revision={0} />)
    expect(await screen.findByText(/Direct mentorship is not available for your school stage/)).toBeTruthy()
    expect(screen.queryByText('Verified Engineer')).toBeNull()
  })

  it('keeps session information visible when personalized data fails', async () => {
    mocks.load.mockRejectedValueOnce(new Error('Offline'))
    render(<MentorshipHome mentors={[mentor]} requests={[]} sessions={[session]} revision={0} />)
    expect(await screen.findByText(/Your personal home details are unavailable/)).toBeTruthy()
    expect(screen.getByText('Mentorship session')).toBeTruthy()
  })
})


it('pauses all personalized recommendations if private request history cannot be verified', async () => {
  render(<MentorshipHome mentors={[mentor]} requests={[]} requestsAvailable={false}
    sessions={[]} stageKey="university" revision={0} matchingOnly />)
  expect(await screen.findByText(/Personalized suggestions are paused/)).toBeTruthy()
  expect(screen.queryByText('Verified Engineer')).toBeNull()
  expect(screen.getByText(/No profile-based suggestions yet/)).toBeTruthy()
})
