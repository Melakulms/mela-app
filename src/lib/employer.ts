import { supabase } from './supabase'

export interface MyEmployerRequest {
  id: string
  status: string
  company_name: string
  review_notes: string | null
}

export interface MyEmployer {
  id: string
  company_name: string
  verified: boolean
  verification_status: string
}

export interface MyOpportunity {
  id: string
  title: string
  status: string
  moderation_status: string
  created_at: string
}

export interface Applicant {
  id: string
  status: string
  submitted_at: string
  full_name: string | null
  email: string | null
}

export async function fetchMyRegistrationRequest(): Promise<MyEmployerRequest | null> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return null
  const { data, error } = await supabase
    .from('employer_registration_requests')
    .select('id, status, company_name, review_notes')
    .eq('applicant_user_id', auth.user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as MyEmployerRequest | null
}

export async function submitRegistration(input: { companyName: string; legalName: string; contactEmail: string; industry: string; description: string }): Promise<void> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('You need to be logged in.')
  const { error } = await supabase.from('employer_registration_requests').insert({
    applicant_user_id: auth.user.id,
    company_name: input.companyName,
    legal_name: input.legalName,
    contact_email: input.contactEmail,
    industry: input.industry,
    description: input.description,
    status: 'pending',
  })
  if (error) throw error
}

export async function fetchMyEmployer(): Promise<MyEmployer | null> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return null
  const { data, error } = await supabase
    .from('employers')
    .select('id, company_name, verified, verification_status')
    .eq('owner_id', auth.user.id)
    .maybeSingle()
  if (error) throw error
  return data as MyEmployer | null
}

export async function fetchMyOpportunities(employerId: string): Promise<MyOpportunity[]> {
  const { data, error } = await supabase
    .from('opportunities')
    .select('id, title, status, moderation_status, created_at')
    .eq('employer_id', employerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as MyOpportunity[]
}

export async function createOpportunity(employerId: string, input: { title: string; opportunityType: string; location: string; deadline: string; summary: string }): Promise<void> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('You need to be logged in.')
  const { error } = await supabase.from('opportunities').insert({
    posted_by: auth.user.id,
    employer_id: employerId,
    title: input.title,
    opportunity_type: input.opportunityType,
    location: input.location || null,
    deadline: input.deadline || null,
    summary: input.summary || null,
    status: 'pending_review',
    moderation_status: 'pending_review',
  })
  if (error) throw error
}

export async function fetchApplicants(opportunityId: string): Promise<Applicant[]> {
  const { data: apps, error } = await supabase
    .from('applications')
    .select('id, status, submitted_at, user_id')
    .eq('opportunity_id', opportunityId)
  if (error) throw error
  if (!apps?.length) return []
  const ids = apps.map((a) => a.user_id)
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, full_name, email').in('id', ids)
  if (pErr) throw pErr
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]))
  return apps.map((a) => ({
    id: a.id, status: a.status, submitted_at: a.submitted_at,
    full_name: byId.get(a.user_id)?.full_name ?? null,
    email: byId.get(a.user_id)?.email ?? null,
  }))
}

export async function updateApplicationStatus(applicationId: string, status: 'reviewing'|'shortlisted'|'interview'|'offered'|'hired'|'rejected') {
  const { error } = await supabase.from('applications').update({ status, reviewed_at: new Date().toISOString() }).eq('id', applicationId)
  if (error) throw error
}
