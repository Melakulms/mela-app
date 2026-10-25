// Make backend availability messages actionable without weakening server-side access checks.
const unavailable = /mastery rebuild in progress for this filter:\s*only\s*(\d+)\s*accessible mastery questions are currently available/i
const genericUnavailable = /not enough accessible supplemental questions|no questions are available for this subject yet/i

export function isQuestionAvailabilityError(message: string): boolean {
  return unavailable.test(message) || message.startsWith('Only ') && message.includes('accessible mastery') || genericUnavailable.test(message)
}

export function explainQuestionSessionError(message: string): string {
  const match = unavailable.exec(message)
  if (match) {
    const count = Number(match[1])
    return `Only ${count} accessible mastery ${count === 1 ? 'question matches' : 'questions match'} this selection. At least five are required. Clear optional chapter, topic and difficulty filters or choose another subject in your grade. Other questions may still need teacher review or access permission.`
  }
  if (genericUnavailable.test(message)) {
    return 'Not enough accessible questions match your selection. Clear optional chapter, topic and difficulty filters or choose another subject in your own grade. Unreviewed questions will not be unlocked automatically.'
  }
  return message
}
