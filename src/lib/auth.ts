import { supabase } from './supabase'

export type MelaRole = 'student' | 'parent' | 'teacher' | 'company' | 'mentor'

export interface RegisterInput {
  email: string
  password: string
  fullName: string
  role: MelaRole
}

export async function registerUser({ email, password, fullName, role }: RegisterInput) {
  return supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, role, preferred_language: 'en' } },
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
}

export async function fetchOwnProfile(): Promise<MelaProfile | null> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, account_status, email_verified, profile_completion')
    .eq('id', auth.user.id)
    .maybeSingle()
  if (error) throw error
  return data as MelaProfile | null
}
