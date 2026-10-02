import { supabase } from './supabase'

export interface PassportAchievement {
  id: string
  title: string
  achievement_type: string | null
  issuer: string | null
  verified: boolean | null
  is_public: boolean | null
}

export interface VerifiedSkill {
  id: string
  skill_name: string
  level: string | null
  score: number | null
  verified: boolean | null
}

export interface CourseCertificate {
  id: string
  course_id: string
  course_title: string
  certificate_code: string
  credential_type: string
  issued_at: string
  revoked_at: string | null
}

export interface VerifiedCourseCertificate {
  certificate_code: string
  credential_type: string
  course_title: string
  learner_name: string
  issued_at: string
  valid: boolean
}

export async function fetchMyAchievements(): Promise<PassportAchievement[]> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return []
  const { data, error } = await supabase
    .from('career_passport_achievements')
    .select('id, title, achievement_type, issuer, verified, is_public')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as PassportAchievement[]
}

export async function fetchMyVerifiedSkills(): Promise<VerifiedSkill[]> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return []
  const { data, error } = await supabase
    .from('verified_skills')
    .select('id, skill_name, level, score, verified')
    .eq('user_id', auth.user.id)
  if (error) throw error
  return data as VerifiedSkill[]
}

export async function fetchMyCourseCertificates(): Promise<CourseCertificate[]> {
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!auth.user) return []
  const { data: certificates, error } = await supabase
    .from('course_certificates')
    .select('id,course_id,certificate_code,credential_type,issued_at,revoked_at')
    .eq('user_id', auth.user.id)
    .order('issued_at', { ascending: false })
  if (error) throw error
  if (!certificates?.length) return []
  const courseIds = [...new Set(certificates.map((row) => row.course_id))]
  const { data: courses, error: courseError } = await supabase.from('courses').select('id,title').in('id', courseIds)
  if (courseError) throw courseError
  const titleById = new Map((courses ?? []).map((row) => [row.id, row.title]))
  return certificates.map((row) => ({ ...row, course_title: titleById.get(row.course_id) ?? 'MELA course' })) as CourseCertificate[]
}

export async function verifyCourseCertificate(code: string): Promise<VerifiedCourseCertificate | null> {
  const normalized = code.trim().toUpperCase()
  if (!normalized) return null
  const { data, error } = await supabase.rpc('verify_course_certificate', { p_certificate_code: normalized })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return row ? row as VerifiedCourseCertificate : null
}
