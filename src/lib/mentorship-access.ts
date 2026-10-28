import { supabase } from './supabase'

export type MentorshipAccessReason =
  | 'eligible'
  | 'inactive_or_ineligible_account'
  | 'education_profile_required'
  | 'education_stage_not_available'
  | 'verified_guardian_required'
  | 'approved_adult_review_required'

export interface MentorshipAccess {
  allowed: boolean
  reason: MentorshipAccessReason
}

const VALID_REASONS = new Set<MentorshipAccessReason>([
  'eligible',
  'inactive_or_ineligible_account',
  'education_profile_required',
  'education_stage_not_available',
  'verified_guardian_required',
  'approved_adult_review_required',
])

export async function fetchMyMentorshipAccess(): Promise<MentorshipAccess> {
  const {data,error} = await supabase.rpc('my_mentorship_access_status')
  if (error) throw new Error(error.message)
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      typeof data.allowed !== 'boolean' || !VALID_REASONS.has(data.reason)) {
    throw new Error('Unable to verify current mentorship eligibility.')
  }
  // Reject an inconsistent server response rather than permitting a request.
  if (data.allowed !== (data.reason === 'eligible')) {
    throw new Error('Mentorship eligibility requires re-verification.')
  }
  return { allowed: data.allowed, reason: data.reason }
}
