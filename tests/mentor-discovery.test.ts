import { describe, expect, it } from 'vitest'
import type { Mentor } from '../src/lib/mentorship'
import { discoverMentors, getMentorLanguages, isValidAvailabilitySlot, mentorMatchesCategory } from '../src/lib/mentor-discovery'

const mentor = (overrides: Partial<Mentor> = {}): Mentor => ({
  user_id: 'verified-1', full_name: 'Abebe Tadesse', headline: 'Engineering mentor',
  bio: 'Supports software programming careers', organization: 'University',
  years_experience: 5, rating_average: 4.8, rating_count: 5,
  expertise: ['Software engineering', 'AI'], languages: ['Amharic', 'English'],
  availability: [], ...overrides,
})

describe('mentorship discovery (verified profiles only, supplied by the server)', () => {
  it('matches expertise and language without relying on inferred or fake mentors', () => {
    const mentors = [
      mentor(),
      mentor({ user_id: '2', full_name: 'Birtukan', expertise: ['Marketing'], headline: 'Business adviser', bio: null, languages: ['Afaan Oromo'] }),
    ]
    expect(discoverMentors(mentors, { query: 'AI', category: 'technology', language: 'English' }).map((m) => m.user_id)).toEqual(['verified-1'])
    expect(discoverMentors(mentors, { query: '', category: 'business', language: 'English' })).toEqual([])
  })
  it('treats AI as a distinct term, not a substring of unrelated words', () => {
    expect(mentorMatchesCategory(mentor({ expertise: [], headline: 'Painting', bio: null }), 'technology')).toBe(false)
    expect(mentorMatchesCategory(mentor({ expertise: ['AI'], headline: null, bio: null }), 'technology')).toBe(true)
  })
  it('supports multiple search terms with real profile text', () => {
    expect(discoverMentors([mentor()], { query: 'abebe software', category: 'all', language: '' })).toHaveLength(1)
  })
  it('offers only actually listed languages', () => {
    expect(getMentorLanguages([mentor(), mentor({ languages: ['English', 'Somali'] })])).toEqual(['Amharic', 'English', 'Somali'])
  })
  it('rejects invalid availability windows before writing', () => {
    expect(isValidAvailabilitySlot(1, '09:00', '12:00')).toBe(true)
    expect(isValidAvailabilitySlot(7, '09:00', '12:00')).toBe(false)
    expect(isValidAvailabilitySlot(1, '12:00', '09:00')).toBe(false)
    expect(isValidAvailabilitySlot(1, '08:67', '09:00')).toBe(false)
  })
})
