import { describe, expect, it } from 'vitest'
import { stagingRegistrationIsOpen } from '../src/lib/staging-registration'

describe('staging signup release gate', () => {
  it('blocks absent, broken or incomplete configuration', () => {
    expect(stagingRegistrationIsOpen(null)).toBe(false)
    expect(stagingRegistrationIsOpen([])).toBe(false)
    expect(stagingRegistrationIsOpen([{feature_key:'registrations',enabled:true}])).toBe(false)
    expect(stagingRegistrationIsOpen([{feature_key:'platform_live',enabled:true}])).toBe(false)
    expect(stagingRegistrationIsOpen([
      {feature_key:'platform_live',enabled:true},{feature_key:'registrations',enabled:false}
    ])).toBe(false)
  })
  it('opens only when both independent backend release switches are enabled', () => {
    expect(stagingRegistrationIsOpen([
      {feature_key:'platform_live',enabled:true},
      {feature_key:'registrations',enabled:true},
    ])).toBe(true)
  })
})
