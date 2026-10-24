import { clearCoachHistories } from './coach-history'
import { supabase, AUTH_STORAGE_KEY } from './supabase'
import { authRedirectUrl } from './auth-redirect'

export type MelaRole = 'student' | 'parent' | 'teacher' | 'employer' | 'company' | 'mentor' | 'admin' | 'super_admin'

export interface RegisterInput {
  email: string
  password: string
  fullName: string
  role: BetaSignupRole
}

export async function registerUser({ email, password, fullName, role }: RegisterInput) {
  return supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: authRedirectUrl(), data: { full_name: fullName, role, preferred_language: 'English' } },
  })
}

export type BetaSignupRole = 'student' | 'parent' | 'teacher' | 'company'

export interface BetaRegisterInput {
  role: BetaSignupRole
  username: string
  password: string
  fullName: string
  accessCode: string
  adultConfirmed?: boolean
}

export interface BetaRegisterResult {
  created: boolean
  username: string
  role: string
  recovery_code: string
  recovery_notice: string
}

export interface BetaResetResult {
  reset: boolean
  recovery_code: string
  recovery_notice: string
}

async function invokeBetaAuth<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('mela-beta-auth', { body })
  if (error) {
    let message = error.message || 'Beta authentication request failed.'
    const context = (error as { context?: Response }).context
    if (context && typeof context.clone === 'function') {
      try {
        const payload = await context.clone().json() as { error?: string }
        if (payload?.error) message = payload.error
      } catch { /* keep the original message */ }
    }
    throw new Error(message)
  }
  if (data && typeof data === 'object' && 'error' in data && typeof (data as { error?: unknown }).error === 'string') {
    throw new Error((data as { error: string }).error)
  }
  return data as T
}

export async function registerBetaUser({ username, password, fullName, accessCode, role, adultConfirmed }: BetaRegisterInput) {
  return invokeBetaAuth<BetaRegisterResult>({
    action: 'signup',
    username: username.trim().toLowerCase(),
    password,
    full_name: fullName.trim(),
    access_code: accessCode.trim(),
    requested_role: role,
    adult_confirmed: adultConfirmed === true,
  })
}

export async function resetBetaPassword(username: string, recoveryCode: string, newPassword: string) {
  return invokeBetaAuth<BetaResetResult>({
    action: 'reset_password',
    username: username.trim().toLowerCase(),
    recovery_code: recoveryCode.trim(),
    new_password: newPassword,
  })
}

export async function loginUser(identifier: string, password: string) {
  const normalized = identifier.trim().toLowerCase()
  const email = normalized.includes('@') ? normalized : `${normalized}@beta.mela.invalid`
  return supabase.auth.signInWithPassword({ email, password })
}

export async function logoutUser() {
  // Local privacy must not depend on the network being available.
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      supabase.auth.signOut({ scope: 'local' }),
      new Promise<void>(resolve => { timer = setTimeout(resolve, 4000) }),
    ])
  } catch { /* The hard navigation below also discards the in-memory session. */ }
  finally {
    clearTimeout(timer)
    clearCoachHistories()
    for (const name of ['localStorage', 'sessionStorage'] as const) {
      try {
        const storage = window[name]
        for (const key of Object.keys(storage)) {
          if (key === AUTH_STORAGE_KEY || key.startsWith(AUTH_STORAGE_KEY + '-')) storage.removeItem(key)
        }
      } catch { /* Storage can be disabled by the browser. */ }
    }
    window.dispatchEvent(new Event('mela:session-boundary'))
    window.location.replace(import.meta.env.BASE_URL + '?signed_out=1')
  }
  return { error: null }
}

export async function requestPasswordReset(email: string) {
  return supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirectUrl(undefined,undefined,true) })
}

export interface MelaProfile {
  id: string
  username: string | null
  full_name: string | null
  email: string | null
  role: MelaRole | string
  account_status: string
  email_verified: boolean
  profile_completion: number | null
  coin_balance: number
  preferred_language: string
  education_stage_key: string | null
  grade_level: number | null
  education_onboarding_completed: boolean
}

export async function fetchOwnProfile(): Promise<MelaProfile | null> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, email, role, account_status, email_verified, profile_completion, coin_balance, preferred_language, education_stage_key, grade_level, education_onboarding_completed')
    .eq('id', auth.user.id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const profile = data as MelaProfile
  if (profile.role === 'student' && profile.education_onboarding_completed) {
    const stage = profile.education_stage_key
    const validStage = stage === 'college_tvet' || stage === 'university' ||
      (stage === 'school_1_6' && profile.grade_level !== null && profile.grade_level >= 1 && profile.grade_level <= 6) ||
      (stage === 'school_7_8' && profile.grade_level !== null && profile.grade_level >= 7 && profile.grade_level <= 8) ||
      (stage === 'school_9_10' && profile.grade_level !== null && profile.grade_level >= 9 && profile.grade_level <= 10) ||
      (stage === 'school_11_12' && profile.grade_level !== null && profile.grade_level >= 11 && profile.grade_level <= 12)
    if (!validStage) return { ...profile, education_onboarding_completed: false }
    // Historical profiles can be flagged complete after grade selection alone.
    // An actual saved list of enrolled subjects must exist before entering lessons.
    const { data: studentProfile, error: studentError } = await supabase
      .from('student_profiles').select('subjects').eq('user_id', profile.id).maybeSingle()
    // A restricted/missing student_profiles read must not trap an otherwise
    // verified, active learner on the global account-error screen. Keep their
    // education access incomplete and allow safe feature discovery instead.
    if (studentError || !Array.isArray(studentProfile?.subjects) || studentProfile.subjects.length === 0) {
      return { ...profile, education_onboarding_completed: false }
    }
  }
  return profile
}

export async function updatePreferredLanguage(languageName: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Not logged in.')

  const { data: language, error: languageError } = await supabase
    .from('platform_languages')
    .select('language_name')
    .eq('language_name', languageName)
    .eq('enabled', true)
    .maybeSingle()
  if (languageError) throw languageError
  if (!language) throw new Error('Selected language is not available.')

  const { error } = await supabase.from('profiles').update({ preferred_language: languageName }).eq('id', auth.user.id)
  if (error) throw error
}
