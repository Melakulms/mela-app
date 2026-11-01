import {describe, expect, it} from 'vitest'
import {hasVerifiedContact,validContactPhone} from '../src/lib/contact-verification'

describe('real contact verification',()=>{
  it('never accepts a synthetic confirmed beta email',()=>{
    expect(hasVerifiedContact({email:'learner@beta.mela.invalid',email_confirmed_at:'2026-11-01T01:00:00Z',phone:'',phone_confirmed_at:undefined})).toBe(false)
  })
  it('accepts a confirmed real email',()=>{
    expect(hasVerifiedContact({email:'learner@example.com',email_confirmed_at:'2026-11-01T01:00:00Z',phone:'',phone_confirmed_at:undefined})).toBe(true)
  })
  it('accepts provider-confirmed phone for email-less accounts',()=>{
    expect(hasVerifiedContact({email:'learner@beta.mela.invalid',email_confirmed_at:'2026-11-01T01:00:00Z',phone:'+251911000000',phone_confirmed_at:'2026-11-01T01:00:00Z'})).toBe(true)
  })
  it('rejects unconfirmed and absent contacts',()=>{
    expect(hasVerifiedContact(null)).toBe(false)
    expect(hasVerifiedContact({email:'learner@example.com',email_confirmed_at:undefined,phone:'+251911000000',phone_confirmed_at:undefined})).toBe(false)
  })
  it('requires international phone format before calling the provider',()=>{
    expect(validContactPhone('+251911000000')).toBe(true)
    expect(validContactPhone('0911000000')).toBe(false)
    expect(validContactPhone('+251 abc')).toBe(false)
  })
})
