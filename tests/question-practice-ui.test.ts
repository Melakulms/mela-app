import { describe, expect, it } from 'vitest'
import { explainQuestionSessionError, isQuestionAvailabilityError } from '../src/lib/question-practice-ui'

describe('Practice filter availability', () => {
  it('explains a zero-question result and keeps grade restrictions', () => {
    const raw = 'mastery rebuild in progress for this filter: only 0 accessible mastery questions are currently available'
    const message = explainQuestionSessionError(raw)
    expect(message).toContain('Only 0 accessible mastery questions')
    expect(message).toContain('At least five')
    expect(message).toContain('your grade')
    expect(isQuestionAvailabilityError(message)).toBe(true)
  })
  it('supports one available question without false promises of unlocked content', () => {
    const message = explainQuestionSessionError('mastery rebuild in progress for this filter: only 1 accessible mastery questions are currently available')
    expect(message).toContain('Only 1 accessible mastery question matches')
    expect(message).toContain('teacher review')
  })
  it('preserves profile and connection errors', () => {
    const raw = 'Your education profile must be completed'
    expect(explainQuestionSessionError(raw)).toBe(raw)
    expect(isQuestionAvailabilityError(raw)).toBe(false)
  })
})
