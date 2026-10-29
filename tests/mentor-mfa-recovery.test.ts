import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  assurance: vi.fn(), list: vi.fn(), enroll: vi.fn(),
  challenge: vi.fn(), verify: vi.fn(), rpc: vi.fn(),
}))
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: { mfa: {
      getAuthenticatorAssuranceLevel: m.assurance,
      listFactors: m.list,
      enroll: m.enroll,
      challenge: m.challenge,
      verify: m.verify,
    }},
    rpc: m.rpc,
  },
}))
import {
  listVerifiedTotpFactors, requestMentorMfaRecovery, startTotpEnrollment,
  verifyExistingTotp,
} from '../src/lib/mentor-mfa'

beforeEach(() => {
  vi.resetAllMocks()
  m.assurance.mockResolvedValue({data:{currentLevel:'aal1'},error:null})
  m.list.mockResolvedValue({data:{totp:[
    {id:'primary',friendly_name:'Primary',status:'verified'},
    {id:'backup',friendly_name:'Backup',status:'verified'},
  ]},error:null})
  m.rpc.mockResolvedValue({data:{accepted:true},error:null})
  m.challenge.mockResolvedValue({data:{id:'challenge'},error:null})
  m.verify.mockResolvedValue({data:{},error:null})
})

describe('Mentorship MFA backup and recovery', () => {
  it('does not allow AAL1 to enroll an extra factor',async()=>{
    await expect(startTotpEnrollment(true)).rejects.toThrow('primary authenticator')
    expect(m.enroll).not.toHaveBeenCalled()
  })
  it('allows an AAL2 user to create a backup with a distinct friendly name',async()=>{
    m.assurance.mockResolvedValue({data:{currentLevel:'aal2'},error:null})
    m.enroll.mockResolvedValue({data:{id:'new',totp:{qr_code:'data:image/svg+xml;base64,',secret:'test-secret'}},error:null})
    await expect(startTotpEnrollment(true)).resolves.toMatchObject({factorId:'new'})
    expect(m.enroll).toHaveBeenCalledWith({factorType:'totp',friendlyName:'MELA backup authenticator'})
  })
  it('shows only verified TOTP authenticators',async()=>{
    m.list.mockResolvedValue({data:{totp:[
      {id:'primary',friendly_name:'Primary',status:'verified'},
      {id:'unfinished',friendly_name:'Unfinished',status:'unverified'},
    ]},error:null})
    await expect(listVerifiedTotpFactors()).resolves.toEqual([{id:'primary',friendlyName:'Primary'}])
  })
  it('uses the selected factor, not the first factor, for verification',async()=>{
    m.assurance.mockResolvedValue({data:{currentLevel:'aal2'},error:null})
    await verifyExistingTotp('123456','backup')
    expect(m.challenge).toHaveBeenCalledWith({factorId:'backup'})
    expect(m.verify).toHaveBeenCalledWith({factorId:'backup',challengeId:'challenge',code:'123456'})
  })
  it('allows only a predefined recovery reason and never grants an MFA bypass',async()=>{
    await expect(requestMentorMfaRecovery('arbitrary' as never)).rejects.toThrow('valid')
    await expect(requestMentorMfaRecovery('lost_device')).resolves.toMatch(/Two MFA-verified/)
    expect(m.rpc).toHaveBeenCalledWith('request_mentor_mfa_recovery',{p_reason:'lost_device'})
  })
})
