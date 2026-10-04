import { describe, expect, it } from 'vitest'
import { normalizeLanguageCode } from '../src/i18n'

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
