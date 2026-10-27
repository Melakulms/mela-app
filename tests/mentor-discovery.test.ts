import { describe, expect, it } from 'vitest'
import { discoverMentors, matchesCategory, mentorshipTime } from '../src/lib/mentor-discovery'
import { mentorshipTemplate } from '../src/lib/mentorship-resources'
import type { Mentor } from '../src/lib/mentorship'
const base: Mentor = { user_id: 'one', full_name: 'Ada', headline: 'Software engineer', bio: null, organization: null, years_experience: 4, rating_average: 0, rating_count: 0, expertise: ['Programming', 'AI'], languages: ['Amharic'] }
const opts = { query: '', category: '', language: '', availableOnly: false, goal: '', preferredLanguage: '' }
describe('mentor discovery', () => {
  it('ranks actual goal and language matches with reasons, without hiding manual search', () => {
    const results = discoverMentors([{ ...base, user_id: 'two', full_name: 'Zed', languages: ['English'], expertise: ['Agriculture'], headline: 'Agriculture adviser' }, base], { ...opts, goal: 'AI project', preferredLanguage: 'am' })
    expect(results[0].mentor.user_id).toBe('one')
    expect(results[0].reasons).toEqual(['Goal keywords: ai', 'Your preferred language'])
    expect(results).toHaveLength(2)
    expect(results[1].reasons).toEqual([])
  })
  it('combines category, language and published availability filters', () => {
    expect(discoverMentors([base], { ...opts, language: 'am', category: 'technology' })).toHaveLength(1)
    expect(discoverMentors([base], { ...opts, language: 'English' })).toHaveLength(0)
    expect(discoverMentors([base], { ...opts, availableOnly: true })).toHaveLength(0)
    expect(discoverMentors([base], { ...opts, category: 'agriculture' })).toHaveLength(0)
  })
  it('does not match AI merely because a profile contains training', () => {
    expect(matchesCategory({ ...base, headline: 'Training adviser', expertise: [] }, 'technology')).toBe(false)
  })
  it('uses Ethiopian time regardless of device time zone', () => {
    expect(mentorshipTime('2026-10-27T06:00:00Z')).toContain('09:00')
    expect(mentorshipTime('2026-10-27T06:00:00Z')).toContain('EAT')
  })
  it('provides useful offline worksheets without personal records or credentials', () => {
    expect(mentorshipTemplate('session-agenda')).toContain('My next action and target date:')
    expect(mentorshipTemplate('closure-review')).toContain('Self-reflection is not a verified credential')
    expect(() => mentorshipTemplate('unknown')).toThrow('Unknown')
  })
})
