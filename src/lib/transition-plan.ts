import { supabase } from './supabase'

export type TransitionStepStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped'
export async function saveTransitionStep(planId: string, stepId: string, status: TransitionStepStatus) {
  if (!planId || !stepId || !['not_started', 'in_progress', 'completed', 'skipped'].includes(status)) throw new Error('Invalid plan step.')
  // Existing owner policies authorize this write; a denied/no-row update is a failure.
  const { data, error } = await supabase.from('mela_transition_steps')
    .update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null })
    .eq('plan_id', planId).eq('id', stepId).select('id,status,completed_at').single()
  if (error) throw error
  if (!data) throw new Error('Your plan step could not be saved. Refresh and retry.')
  return data
}
