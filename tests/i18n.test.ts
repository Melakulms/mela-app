import { describe, expect, it } from 'vitest'
import { normalizeLanguageCode, translate } from '../src/i18n'

describe('Phase 6 language normalization', () => {
  it.each([
    ['English', 'en'], ['en', 'en'], ['Amharic', 'am'], ['አማርኛ', 'am'],
    ['Afaan Oromo', 'om'], ['Afaan Oromoo', 'om'], ['or', 'om'],
    ['Tigrinya', 'ti'], ['ትግርኛ', 'ti'], ['Somali', 'so'], ['Soomaali', 'so'],
  ])('maps %s to %s', (input, expected) => {
    expect(normalizeLanguageCode(input)).toBe(expected)
  })

  it('falls back to English for unknown or missing values', () => {
    expect(normalizeLanguageCode('Afar')).toBe('en')
    expect(normalizeLanguageCode('')).toBe('en')
    expect(normalizeLanguageCode(null)).toBe('en')
  })
})


describe('learner interface translations', () => {
  it.each(['am', 'om', 'ti', 'so'] as const)('translates launch-critical UI for %s', (language) => {
    for (const key of ['exploreMela', 'careerPassport', 'profileHeading', 'generateParentLink'] as const) {
      expect(translate(language, key)).not.toBe(translate('en', key))
      expect(translate(language, key).trim().length).toBeGreaterThan(1)
    }
  })

  it('keeps an English fallback for every supported language', () => {
    for (const language of ['en', 'am', 'om', 'ti', 'so'] as const) {
      expect(translate(language, 'loading')).toBeTruthy()
      expect(translate(language, 'practice')).toBeTruthy()
    }
  })
})
