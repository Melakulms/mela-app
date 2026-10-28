import { describe, expect, it } from 'vitest'
import type { Mentor, MentorshipSession, MyMentorshipRequest } from '../src/lib/mentorship'
import {
  recommendMentors, safeProfileTopics, summarizeMentorshipHome, publicMentorshipAnnouncements,
} from '../src/lib/mentorship-home'

const base: Mentor = {
  user_id: 'mentor-tech', full_name: 'Abebe', headline: 'Software engineer', bio: 'Mentors AI careers',
  organization: null, years_experience: 3, rating_average: 5, rating_count: 4,
  expertise: ['AI', 'computer science'], languages: ['Amharic', 'English'], availability: [],
}
const sess = (id: string, date: string, status = 'scheduled'): MentorshipSession => ({
  id, request_id: id, mentee_id: 'student', mentor_id: 'mentor-tech', scheduled_at: date,
  status, duration_min: 30, call_room_id: null, completed_at: null, cancelled_at: null,
  rating: null, rating_comment: null,
})

describe('Mentorship Home', () => {
  it('shows actual upcoming sessions, never completed or past sessions as upcoming', () => {
    const now = Date.parse('2026-10-27T10:00:00Z')
    const sessions = [
      sess('past', '2026-10-27T09:00:00Z'),
      sess('future-later', '2026-10-29T09:00:00Z'),
      sess('completed', '2026-10-27T08:00:00Z', 'completed'),
      sess('future-next', '2026-10-27T12:00:00Z'),
      sess('bad-date', 'not-a-date'),
    ]
    const reqs: MyMentorshipRequest[] = [
      { id: '1', mentor_id: 'mentor-tech', topic: 'AI', status: 'pending', created_at: '' },
      { id: '2', mentor_id: 'mentor-tech', topic: 'AI', status: 'accepted', created_at: '' },
    ]
    expect(summarizeMentorshipHome(reqs, sessions, now)).toMatchObject({
      pendingRequests: 1, acceptedRequests: 1, upcomingCount: 2,
      completedCount: 1, nextSession: { id: 'future-next' },
    })
  })

  it('does not invent matches, and never recommends directly to prohibited stages', () => {
    const research: Mentor = { ...base, user_id: 'mentor-research', full_name: 'Zeleke', headline: 'Research adviser', expertise: ['Research'], bio: '' }
    const mentors = [base, research]
    expect(recommendMentors(mentors, ['AI programming'], 'English', [])).toEqual([base])
    expect(recommendMentors(mentors, [], 'English', [])).toEqual([])
    expect(recommendMentors(mentors, ['AI'], 'English', [], 'school_9_10')).toEqual([])
  })

  it('avoids recommending a mentor when a learner already has an active request', () => {
    const active: MyMentorshipRequest[] = [{ id: '1', mentor_id: base.user_id, topic: 'AI', status: 'accepted', created_at: '' }]
    expect(recommendMentors([base], ['AI'], 'Amharic', active)).toEqual([])
  })

  it('sanitizes profile arrays and rejects irrelevant announcement audiences and expired notices', () => {
    expect(safeProfileTopics([' AI ', 'AI', '', null, 'Career'])).toEqual(['AI', 'Career'])
    expect(safeProfileTopics('not an array')).toEqual([])
    const n = (id: string, audience: string, ends_at: string | null = null) =>
      ({ id, audience, title: id, body: 'Message', created_at: '2026-10-01', ends_at })
    expect(publicMentorshipAnnouncements([
      n('all', 'all'), n('students', 'student'), n('private', 'employers'),
      n('expired', 'all', '2026-01-01'),
    ], Date.parse('2026-10-27T00:00:00Z')).map((notice) => notice.id)).toEqual(['all', 'students'])
  })
})
