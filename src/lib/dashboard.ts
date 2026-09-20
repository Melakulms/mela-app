import { supabase } from './supabase'

export interface PracticeRecommendation {
  topic: string
  reason: string
  subject: string
  priority: number
  topic_id: string
  mastery_level: string
  mastery_score: number
  career_path_id: string
  recommended_mode: string
  recommended_difficulty: number
}

export interface ScholarshipMatch {
  id: string
  title: string
  coverage: string[]
  deadline: string
  location: string
  institution: string
  funding_type: string
  program_name: string
  study_country: string
  organization_name: string
  stipend_or_reward: string
}

export interface MelaDashboard {
  profile: {
    id: string
    full_name: string | null
    email: string | null
    role: string
    city: string | null
    major: string | null
    university: string | null
    avatar_url: string | null
    preferred_language: string
    availability_status: string
    verified_passport_badge_count: number
  }
  passport: {
    badge_count: number
    profile_score: number
    project_count: number
    document_count: number
    language_count: number
    education_count: number
    experience_count: number
    verified_skill_count: number
    verified_document_count: number
  }
  practice: {
    stats: {
      total_sessions: number
      correct_answers: number
      total_questions: number
      total_time_seconds: number
      current_streak_days: number
      longest_streak_days: number
    }
    weak_topics: unknown[]
    strong_topics: unknown[]
    recent_sessions: unknown[]
    recommendations: PracticeRecommendation[]
  }
  arena: {
    overall: unknown
    ratings: unknown[]
    matchmaking: unknown
    recent_matches: unknown[]
    arena_achievements: number
    pending_cash_rewards: number
  }
  applications: { hired: number; total: number; active: number; recent: unknown[] }
  scholarships: ScholarshipMatch[]
  achievements: unknown[]
  notifications: unknown[]
  opportunity_matches: unknown[]
  saved_opportunities: number
  unread_notifications: number
  feature_flags: Record<string, boolean>
  wallet: Record<string, unknown>
  coach_actions: unknown[]
  current_path: Record<string, unknown>
  verified_skills: unknown[]
  weak_practice: unknown[]
}

export async function fetchDashboard(): Promise<MelaDashboard> {
  const { data, error } = await supabase.rpc('get_my_dashboard_v36')
  if (error) throw error
  return data as MelaDashboard
}
