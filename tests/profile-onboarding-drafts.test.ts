import {describe,expect,it,vi} from 'vitest'
import {sanitizedProfileDraft} from '../src/lib/profile-onboarding-drafts'

vi.mock('../src/lib/supabase',()=>({supabase:{auth:{getUser:vi.fn()},from:vi.fn()}}))

describe('private, resumable role profile drafts',()=>{
  it('stores only an allowlist; strips credentials, OTP, identity evidence and child links',()=>{
    const sanitized=sanitizedProfileDraft('parent',{
      name:'Adult guardian',region:'Addis Ababa',interests:'Homework',
      password:'secret',otp:'123456',bank_pin:'4433',child_link_code:'private-code',id_document:'image',
    })
    expect(sanitized).toEqual({name:'Adult guardian',region:'Addis Ababa',interests:'Homework'})
    expect(JSON.stringify(sanitized)).not.toMatch(/secret|123456|4433|private-code|image/)
  })
  it('keeps selected grades but rejects invalid grade entries',()=>{
    expect(sanitizedProfileDraft('teacher',{grades:['1','10','college_tvet','0','13','malicious',1]}).grades)
      .toEqual(['1','10','college_tvet'])
  })
  it('truncates individual text fields for safe draft storage',()=>{
    expect(String(sanitizedProfileDraft('company',{description:'x'.repeat(4000)}).description).length).toBe(1600)
  })
  it('rejects oversized draft payloads',()=>{
    const many={name:'x'.repeat(1600),company:'x'.repeat(1600),legalName:'x'.repeat(1600),
      regNumber:'x'.repeat(1600),industry:'x'.repeat(1600),website:'x'.repeat(1600),
      title:'x'.repeat(1600),description:'x'.repeat(1600)}
    expect(()=>sanitizedProfileDraft('company',many)).toThrow(/too long/)
  })
})
