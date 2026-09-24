import { supabase } from './supabase'

export interface Opportunity {
  id: string
  title: string
  organization_name: string | null
  opportunity_type: string | null
  location: string | null
  is_remote: boolean | null
  deadline: string | null
  summary: string | null
  stipend_or_reward: string | null
  external_url: string | null
}

export interface MyApplication {
  id: string
  opportunity_id: string
  status: string
  submitted_at: string
}

export async function fetchOpenOpportunities(): Promise<Opportunity[]> {
  const { data, error } = await supabase
    .from('opportunities')
    .select('id, title, organization_name, opportunity_type, location, is_remote, deadline, summary, stipend_or_reward, external_url')
    .eq('status', 'open')
    .eq('moderation_status', 'approved')
    .eq('verified_active', true)
    .order('deadline', { ascending: true, nullsFirst: false })
    .limit(100)
  if (error) throw error
  return data as Opportunity[]
}

export async function fetchMyApplications(): Promise<MyApplication[]> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return []
  const { data, error } = await supabase
    .from('applications')
    .select('id, opportunity_id, status, submitted_at')
    .eq('user_id', auth.user.id)
  if (error) throw error
  return data as MyApplication[]
}

export async function applyToOpportunity(opportunityId: string, coverNote: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('You need to be logged in to apply.')
  const { data: opportunity, error: opportunityError } = await supabase
    .from('opportunities')
    .select('id, status, verified_active, deadline, application_method')
    .eq('id', opportunityId)
    .maybeSingle()
  if (opportunityError) throw opportunityError
  if (!opportunity) throw new Error('Opportunity not found.')
  if (opportunity.status !== 'open' || !opportunity.verified_active) throw new Error('This opportunity is not currently open for applications.')
  if (opportunity.deadline < new Date().toISOString().slice(0, 10)) throw new Error('The application deadline has passed.')
  if (opportunity.application_method !== 'mela' && opportunity.application_method !== 'both') throw new Error('This opportunity uses an external application process.')

  const { error } = await supabase.from('applications').insert({
    user_id: auth.user.id,
    applicant_id: auth.user.id,
    opportunity_id: opportunityId,
    cover_note: coverNote || null,
    status: 'submitted',
    submitted_at: new Date().toISOString(),
    applied_at: new Date().toISOString(),
    screening_answers: {},
  })
  if (error) throw error
}
