import { supabase } from './supabase'

export interface Mentor {
  user_id: string
  full_name: string | null
  headline: string | null
  bio: string | null
  organization: string | null
  years_experience: number | null
}

export interface MyMentorshipRequest {
  id: string
  mentor_id: string
  topic: string | null
  status: string
  created_at: string
}

export async function fetchVerifiedMentors(): Promise<Mentor[]> {
  const { data: mentors, error } = await supabase
    .from('mentor_profiles')
    .select('user_id, headline, bio, organization, years_experience')
    .eq('verified', true)
    .eq('active', true)
  if (error) throw error
  if (!mentors?.length) return []
  const ids = mentors.map((m) => m.user_id)
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, full_name').in('id', ids)
  if (pErr) throw pErr
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]))
  return mentors.map((m) => ({ ...m, full_name: nameById.get(m.user_id) ?? 'MELA mentor' }))
}

export async function fetchMyMentorshipRequests(): Promise<MyMentorshipRequest[]> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return []
  const { data, error } = await supabase
    .from('mentorship_requests')
    .select('id, mentor_id, topic, status, created_at')
    .eq('mentee_id', auth.user.id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as MyMentorshipRequest[]
}

export async function requestMentor(mentorId: string, topic: string, message: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('You need to be logged in to request a mentor.')
  const { error } = await supabase.from('mentorship_requests').insert({
    mentee_id: auth.user.id,
    mentor_id: mentorId,
    topic,
    message: message || null,
    status: 'pending',
  })
  if (error) throw error
}
