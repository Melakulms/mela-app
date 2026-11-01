/**
 * Common registration checks. They improve form UX, but do not grant a role,
 * establish a verified phone/email, or replace server-side safeguarding.
 */
export type RegistrationAgeBand = '' | 'under_13' | '13_17' | '18_plus'
export type PublicRegistrationRole = 'student' | 'parent' | 'teacher' | 'company'

export const REGISTRATION_POLICY_VERSION = '2026-08-14'

export function isAdultOnlyRole(role: PublicRegistrationRole) {
  return role === 'parent' || role === 'teacher' || role === 'company'
}

export function validateRegistrationEligibility(input: {
  role: PublicRegistrationRole
  ageBand: RegistrationAgeBand
  acceptedTerms: boolean
  acceptedPrivacy: boolean
}): string | null {
  if (!input.ageBand) return 'Choose your age group to continue.'
  if (isAdultOnlyRole(input.role) && input.ageBand !== '18_plus') {
    return 'This role requires an adult account. Children may use a learner account with appropriate guardian safeguards.'
  }
  if (!input.acceptedTerms || !input.acceptedPrivacy) {
    return 'Read and acknowledge the MELA Terms of Service and Privacy Notice to continue.'
  }
  return null
}

export function registrationAttestation(ageBand: Exclude<RegistrationAgeBand, ''>, marketingConsent: boolean) {
  return {
    age_band: ageBand,
    terms_accepted: true,
    privacy_acknowledged: true,
    terms_acknowledged_version: REGISTRATION_POLICY_VERSION,
    privacy_acknowledged_version: REGISTRATION_POLICY_VERSION,
    marketing_opt_in: marketingConsent,
  }
}
