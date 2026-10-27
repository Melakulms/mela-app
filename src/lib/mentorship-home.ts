import type { Mentor, MentorshipSession, MyMentorshipRequest } from './mentorship'

export type MentorshipHomeNotice = {
  id: string
  title: string
  body: string
  created_at: string
  ref_table?: string | null
  audience?: string | null
  starts_at?: string | null
  ends_at?: string | null
}

export type MentorshipHomeExtras = {
  goals: string[]
  interests: string[]
  preferredLanguage: string
  announcements: MentorshipHomeNotice[]
  updates: MentorshipHomeNotice[]
  warnings: string[]
}

const normalize = (value: string) => value.toLocaleLowerCase().trim()
const meaningful = (value: string) => normalize(value).match(/[\p{L}\p{N}]{2,}/gu) ?? []
const common = new Set(['and', 'the', 'for', 'with', 'from', 'this', 'that', 'want', 'learn', 'learning', 'about', 'help', 'need', 'study', 'to', 'in', 'of', 'on', 'at', 'it', 'an'])

export function summarizeMentorshipHome(requests: MyMentorshipRequest[], sessions: MentorshipSession[], now = Date.now()) {
  const upcoming = sessions.filter((s) => s.status === 'scheduled' && Number.isFinite(Date.parse(s.scheduled_at)) && Date.parse(s.scheduled_at) > now)
    .sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at))
  const completed = sessions.filter((s) => s.status === 'completed')
  return {
    pendingRequests: requests.filter((r) => r.status === 'pending').length,
    acceptedRequests: requests.filter((r) => r.status === 'accepted').length,
    upcomingCount: upcoming.length,
    completedCount: completed.length,
    nextSession: upcoming[0] ?? null,
  }
}

/** These are only suggestions from verified mentor profile text, not eligibility or placement decisions. */
export function recommendMentors(mentors: Mentor[], interests: string[], preferredLanguage: string,
  requests: MyMentorshipRequest[], stageKey?: string | null): Mentor[] {
  if (['school_1_6', 'school_7_8', 'school_9_10'].includes(stageKey ?? '')) return []
  const keywords = new Set(interests.flatMap((part) => meaningful(part).map(normalize)).filter((word) => !common.has(word)))
  if (!keywords.size) return []
  const contacted = new Set(requests.filter((r) => r.status === 'pending' || r.status === 'accepted').map((r) => r.mentor_id))
  return mentors
    .filter((m) => !contacted.has(m.user_id))
    .map((mentor) => {
      const descriptor = normalize([mentor.headline, mentor.bio, ...(mentor.expertise ?? [])].filter(Boolean).join(' '))
      const descriptorWords = descriptor.split(/[^\p{L}\p{N}]+/u)
      const matches = [...keywords].filter((term) => term.length <= 2 ? descriptorWords.includes(term) : descriptor.includes(term))
      const score = matches.length * 10 + (
        preferredLanguage && (mentor.languages ?? []).some((lang) => normalize(lang) === normalize(preferredLanguage)) ? 2 : 0
      )
      return { mentor, score, matches: matches.length }
    })
    .filter((item) => item.matches > 0)
    .sort((a, b) => b.score - a.score || (a.mentor.full_name ?? '').localeCompare(b.mentor.full_name ?? ''))
    .slice(0, 3)
    .map((item) => item.mentor)
}

export function safeProfileTopics(value: unknown, max = 8): string[] {
  if (!Array.isArray(value)) return []
  const result: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'string') continue
    const trimmed = item.trim().slice(0, 160)
    if (!trimmed || seen.has(normalize(trimmed))) continue
    seen.add(normalize(trimmed))
    result.push(trimmed)
    if (result.length >= max) break
  }
  return result
}

export function publicMentorshipAnnouncements(notices: MentorshipHomeNotice[], now = Date.now()): MentorshipHomeNotice[] {
  const audiences = new Set(['all', 'student', 'students', 'learner', 'learners', 'mentorship'])
  return notices.filter((notice) => {
    if (!audiences.has(normalize(notice.audience ?? ''))) return false
    const start = notice.starts_at ? Date.parse(notice.starts_at) : null
    const end = notice.ends_at ? Date.parse(notice.ends_at) : null
    if (start !== null && (!Number.isFinite(start) || start > now)) return false
    if (end !== null && (!Number.isFinite(end) || end <= now)) return false
    return true
  }).slice(0, 3)
}
