import { describe, expect, it } from 'vitest'
import { passportRecordEditorsEnabled } from '../src/lib/passport-environment'

describe('Career Passport editor release gate', () => {
  it('enables only verified production and staging Supabase projects', () => {
    expect(passportRecordEditorsEnabled('https://duizgtmbptmlbyipreqg.supabase.co')).toBe(true)
    expect(passportRecordEditorsEnabled('https://tungqfmypuwzeyrtaseh.supabase.co')).toBe(true)
  })
  it.each([
    '', undefined, 'http://duizgtmbptmlbyipreqg.supabase.co',
    'https://duizgtmbptmlbyipreqg.supabase.co.attacker.example',
    'https://attacker@duizgtmbptmlbyipreqg.supabase.co',
    'https://duizgtmbptmlbyipreqg.supabase.co:8443',
    'https://duizgtmbptmlbyipreqg.supabase.co/other',
    'https://example.supabase.co',
  ])('keeps editors off on an unverified backend: %s', value => {
    expect(passportRecordEditorsEnabled(value)).toBe(false)
  })
})
