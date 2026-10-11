import {supabase} from './supabase'

/** Read only the current session's own profile flags. No email, username, UUID,
 * tokens, phone number, or identifying data is returned to the UI.
 */
export async function inspectMyProfileSetup():Promise<string>{
  const {data:auth,error:authError}=await supabase.auth.getUser()
  if(authError)return `Could not validate your login: ${formatProfileDiagnosticError(authError)}`
  if(!auth.user)return 'No active login. Sign in to check your profile.'
  const {data:profile,error}=await supabase.from('profiles')
    .select('role,account_status,email_verified,role_selected_at,education_stage_key,grade_level,profile_completion,education_onboarding_completed')
    .eq('id',auth.user.id).maybeSingle()
  if(error)return `Could not read your own profile: ${formatProfileDiagnosticError(error)}`
  if(!profile)return 'The signed-in account has no readable profiles row. An administrator must check account provisioning.'
  const output=[
    'MELA account setup check',
    `Account role: ${profile.role ?? 'not assigned'}`,
    `Account status: ${profile.account_status ?? 'unknown'}`,
    `Email verified: ${profile.email_verified===true?'yes':'no'}`,
    `Role selection recorded: ${profile.role_selected_at?'yes':'no'}`,
    `Education stage: ${profile.education_stage_key ?? 'not selected'}`,
    `School grade: ${profile.grade_level ?? 'not selected'}`,
    `Profile completion: ${profile.profile_completion ?? 'not reported'}`,
    `Education setup completed: ${profile.education_onboarding_completed===true?'yes':'no'}`,
  ]
  if(profile.role==='student'){
    const {data:subjects,error:subjectError}=await supabase.from('student_profiles')
      .select('subjects').eq('user_id',auth.user.id).maybeSingle()
    output.push(subjectError
      ? `Saved subjects: unreadable (${formatProfileDiagnosticError(subjectError)})`
      : `Saved subjects: ${Array.isArray(subjects?.subjects)?subjects.subjects.length:'no record'}`)
  }
  output.push('This read-only check cannot confirm backend functions or update account permissions.')
  return output.join('\n')
}

export function formatProfileDiagnosticError(cause:unknown):string{
  const value=cause && typeof cause==='object'?cause as {code?:unknown;message?:unknown}:{}
  const code=typeof value.code==='string' && /^[A-Z0-9_-]{2,25}$/i.test(value.code)?value.code:'unknown code'
  // Never display raw response bodies or arbitrary backend text here:
  // error codes are enough to locate the blocked operation.
  return `database error ${code}`
}
