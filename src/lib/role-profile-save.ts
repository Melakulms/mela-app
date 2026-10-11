import { supabase } from './supabase'
import { normalizeLanguageCode } from '../i18n'

export type SetupRole = 'parent' | 'teacher' | 'company'
type ProfileSetupInput = {
  role: SetupRole
  name: string
  city?: string
  region?: string
  institution?: string
  details: Record<string, unknown>
}

const TABLES: Record<SetupRole, string> = {
  parent: 'parent_profiles',
  teacher: 'teacher_profiles',
  company: 'company_profiles',
}

export function formatRoleProfileError(cause: unknown, stage: string): string {
  const problem = cause && typeof cause === 'object' ? cause as { message?: unknown; code?: unknown } : {}
  const raw = typeof problem.message === 'string' ? problem.message
    : cause instanceof Error ? cause.message : 'The server returned an unreadable error.'
  const safe = raw.replace(/Bearer\s+[A-Za-z0-9._-]+/ig, '[hidden]')
    .replace(/(?:access_token|refresh_token|apikey|password)\s*[:=]\s*[^\s,;}]+/ig, '[hidden]').slice(0, 240)
  const code = typeof problem.code === 'string' && /^[A-Z0-9_]{2,30}$/i.test(problem.code) ? ` (${problem.code})` : ''
  return `Unable to finish ${stage}: ${safe}${code}. Your form entries have not been cleared.`
}

export async function saveRoleProfile(input: ProfileSetupInput): Promise<void> {
  let step = 'checking your account'
  try {
    const { data: auth, error: authError } = await supabase.auth.getUser()
    if (authError) throw authError
    if (!auth.user) throw new Error('Please sign in again.')
    const { data: profile, error: profileError } = await supabase.from('profiles')
      .select('role,account_status,preferred_language,role_selected_at')
      .eq('id', auth.user.id).maybeSingle()
    if (profileError) throw profileError
    if (!profile || profile.role !== input.role) {
      throw new Error('This account is not authorized for the selected profile type. Your role is assigned during verified account registration.')
    }
    if (profile.account_status !== 'active' || !profile.role_selected_at) {
      throw new Error('Your account role is not active or has not been confirmed. Contact MELA support.')
    }
    step = 'saving your role-specific profile'
    const {error} = await supabase.rpc('complete_my_profile_v37', {
      p_full_name: input.name.trim(),
      p_preferred_language: normalizeLanguageCode(profile.preferred_language),
      p_city: input.city?.trim() || null,
      p_region: input.region?.trim() || null,
      p_institution_name: input.institution?.trim() || null,
      p_details: input.details,
    })
    if (error) throw error
    step = 'verifying the saved profile'
    const {data: savedProfile, error: readError} = await supabase.from('profiles')
      .select('profile_completion,role').eq('id',auth.user.id).maybeSingle()
    if (readError) throw readError
    if (!savedProfile || savedProfile.role !== input.role || savedProfile.profile_completion !== 100) {
      throw new Error('MELA could not confirm your completed account profile.')
    }
    const {data: savedDetails,error: detailsError} = await supabase.from(TABLES[input.role])
      .select('user_id').eq('user_id', auth.user.id).maybeSingle()
    if (detailsError) throw detailsError
    if (savedDetails?.user_id !== auth.user.id) {
      throw new Error('MELA could not confirm your separate role-profile record.')
    }
  } catch (cause) {
    throw new Error(formatRoleProfileError(cause,step))
  }
}

export function parseSafeList(text: string): string[] {
  return [...new Set(text.split(',').map(value => value.trim()).filter(Boolean))].slice(0, 20)
}
