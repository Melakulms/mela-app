import { supabase } from './supabase'

export interface SafetyProfile {
  education_stage_key: string | null
  learner_safety_status: string
}

export interface GuardianRelationship {
  id: string
  guardian_email: string | null
  relationship: string
  status: string
  requested_at: string
  verified_at: string | null
}

export interface SafetyReport {
  id: string
  reason: string
  status: string
  created_at: string
  resolved_at: string | null
}

export interface PolicyDocument {
  policy_key: string
  version: string
  title: string
  required_for_access: boolean
  explicit_consent: boolean
  revocable: boolean
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('Your session has expired. Please sign in again.')
  return data.user.id
}

export async function fetchMySafetyCenter() {
  const userId = await requireUserId()
  const [profileResult, guardianResult, reportsResult, policiesResult] = await Promise.all([
    supabase.from('profiles').select('education_stage_key,learner_safety_status').eq('id', userId).single(),
    supabase.from('guardian_relationships').select('id,guardian_email,relationship,status,requested_at,verified_at').eq('learner_id', userId).order('requested_at', { ascending: false }),
    supabase.from('reports').select('id,reason,status,created_at,resolved_at').eq('reporter_id', userId).order('created_at', { ascending: false }).limit(20),
    supabase.from('policy_documents').select('policy_key,version,title,required_for_access,explicit_consent,revocable').eq('status', 'active').order('policy_key'),
  ])
  if (profileResult.error) throw profileResult.error
  if (guardianResult.error) throw guardianResult.error
  if (reportsResult.error) throw reportsResult.error
  if (policiesResult.error) throw policiesResult.error
  return {
    profile: profileResult.data as SafetyProfile,
    guardians: (guardianResult.data ?? []) as GuardianRelationship[],
    reports: (reportsResult.data ?? []) as SafetyReport[],
    policies: (policiesResult.data ?? []) as PolicyDocument[],
  }
}

export async function submitSafetyReport(reason: string, details: string): Promise<void> {
  const userId = await requireUserId()
  const cleanReason = reason.trim()
  const cleanDetails = details.trim()
  if (!cleanReason) throw new Error('Choose a report reason.')
  if (cleanReason.length > 160) throw new Error('Report reason is too long.')
  if (cleanDetails.length < 10) throw new Error('Add a short description so the safety team can understand what happened.')
  if (cleanDetails.length > 4000) throw new Error('Keep report details to 4000 characters or fewer.')
  const { error } = await supabase.from('reports').insert({
    reporter_id: userId,
    target_type: 'platform_safety',
    target_id: null,
    reason: cleanReason,
    details: cleanDetails,
    status: 'open',
  })
  if (error) throw error
}

export async function requestGuardianConsent(email: string, relationship: string, phone = ''): Promise<void> {
  const cleanEmail = email.trim().toLowerCase()
  const cleanRelationship = relationship.trim()
  if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) throw new Error('Enter a valid guardian email address.')
  if (cleanRelationship.length < 2 || cleanRelationship.length > 80) throw new Error('Enter the guardian relationship.')
  const { error } = await supabase.rpc('request_my_guardian_consent', {
    p_guardian_email: cleanEmail,
    p_relationship: cleanRelationship,
    p_guardian_phone: phone.trim() || null,
  })
  if (error) throw error
}

export async function refreshSchoolSafetyStatus(): Promise<string> {
  const { data, error } = await supabase.rpc('refresh_my_school_safety_status')
  if (error) throw error
  return String(data ?? '')
}
