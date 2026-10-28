import { describe, expect, it } from 'vitest'
import {
  readMentorshipSection, withMentorshipSection, MENTORSHIP_SECTION_COUNT,
} from '../src/lib/mentorship-section-navigation'

describe('Android-friendly Mentorship subsection URLs', () => {
  const root = 'https://mela-staging.vercel.app/?view=mentorship&test=1'
  it('represents all 16 real subsection destinations in navigable URLs', () => {
    for (let section = 1; section <= MENTORSHIP_SECTION_COUNT; section++) {
      const url = withMentorshipSection(new URL(root), section)
      expect(readMentorshipSection(url)).toBe(section)
      expect(url.searchParams.get('view')).toBe('mentorship')
      expect(url.searchParams.get('test')).toBe('1')
      expect(readMentorshipSection(withMentorshipSection(url, null))).toBeNull()
    }
  })
  it('rejects malformed or unauthorized deep-link shapes without changing privileges', () => {
    for (const value of ['0', '17', '-1', '4.5', '01', ' 2', '2e0', 'abc']) {
      expect(readMentorshipSection(new URL(root + '&mentorship_section=' + encodeURIComponent(value)))).toBeNull()
    }
    expect(readMentorshipSection(new URL('https://mela-staging.vercel.app/?view=dashboard&mentorship_section=15'))).toBeNull()
    expect(() => withMentorshipSection(new URL(root), 17)).toThrow(/Unknown mentorship section/)
  })
})
