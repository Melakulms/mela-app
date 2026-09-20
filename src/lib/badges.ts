import { supabase } from './supabase'

export interface EarnedBadge {
  code: string
  title: string
  earned_at: string
}

export async function fetchMyBadges(): Promise<EarnedBadge[]> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return []
  const { data, error } = await supabase
    .from('user_badges')
    .select('earned_at, badges(code, title)')
    .eq('user_id', auth.user.id)
    .order('earned_at', { ascending: false })
  if (error) throw error
  return (data as any[]).map((row) => ({
    code: row.badges.code,
    title: row.badges.title,
    earned_at: row.earned_at,
  }))
}
