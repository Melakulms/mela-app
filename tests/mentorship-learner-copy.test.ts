import { describe, expect, it } from 'vitest'
import { LEARNER_COPY_KEYS, learnerCopy } from '../src/lib/mentorship-learner-copy'

describe('learner mentorship copy', () => {
  it('provides every key in English and Amharic', () => {
    const en = learnerCopy('en')
    const am = learnerCopy('am')
    for (const key of LEARNER_COPY_KEYS) {
      expect(en[key], `en.${key}`).toBeTruthy()
      expect(am[key], `am.${key}`).toBeTruthy()
    }
  })

  it('falls back to English for unknown languages and never leaks raw status enums', () => {
    expect(learnerCopy('fr').requestsTitle).toBe(learnerCopy('en').requestsTitle)
    const all = Object.values(learnerCopy('am')).join(' ')
    expect(all).not.toMatch(/\b(pending|accepted|declined|scheduled|cancelled_by)\b/)
  })
})
