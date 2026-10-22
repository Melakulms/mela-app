import { describe, expect, it } from 'vitest'
import { stagingRegistrationIsOpen } from '../src/lib/staging-registration'
describe('staging-only invitation registration switch', () => {
  it('blocks missing flags and normal global releases', () => {
    expect(stagingRegistrationIsOpen(null)).toBe(false)
    expect(stagingRegistrationIsOpen([])).toBe(false)
    expect(stagingRegistrationIsOpen([{feature_key:'registrations',enabled:true},{feature_key:'platform_live',enabled:true}])).toBe(false)
    expect(stagingRegistrationIsOpen([{feature_key:'staging_beta_invites',enabled:false}])).toBe(false)
  })
  it('opens only for dedicated staging invitation release flag',()=>{
    expect(stagingRegistrationIsOpen([{feature_key:'staging_beta_invites',enabled:true}])).toBe(true)
  })
})
