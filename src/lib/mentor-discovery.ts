import type { Mentor } from './mentorship'

export const MENTORSHIP_CATEGORIES = [
  { id: 'academic', label: 'Academic support', terms: ['academic', 'mathematics', 'math', 'english', 'science', 'biology', 'chemistry', 'physics', 'exam', 'tutoring'] },
  { id: 'scholarships', label: 'University & scholarships', terms: ['scholarship', 'university', 'admission', 'application', 'higher education', 'study abroad'] },
  { id: 'career', label: 'Career & employment', terms: ['career', 'employment', 'cv', 'resume', 'interview', 'recruitment', 'job'] },
  { id: 'technology', label: 'Technology & AI', terms: ['technology', 'software', 'programming', 'computer', 'artificial intelligence', 'ai', 'cybersecurity', 'data'] },
  { id: 'business', label: 'Business & entrepreneurship', terms: ['business', 'entrepreneur', 'startup', 'marketing', 'sales', 'finance', 'management'] },
  { id: 'teaching', label: 'Educator development', terms: ['teacher', 'teaching', 'curriculum', 'pedagogy', 'education'] },
  { id: 'research', label: 'Research & STEM', terms: ['research', 'laboratory', 'engineering', 'stem', 'scientist'] },
  { id: 'creative', label: 'Creative careers', terms: ['creative', 'design', 'writing', 'art', 'media', 'film'] },
] as const

export type MentorshipCategory = 'all' | (typeof MENTORSHIP_CATEGORIES)[number]['id']
export type MentorDiscoveryFilters = { query: string; category: MentorshipCategory; language: string }

const normalize = (text: string): string => text.toLocaleLowerCase().trim()

export function mentorCategoryText(mentor: Pick<Mentor, 'headline' | 'bio' | 'expertise'>): string {
  // Categories describe self-reported profile text; they are not a verified credential.
  return normalize([mentor.headline, mentor.bio, ...(mentor.expertise ?? [])].filter(Boolean).join(' '))
}

export function mentorMatchesCategory(mentor: Mentor, category: MentorshipCategory): boolean {
  if (category === 'all') return true
  const entry = MENTORSHIP_CATEGORIES.find((item) => item.id === category)
  if (!entry) return false
  const text = mentorCategoryText(mentor)
  return entry.terms.some((term) => {
    // Short abbreviations should not match arbitrary words (e.g. "ai" in "training").
    if (term.length <= 2) return text.split(/[^a-z0-9]+/).includes(term)
    return text.includes(term)
  })
}

export function getMentorLanguages(mentors: Mentor[]): string[] {
  return Array.from(new Set(mentors.flatMap((mentor) => (mentor.languages ?? []).map((language) => language.trim()).filter(Boolean))))
    .sort((a, b) => a.localeCompare(b))
}

export function discoverMentors(mentors: Mentor[], filters: MentorDiscoveryFilters): Mentor[] {
  const words = normalize(filters.query).split(/\s+/).filter(Boolean)
  const chosenLanguage = normalize(filters.language)
  return mentors.filter((mentor) => {
    if (!mentorMatchesCategory(mentor, filters.category)) return false
    if (chosenLanguage && !(mentor.languages ?? []).some((language) => normalize(language) === chosenLanguage)) return false
    const searchable = normalize([
      mentor.full_name, mentor.headline, mentor.bio, mentor.organization,
      ...(mentor.expertise ?? []), ...(mentor.languages ?? []),
    ].filter(Boolean).join(' '))
    return words.every((word) => searchable.includes(word))
  }).sort((a, b) => {
    if (words.length) {
      const expertiseA = normalize((a.expertise ?? []).join(' ') + ' ' + (a.headline ?? ''))
      const expertiseB = normalize((b.expertise ?? []).join(' ') + ' ' + (b.headline ?? ''))
      const scoreA = words.filter((word) => expertiseA.includes(word)).length
      const scoreB = words.filter((word) => expertiseB.includes(word)).length
      if (scoreA !== scoreB) return scoreB - scoreA
    }
    return (a.full_name ?? '').localeCompare(b.full_name ?? '')
  })
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

export function isValidAvailabilitySlot(weekday: number, start: string, end: string): boolean {
  return Number.isInteger(weekday) && weekday >= 0 && weekday <= 6 &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(start) &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(end) && start < end
}
