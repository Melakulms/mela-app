import { supabase } from './supabase'
export type PassportVerificationKind = 'education' | 'experience'
export type PassportVerificationStatus = {
  id: string; record_kind: PassportVerificationKind; record_id: string
  status: 'pending' | 'approved' | 'rejected'
  requested_at: string; reviewed_at: string | null; review_feedback: string | null
}
/** An authenticated learner submits a request. This never verifies a credential. */
export async function requestPassportVerification(kind: PassportVerificationKind, recordId: string, note: string) {
  if (!recordId) throw new Error('Choose a saved record to request verification.')
  if (note.length > 600) throw new Error('Keep the reviewer note below 600 characters.')
  const { data, error } = await supabase.rpc('submit_passport_verification_request', {
    p_kind: kind, p_record_id: recordId, p_note: note.trim(),
  })
  if (error) throw error
  if (!data || typeof data !== 'string') throw new Error('Verification request was not confirmed.')
  return data
}
export async function fetchMyPassportVerificationRequests(): Promise<PassportVerificationStatus[]> {
  const { data, error } = await supabase.rpc('get_my_passport_verification_requests')
  if (error) throw error
  if (!Array.isArray(data)) throw new Error('Verification status could not be confirmed. Retry before changing records.')
  return data as PassportVerificationStatus[]
}
