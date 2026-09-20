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
