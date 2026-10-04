import { supabase } from './supabase'

export interface Mentor {
  user_id: string
  full_name: string | null
  headline: string | null
  bio: string | null
  organization: string | null
  years_experience: number | null
  rating_average: number
  rating_count: number
}

export interface MyMentorshipRequest {
  id: string
  mentor_id: string
  topic: string | null
  status: string
  created_at: string
}

export interface MentorshipSession {
  id: string
  request_id: string | null
  mentor_id: string | null
  mentee_id: string | null
  scheduled_at: string
  duration_min: number | null
  status: string
  call_room_id: string | null
  completed_at: string | null
  cancelled_at: string | null
  rating: number | null
  rating_comment: string | null
}

async function requireUserId(): Promise<string> {
  const { data: auth, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!auth.user) throw new Error('Your session has expired. Please sign in again.')
  return auth.user.id
}

export async function fetchVerifiedMentors(): Promise<Mentor[]> {
  const { data: mentors, error } = await supabase
    .from('mentor_profiles')
    .select('user_id, headline, bio, organization, years_experience, rating_average, rating_count')
    .eq('verified', true)
    .eq('active', true)
  if (error) throw error
  if (!mentors?.length) return []
  const ids = mentors.map((m) => m.user_id)
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, full_name').in('id', ids)
  if (pErr) throw pErr
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]))
  return mentors.map((m) => ({
    ...m,
    rating_average: Number(m.rating_average ?? 0),
    rating_count: Number(m.rating_count ?? 0),
    full_name: nameById.get(m.user_id) ?? 'MELA mentor',
  }))
}

export async function fetchMyMentorshipRequests(): Promise<MyMentorshipRequest[]> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('mentorship_requests')
    .select('id, mentor_id, topic, status, created_at')
    .eq('mentee_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as MyMentorshipRequest[]
}

export async function fetchMyMentorshipSessions(): Promise<MentorshipSession[]> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('mentorship_sessions')
    .select('id,request_id,mentor_id,mentee_id,scheduled_at,duration_min,status,call_room_id,completed_at,cancelled_at')
    .or(`mentor_id.eq.${userId},mentee_id.eq.${userId}`)
    .order('scheduled_at', { ascending: false })
  if (error) throw error

  const sessions = data ?? []
  const rateableIds = sessions
    .filter((session) => session.mentee_id === userId && session.status === 'completed')
    .map((session) => session.id)
  const ratingBySession = new Map<string, { rating: number; comment: string | null }>()

  if (rateableIds.length) {
    const { data: ratings, error: ratingError } = await supabase
      .from('mentorship_ratings')
      .select('session_id,rating,comment')
      .eq('mentee_id', userId)
      .in('session_id', rateableIds)
    if (ratingError) throw ratingError
    for (const rating of ratings ?? []) {
      ratingBySession.set(rating.session_id, { rating: Number(rating.rating), comment: rating.comment })
    }
  }

  return sessions.map((session) => {
    const saved = ratingBySession.get(session.id)
    return {
      ...session,
      rating: saved?.rating ?? null,
      rating_comment: saved?.comment ?? null,
    }
  }) as MentorshipSession[]
}

export async function requestMentor(mentorId: string, topic: string, message: string): Promise<void> {
  const cleanMentorId = mentorId.trim()
  const cleanTopic = topic.trim()
  const cleanMessage = message.trim()
  if (!cleanMentorId) throw new Error('Choose a mentor before sending your request.')
  if (cleanTopic.length < 2) throw new Error('Add a short topic before sending the request.')
  if (cleanTopic.length > 120) throw new Error('Keep the mentorship topic to 120 characters or fewer.')
  if (cleanMessage.length > 1000) throw new Error('Keep the message to 1000 characters or fewer.')

  const userId = await requireUserId()
  const { error } = await supabase.from('mentorship_requests').insert({
    mentee_id: userId,
    mentor_id: cleanMentorId,
    topic: cleanTopic,
    message: cleanMessage || null,
    status: 'pending',
  })
  if (error) throw error
}

export async function cancelMentorshipRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_mentorship_request', { p_request_id: requestId })
  if (error) throw error
}

export async function scheduleMentorshipSession(requestId: string, scheduledAt: string, durationMin: number): Promise<void> {
  if (!requestId) throw new Error('Choose an accepted mentorship request.')
  const when = new Date(scheduledAt)
  if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) throw new Error('Choose a future session time.')
  if (!Number.isInteger(durationMin) || durationMin < 15 || durationMin > 180) throw new Error('Session duration must be 15 to 180 minutes.')
  const { error } = await supabase.rpc('schedule_mentorship_session', {
    p_request_id: requestId,
    p_scheduled_at: when.toISOString(),
    p_duration_min: durationMin,
    p_call_room_id: null,
  })
  if (error) throw error
}

export async function cancelMentorshipSession(sessionId: string, reason = ''): Promise<void> {
  const { error } = await supabase.rpc('cancel_mentorship_session', {
    p_session_id: sessionId,
    p_reason: reason.trim() || null,
  })
  if (error) throw error
}

export async function completeMentorshipSession(sessionId: string, notes = ''): Promise<void> {
  const { error } = await supabase.rpc('complete_mentorship_session', {
    p_session_id: sessionId,
    p_notes: notes.trim() || null,
  })
  if (error) throw error
}

export async function rateMentorshipSession(sessionId: string, rating: number, comment = ''): Promise<void> {
  if (!sessionId) throw new Error('Choose a completed mentorship session.')
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('Choose a rating from 1 to 5.')
  const cleanComment = comment.trim()
  if (cleanComment.length > 2000) throw new Error('Keep the rating comment to 2000 characters or fewer.')
  const { error } = await supabase.rpc('rate_mentorship_session', {
    p_session_id: sessionId,
    p_rating: rating,
    p_comment: cleanComment || null,
  })
  if (error) throw error
}
