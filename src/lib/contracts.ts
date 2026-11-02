import { supabase } from './supabase'

export interface Contract {
  id: string
  task_id?: string
  freelancer_id?: string
  status: string
  agreed_amount: number
  currency: string
  funding_status: string
  terms?: string | null
  created_at?: string
}
export interface WorkMilestone {
  id: string
  contract_id: string
  title: string
  description?: string | null
  status: string
  amount: number
  due_at?: string | null
  deliverable_url?: string | null
  submission_note?: string | null
  review_notes?: string | null
}
export interface WorkReview { id: string; contract_id: string; reviewer_user_id: string; rating: number }

export async function fetchMyContracts(): Promise<Contract[]> {
  const { data, error } = await supabase.from('freelance_contracts')
    .select('id,task_id,freelancer_id,status,terms,agreed_amount,currency,funding_status,created_at')
    .in('status', ['proposed', 'active', 'disputed', 'completed', 'cancelled'])
    .order('created_at', { ascending: false }).limit(50)
  if (error) throw error
  return data ?? []
}
export async function fetchMyMilestones(contractIds: string[]): Promise<WorkMilestone[]> {
  if (!contractIds.length) return []
  const { data, error } = await supabase.from('task_milestones')
    .select('id,contract_id,title,description,status,amount,due_at,deliverable_url,submission_note,review_notes')
    .in('contract_id', contractIds).order('milestone_order', { ascending: true }).limit(100)
  if (error) throw error
  return data ?? []
}
export async function fetchMyReviews(contractIds: string[]): Promise<WorkReview[]> {
  if (!contractIds.length) return []
  const { data, error } = await supabase.from('work_reviews')
    .select('id,contract_id,reviewer_user_id,rating').in('contract_id', contractIds).limit(100)
  if (error) throw error
  return data ?? []
}
export async function raiseContractDispute(contractId: string, reason: string) {
  const text = reason.trim()
  if (text.length < 10 || text.length > 2000) throw new Error('Explain the issue in 10–2000 characters.')
  const { error } = await supabase.rpc('raise_contract_dispute', { p_contract_id: contractId, p_reason: text })
  if (error) throw error
}
export async function respondToContract(contractId: string, accept: boolean, reason?: string) {
  const { data, error } = await supabase.rpc('respond_freelance_contract', {
    p_contract_id: contractId, p_accept: accept, p_reason: accept ? null : (reason?.trim() || 'Declined by freelancer'),
  })
  if (error) throw error
  if (!data || data.status !== (accept ? 'active' : 'cancelled')) throw new Error('Contract response could not be confirmed.')
}
export async function submitWorkMilestone(milestoneId: string, url: string, note: string) {
  const clean = url.trim()
  try { if (new URL(clean).protocol !== 'https:') throw new Error() }
  catch { throw new Error('Use a valid HTTPS deliverable link.') }
  if (note.trim().length > 2000) throw new Error('The delivery note is too long.')
  const { data, error } = await supabase.rpc('submit_task_milestone', {
    p_milestone_id: milestoneId, p_deliverable_url: clean, p_submission_note: note.trim() || null,
  })
  if (error) throw error
  if (!data || data.status !== 'submitted') throw new Error('The delivery was not confirmed by MELA.')
}
export async function submitContractReview(contractId: string, rating: number, comment: string) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('Choose a rating between 1 and 5.')
  const { data, error } = await supabase.rpc('submit_work_review', {
    p_contract_id: contractId, p_rating: rating, p_comment: comment.trim() || null,
    p_quality: null, p_communication: null, p_timeliness: null,
  })
  if (error) throw error
  if (!data?.id) throw new Error('MELA could not confirm the review.')
}
export async function withdrawMyProposal(proposalId: string) {
  const { data, error } = await supabase.rpc('withdraw_freelance_proposal', { p_submission_id: proposalId })
  if (error) throw error
  if (!data || data.status !== 'withdrawn') throw new Error('Withdrawal was not confirmed.')
}
