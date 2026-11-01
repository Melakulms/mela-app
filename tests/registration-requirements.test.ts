import {describe, expect, it} from 'vitest'
import {registrationAttestation, validateRegistrationEligibility} from '../src/lib/registration-requirements'

describe('registration eligibility', () => {
  const accepted = {acceptedTerms: true, acceptedPrivacy: true} as const
  it('requires an age group before account creation', () => {
    expect(validateRegistrationEligibility({role:'student',ageBand:'',...accepted})).toMatch(/age group/i)
  })
  it('requires each essential policy acknowledgement', () => {
    expect(validateRegistrationEligibility({role:'student',ageBand:'18_plus',acceptedTerms:false,acceptedPrivacy:true})).toMatch(/Terms/)
    expect(validateRegistrationEligibility({role:'student',ageBand:'18_plus',acceptedTerms:true,acceptedPrivacy:false})).toMatch(/Privacy/)
  })
  it.each(['parent','teacher','company'] as const)('rejects minor applicants for adult %s accounts',role=>{
    expect(validateRegistrationEligibility({role,ageBand:'13_17',...accepted})).toMatch(/adult/)
  })
  it('allows minor students to apply without assuming they have guardian consent',()=>{
    expect(validateRegistrationEligibility({role:'student',ageBand:'under_13',...accepted})).toBeNull()
  })
  it('keeps optional marketing separate from mandatory acknowledgements',()=>{
    expect(registrationAttestation('18_plus',false).marketing_opt_in).toBe(false)
    expect(registrationAttestation('18_plus',true).marketing_opt_in).toBe(true)
  })
})
