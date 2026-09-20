import { supabase } from './supabase'

export interface Scholarship {
  id: string
  title: string
  institution: string | null
  program_name: string | null
  study_country: string | null
  funding_type: string | null
  coverage: string[] | null
  award_amount: number | null
  award_currency: string | null
  deadline: string | null
  application_method: string
  external_url: string | null
}

export async function fetchOpenScholarships(): Promise<Scholarship[]> {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('opportunities')
    .select('id, title, deadline, application_method, external_url, scholarship_details(institution, program_name, study_country, funding_type, coverage, award_amount, award_currency)')
    .eq('status', 'open')
    .eq('moderation_status', 'approved')
    .eq('verified_active', true)
    .eq('opportunity_type', 'scholarships')
    .or(`deadline.is.null,deadline.gte.${today}`)
    .order('deadline', { ascending: true, nullsFirst: false })
    .limit(100)
  if (error) throw error
  return (data as any[]).map((row) => ({
    id: row.id,
    title: row.title,
    deadline: row.deadline,
    application_method: row.application_method,
    external_url: row.external_url ?? null,
    institution: row.scholarship_details?.institution ?? null,
    program_name: row.scholarship_details?.program_name ?? null,
    study_country: row.scholarship_details?.study_country ?? null,
    funding_type: row.scholarship_details?.funding_type ?? null,
    coverage: row.scholarship_details?.coverage ?? null,
    award_amount: row.scholarship_details?.award_amount ?? null,
    award_currency: row.scholarship_details?.award_currency ?? null,
  }))
}
