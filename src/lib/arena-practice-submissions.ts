import { supabase } from './supabase'

export type ArenaWrittenPracticeMode =
  | 'skill_sprint'
  | 'interview_practice'
  | 'case_sprint'
  | 'employer_challenge'

export type ArenaPracticeReceipt = {
  id: string
  response_text: string
  saved_at: string
}

const EXERCISE_KEY = 'arena-written-demo-v1'
const TABLE = 'arena_practice_submissions'

async function signedInStudentId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('Sign in with your student account to save this practice answer.')
  return data.user.id
}

/**
 * Reads only the learner's own private practice response. Database RLS provides
 * the actual authorization; the user ID supplied here only narrows the lookup.
 */
export async function loadArenaPracticeAnswer(mode:ArenaWrittenPracticeMode):Promise<ArenaPracticeReceipt|null> {
  const userId=await signedInStudentId()
  const {data,error}=await supabase.from(TABLE)
    .select('id,response_text,saved_at')
    .eq('user_id',userId).eq('practice_kind',mode).eq('exercise_key',EXERCISE_KEY)
    .maybeSingle()
  if (error) throw error
  return data as ArenaPracticeReceipt|null
}

/**
 * Save an answer to a PRIVATE, private PRACTICE record.
 * This is not sent to an employer, not a real competition submission,
 * and cannot be treated as a certified result or application.
 */
export async function saveArenaPracticeAnswer(
  mode:ArenaWrittenPracticeMode,answer:string
):Promise<ArenaPracticeReceipt> {
  const response=answer.trim()
  if (!response) throw new Error('Write an answer before tapping Submit.')
  if (response.length>5000) throw new Error('Please shorten your answer to 5,000 characters.')
  const userId=await signedInStudentId()
  const {data,error}=await supabase.from(TABLE)
    .upsert({
      user_id:userId,practice_kind:mode,exercise_key:EXERCISE_KEY,
      response_text:response,saved_at:new Date().toISOString(),
    },{onConflict:'user_id,practice_kind,exercise_key'})
    .select('id,response_text,saved_at').single()
  if (error) throw error
  if (!data?.id) throw new Error('No submission receipt was returned. Your answer was not confirmed as saved.')
  return data as ArenaPracticeReceipt
}
