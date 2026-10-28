import { supabase } from './supabase'

/** The server checks signed AAL claims as well; this UI helper never grants access. */
export type MfaGateState = 'ready' | 'enroll' | 'verify' | 'resume_setup'
export type MfaSnapshot = {
  currentLevel: string | null
  verifiedFactorCount: number
  unverifiedFactorCount: number
}
export interface TotpEnrollment { factorId: string; qrCode: string; secret: string }
export type VerifiedTotp = { id: string; friendlyName: string }

export async function listVerifiedTotpFactors(): Promise<VerifiedTotp[]> {
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) throw error
  return (data?.totp ?? []).filter(f => f.status === 'verified')
    .map(f => ({ id: f.id, friendlyName: f.friendly_name || 'Authenticator' }))
}

export function decideMfaGate(s: MfaSnapshot): MfaGateState {
  if (s.currentLevel === 'aal2') return 'ready'
  if (s.verifiedFactorCount > 0) return 'verify'
  if (s.unverifiedFactorCount > 0) return 'resume_setup'
  return 'enroll'
}

export function mapMfaError(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error ?? '')
  const message = detail.toLowerCase()
  if (message.includes('expir')) return 'The verification code expired. Enter the newest code.'
  if (message.includes('rate') || message.includes('too many')) return 'Too many attempts. Try again later.'
  if (message.includes('invalid') || message.includes('code')) return 'The code did not match. Check your authenticator and try again.'
  if (message.includes('aal2') || message.includes('mfa verification')) return 'Confirm your identity using your authenticator app.'
  return 'Verification could not be completed. Retry or contact MELA support.'
}

export async function getMentorMfaSnapshot(): Promise<MfaSnapshot> {
  const [assurance, factors] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ])
  if (assurance.error) throw assurance.error
  if (factors.error) throw factors.error
  const totp = factors.data?.totp ?? []
  return {
    currentLevel: assurance.data?.currentLevel ?? null,
    verifiedFactorCount: totp.filter(f => f.status === 'verified').length,
    unverifiedFactorCount: totp.filter(f => f.status !== 'verified').length,
  }
}

export async function startTotpEnrollment(backup = false): Promise<TotpEnrollment> {
  if (backup) {
    const snapshot = await getMentorMfaSnapshot()
    if (snapshot.currentLevel !== 'aal2' || snapshot.verifiedFactorCount === 0) {
      throw new Error('Confirm your primary authenticator before adding a backup.')
    }
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp', friendlyName: backup ? 'MELA backup authenticator' : 'MELA mentorship',
  })
  if (error) throw error
  if (!data?.id || !data.totp?.qr_code || !data.totp.secret) throw new Error('MFA setup could not be started.')
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }
}

export async function verifyTotp(factorId: string, code: string): Promise<void> {
  const c = code.trim()
  if (!/^\d{6}$/.test(c)) throw new Error('Invalid verification code')
  const challenge = await supabase.auth.mfa.challenge({ factorId })
  if (challenge.error) throw challenge.error
  if (!challenge.data?.id) throw new Error('MFA challenge could not be created.')
  const result = await supabase.auth.mfa.verify({
    factorId, challengeId: challenge.data.id, code: c,
  })
  if (result.error) throw result.error
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (assurance.error) throw assurance.error
  if (assurance.data?.currentLevel !== 'aal2') throw new Error('MFA verification is required')
}

export async function verifyExistingTotp(code: string, selectedFactorId?: string): Promise<void> {
  const result = await supabase.auth.mfa.listFactors()
  if (result.error) throw result.error
  const factor = (result.data?.totp ?? []).find(f => f.status === 'verified' && (!selectedFactorId || f.id === selectedFactorId))
  if (!factor) throw new Error('No verified authenticator available.')
  await verifyTotp(factor.id, code)
}

export async function discardUnfinishedTotp(): Promise<void> {
  const result = await supabase.auth.mfa.listFactors()
  if (result.error) throw result.error
  for (const factor of (result.data?.totp ?? []).filter(f => f.status !== 'verified')) {
    const discarded = await supabase.auth.mfa.unenroll({ factorId: factor.id })
    if (discarded.error) throw discarded.error
  }
}
