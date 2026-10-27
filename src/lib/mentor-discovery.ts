import type { Mentor } from './mentorship'

export const MENTORSHIP_CATEGORIES = [
  { id: 'academic', title: 'Academic & study skills', terms: ['academic', 'study', 'mathematics', 'english', 'exam', 'subject', 'education'], goal: 'Improve one subject and build a weekly study routine.' },
  { id: 'university', title: 'University & scholarships', terms: ['university', 'scholarship', 'admission', 'application'], goal: 'Prepare an eligibility checklist and an application timeline.' },
  { id: 'career', title: 'Career & employment', terms: ['career', 'employment', 'cv', 'interview', 'job'], goal: 'Create a clear CV and practise explaining your experience.' },
  { id: 'technology', title: 'Technology & AI', terms: ['technology', 'software', 'programming', 'ai', 'cybersecurity', 'digital'], goal: 'Build a small project and explain what you learned.' },
  { id: 'business', title: 'Business & entrepreneurship', terms: ['business', 'entrepreneurship', 'marketing', 'sales', 'startup'], goal: 'Test a business idea with customer questions and a simple plan.' },
  { id: 'teachers', title: 'Teacher development', terms: ['teacher', 'teaching', 'pedagogy'], goal: 'Design a lesson and review evidence of student learning.' },
  { id: 'research', title: 'Research & STEM', terms: ['research', 'science', 'engineering', 'stem'], goal: 'Develop a research question and document a safe investigation.' },
  { id: 'leadership', title: 'Leadership & communication', terms: ['leadership', 'communication', 'teamwork'], goal: 'Lead a small team task and reflect on feedback.' },
  { id: 'creative', title: 'Creative industries', terms: ['design', 'creative', 'art', 'music', 'writing'], goal: 'Develop a portfolio piece and revise it using feedback.' },
  { id: 'agriculture', title: 'Agriculture', terms: ['agriculture', 'farming', 'agronomy'], goal: 'Explore agricultural careers and identify a local learning project.' },
  { id: 'healthcare', title: 'Healthcare career exploration', terms: ['healthcare', 'medicine', 'nursing', 'health'], goal: 'Understand training pathways and professional responsibilities. No clinical advice.' },
  { id: 'peer', title: 'Peer mentoring', terms: ['peer', 'student leadership'], goal: 'Plan a supervised study group with clear roles.' },
  { id: 'inclusive', title: 'Inclusive learning', terms: ['disability', 'inclusive', 'accessibility'], goal: 'Identify accessible learning strategies and support needs without sharing medical records.' },
] as const

const normalize = (value: string) => value.toLocaleLowerCase().normalize('NFKC').trim()
const languageAliases: Record<string, string> = { en: 'english', am: 'amharic', om: 'afaan oromo', ti: 'tigrinya', so: 'somali', oromo: 'afaan oromo', 'አማርኛ': 'amharic' }
export function languageKey(value: string) { const key = normalize(value); return languageAliases[key] ?? key }
function words(value: string) { return normalize(value).split(/[^\p{L}\p{N}]+/u).filter(Boolean) }
function containsTerm(haystack: string, term: string) {
  const tokens = words(haystack)
  return term.length <= 3 ? tokens.includes(term) : normalize(haystack).includes(term)
}
export function mentorText(mentor: Mentor) {
  return [mentor.full_name, mentor.headline, mentor.bio, mentor.organization, ...(mentor.expertise ?? [])].filter(Boolean).join(' ')
}
export function matchesCategory(mentor: Mentor, category: string) {
  const config = MENTORSHIP_CATEGORIES.find(c => c.id === category)
  return !config || config.terms.some(term => containsTerm(mentorText(mentor), term))
}
export function mentorMatch(mentor: Mentor, goal: string, preferredLanguage: string) {
  const terms = [...new Set(words(goal).filter(w => w.length > 3 || ['ai', 'cv'].includes(w)))]
  const matched = terms.filter(term => containsTerm(mentorText(mentor), term)).slice(0, 5)
  const language = !!preferredLanguage && (mentor.languages ?? []).some(l => languageKey(l) === languageKey(preferredLanguage))
  return { score: matched.length * 3 + (language ? 2 : 0), reasons: [...(matched.length ? [`Goal keywords: ${matched.join(', ')}`] : []), ...(language ? ['Your preferred language'] : [])] }
}
export function discoverMentors(mentors: Mentor[], options: { query: string; category: string; language: string; availableOnly: boolean; goal: string; preferredLanguage: string }) {
  return mentors.filter(m => normalize(mentorText(m)).includes(normalize(options.query)))
    .filter(m => matchesCategory(m, options.category))
    .filter(m => !options.language || (m.languages ?? []).some(l => languageKey(l) === languageKey(options.language)))
    .filter(m => !options.availableOnly || !!m.availability?.length)
    .map(mentor => ({ mentor, ...mentorMatch(mentor, options.goal, options.preferredLanguage) }))
    .sort((a, b) => b.score - a.score || (a.mentor.full_name ?? '').localeCompare(b.mentor.full_name ?? '') || a.mentor.user_id.localeCompare(b.mentor.user_id))
}
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export function mentorshipTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Addis_Ababa' }).format(new Date(value)) + ' EAT (UTC+3, 24-hour clock)'
}
