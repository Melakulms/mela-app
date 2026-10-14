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
  if(profile.role==='teacher'){
    const {data:teacher,error:teacherError}=await supabase.from('teacher_profiles')
      .select('subjects_taught,grade_levels,verification_status').eq('user_id',auth.user.id).maybeSingle()
    output.push(teacherError
      ? `Teaching profile: unreadable (${formatProfileDiagnosticError(teacherError)})`
      : teacher ? 'Teaching profile: submitted' : 'Teaching profile: not submitted')
    if(teacher){
      output.push(`Teaching subjects recorded: ${Array.isArray(teacher.subjects_taught)?teacher.subjects_taught.length:0}`)
      output.push(`Grade levels recorded: ${Array.isArray(teacher.grade_levels)?teacher.grade_levels.length:0}`)
      output.push(`Teaching credential review: ${teacher.verification_status??'pending'}`)
    }
  }
  if(profile.role==='parent' || profile.role==='company'){
    const table=profile.role==='parent'?'parent_profiles':'company_profiles'
    const {data:record,error:recordError}=await supabase.from(table).select('user_id')
      .eq('user_id',auth.user.id).maybeSingle()
    output.push(recordError
      ? `Role-specific profile: unreadable (${formatProfileDiagnosticError(recordError)})`
      : record?'Role-specific profile: submitted':'Role-specific profile: not submitted')
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
