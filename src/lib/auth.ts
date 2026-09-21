import { supabase } from './supabase'

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
    options: { data: { full_name: fullName, role, preferred_language: 'English' } },
  })
}

export async function loginUser(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function logoutUser() {
  return supabase.auth.signOut()
}

export async function requestPasswordReset(email: string) {
  return supabase.auth.resetPasswordForEmail(email)
}

export interface MelaProfile {
  id: string
  full_name: string | null
  email: string | null
  role: MelaRole | string
  account_status: string
  email_verified: boolean
  profile_completion: number | null
  coin_balance: number
  preferred_language: string
  education_stage_key: string | null
}

export async function fetchOwnProfile(): Promise<MelaProfile | null> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, account_status, email_verified, profile_completion, coin_balance, preferred_language, education_stage_key')
    .eq('id', auth.user.id)
    .maybeSingle()
  if (error) throw error
  return data as MelaProfile | null
}

export async function updatePreferredLanguage(languageCode: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Not logged in.')

  const { data: language, error: languageError } = await supabase
    .from('platform_languages')
    .select('language_name')
    .eq('language_code', languageCode)
    .eq('enabled', true)
    .maybeSingle()

  if (languageError) throw languageError
  if (!language) throw new Error('Selected language is not available.')

  const { error } = await supabase
    .from('profiles')
    .update({ preferred_language: language.language_name })
    .eq('id', auth.user.id)

  if (error) throw error
}
