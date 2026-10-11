import type { Course, Enrollment } from './academy'
import type { PracticeTopic } from './practice'
import type { LearnerDiscoveryProfile } from './learner-discovery'

const words = (value: string): string => ' ' + value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim() + ' '
const phraseMatches = (body: string, term: string): boolean => {
  const cleaned = words(term).trim()
  return cleaned.length >= 3 && body.includes(' ' + cleaned + ' ')
}

/** Learning recommendations are explanatory sorting hints, never completion claims or permission checks. */
export function recommendCourses(
  courses: Course[],
  preferences: LearnerDiscoveryProfile,
  enrollments: ReadonlyMap<string, Enrollment>,
): { course: Course; score: number; reasons: string[] }[] {
  const canMatch = preferences.enable_suggestions
  const goals = canMatch
    ? [...preferences.interest_fields, preferences.learning_goal].filter(value => value.trim().length >= 3)
    : []
  return courses.map(course => {
    const reasons: string[] = []
    let score = 0
    const enrollment = enrollments.get(course.id)
    const available = course.content_available && (course.lesson_count ?? 0) > 0
    const free = (course.price_cents ?? 0) === 0
    if (enrollment && !enrollment.completed_at && available) {
      score += 10
      reasons.push('Continue an enrolled course')
    }
    if (canMatch) {
      const description = words([course.title, course.category ?? '', course.description ?? '', course.career_track ?? ''].join(' '))
      if (goals.some(term => phraseMatches(description, term))) {
        score += 5
        reasons.push('Matches your declared interests or goal')
      }
    }
    return { course, score: available && (free || !!enrollment) ? score : 0, reasons: available && (free || !!enrollment) ? reasons : [] }
  }).sort((a, b) => b.score - a.score)
}

/** Grade and approval already constrain the returned practice topics via the existing backend. */
export function recommendPracticeTopics<T extends PracticeTopic>(
  topics: T[],
  preferredSubjectTitles: string[],
  serverRecommendedIds: string[],
): { topic: T; score: number; reasons: string[] }[] {
  const preferred = preferredSubjectTitles.map(words)
  const recommended = new Set(serverRecommendedIds)
  return topics.map(topic => {
    const reasons: string[] = []
    let score = 0
    if (recommended.has(topic.id)) { score += 6; reasons.push('Recommended from your existing practice history') }
    if (preferred.some(title => title.trim() && words(topic.subject) === title)) {
      score += 3
      reasons.push('Your selected subject')
    }
    return { topic, score, reasons }
  }).sort((a, b) => b.score - a.score)
}

export function profilePreparationChecklist(
  stage: string | null,
  grade: number | null,
  preferences: LearnerDiscoveryProfile,
): { label: string; complete: boolean }[] {
  return [
    { label: 'Education level', complete: !!stage && (!stage.startsWith('school_') || (grade !== null && grade >= 1 && grade <= 12)) },
    { label: 'Grade-specific subject selection', complete: !stage?.startsWith('school_') || preferences.preferred_program_keys.length > 0 },
    { label: 'Areas of interest', complete: preferences.interest_fields.length > 0 },
    { label: 'Learning or career goal', complete: !!preferences.learning_goal.trim() },
    { label: 'Study level preference', complete: preferences.target_degree_level !== 'any' },
  ]
}

/** In-app deadline notice only; never treated as proof of scheduled phone/email delivery. */
export function nearDeadline(date: string | null, nowISO: string, withinDays = 14): number | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) return null
  const deadlineMs = Date.parse(date.slice(0, 10) + 'T00:00:00Z')
  const todayMs = Date.parse(nowISO.slice(0, 10) + 'T00:00:00Z')
  if (!Number.isFinite(deadlineMs) || !Number.isFinite(todayMs)) return null
  const days = Math.round((deadlineMs - todayMs) / 86400000)
  return days >= 0 && days <= withinDays ? days : null
}
