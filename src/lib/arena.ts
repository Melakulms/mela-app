import { supabase } from './supabase'

export type ArenaMode = 'speed_quiz' | 'skill_sprint' | 'interview_practice' | 'case_sprint'

export interface LeaderboardRow {
  rank: number
  user_id: string
  full_name: string | null
  rating: number
  wins: number
  matches_played: number
}

export interface QueueStatus {
  status: string
  matched_match_id: string | null
}

export async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase.rpc('get_arena_leaderboard', {
    p_scope: 'global', p_period: 'all_time', p_arena_type: null, p_career_path_id: null, p_season_id: null, p_limit: 20,
  })
  if (error) throw error
  return data as LeaderboardRow[]
}

export async function joinMatchmaking(mode: ArenaMode, assessmentId: string | null = null): Promise<void> {
  const { error } = await supabase.rpc('join_arena_matchmaking', {
    p_arena_type: mode, p_assessment_id: assessmentId, p_career_path_id: null, p_rating_range: 200,
  })
  if (error) throw error
}

export async function cancelMatchmaking(): Promise<void> {
  const { error } = await supabase.rpc('cancel_arena_matchmaking')
  if (error) throw error
}

export async function checkMyQueueStatus(): Promise<QueueStatus | null> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return null
  const { data, error } = await supabase
    .from('arena_matchmaking_queue')
    .select('status, matched_match_id')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as QueueStatus | null
}

// --- Live match (verified against the real function source; no live match
// data exists yet to test end-to-end, so `config` shape for choices follows
// the same convention as practice_questions rather than a confirmed sample) ---

export interface CurrentRound {
  round_order: number
  title: string
  state: string
  time_limit_seconds: number | null
}

export interface MatchState {
  id: string
  title: string
  status: string
  participant_count: number
  current_round: CurrentRound | null
  started_at: string | null
  ended_at: string | null
}

export interface RoundDetail {
  id: string
  prompt: string
  max_points: number
  config: { choices?: string[] } | null
}

export interface ScoreboardRow {
  rank: number
  user_id: string
  full_name: string | null
  score: number
  status: string
}

export interface RoundResult {
  is_correct: boolean | null
  score: number | null
  feedback: string | null
}

export async function fetchMatchState(matchId: string): Promise<MatchState> {
  const { data, error } = await supabase.rpc('get_arena_live_state', { p_match_id: matchId })
  if (error) throw error
  return data as MatchState
}

export async function fetchScoreboard(matchId: string): Promise<ScoreboardRow[]> {
  const { data, error } = await supabase.rpc('get_arena_live_scoreboard', { p_match_id: matchId })
  if (error) throw error
  return data as ScoreboardRow[]
}

export async function fetchCurrentRoundDetail(matchId: string, roundOrder: number): Promise<RoundDetail | null> {
  const { data, error } = await supabase
    .from('arena_rounds')
    .select('id, prompt, max_points, config')
    .eq('match_id', matchId)
    .eq('round_order', roundOrder)
    .maybeSingle()
  if (error) throw error
  return data as RoundDetail | null
}

export async function submitRound(roundId: string, answer: string): Promise<RoundResult> {
  const { data, error } = await supabase.rpc('submit_arena_round', {
    p_round_id: roundId, p_response: { answer }, p_attachment_url: null,
  })
  if (error) throw error
  return data as RoundResult
}
