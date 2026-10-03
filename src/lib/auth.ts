import { supabase } from './supabase'
import { authRedirectUrl } from './auth-redirect'

export type MelaRole = 'student' | 'parent' | 'teacher' | 'employer' | 'company' | 'mentor' | 'admin'

export interface RegisterInput {
  email: string
  password: string
  fullName: string
  role: Extract<MelaRole, 'student' | 'parent' | 'teacher' | 'employer' | 'company'>
}

export async function registerUser({ email, password, fullName, role }: RegisterInput) {
  return supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: authRedirectUrl(), data: { full_name: fullName, role, preferred_language: 'English' } },
  })
}

export interface BetaRegisterInput {
  username: string
  password: string
  fullName: string
  accessCode: string
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

export async function registerBetaUser({ username, password, fullName, accessCode }: BetaRegisterInput) {
  return invokeBetaAuth<BetaRegisterResult>({
    action: 'signup',
    username: username.trim().toLowerCase(),
    password,
    full_name: fullName.trim(),
    access_code: accessCode.trim(),
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
  return supabase.auth.signOut()
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
  return data as MelaProfile | null
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
