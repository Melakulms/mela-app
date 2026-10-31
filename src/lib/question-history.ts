import { supabase } from './supabase'

export type SchoolPracticeResult = {
  id: string
  program_key: string
  answered_count: number
  correct_count: number
  score_percent: number | string | null
  submitted_at: string
}

/** Only completed, server-scored sessions belonging to the signed-in learner.
 * In addition to this owner filter, Supabase RLS restricts reads by user_id.
 * No answer keys or other students' records are fetched.
 */
export async function fetchSchoolPracticeHistory(programKeys: string[]): Promise<SchoolPracticeResult[]> {
  if (!programKeys.length) return []
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!auth.user) throw new Error('Sign in to see your saved practice results.')

  const { data, error } = await supabase.from('mela_question_sessions')
    .select('id,program_key,answered_count,correct_count,score_percent,submitted_at')
    .eq('user_id', auth.user.id)
    .eq('status', 'submitted')
    .in('program_key', programKeys)
    .order('submitted_at', { ascending: false })
    .limit(8)
  if (error) throw error
  return (data ?? []) as SchoolPracticeResult[]
}
