import { supabase } from './supabase'
import {
  publicMentorshipAnnouncements, safeProfileTopics,
  type MentorshipHomeExtras, type MentorshipHomeNotice,
} from './mentorship-home'

const unwrap = <T,>(result: { data: T | null; error: { message: string } | null }): T | null => {
  if (result.error) throw new Error(result.error.message)
  return result.data
}

export async function fetchMentorshipHomeExtras(): Promise<MentorshipHomeExtras> {
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!auth.user) throw new Error('Please sign in to see your personal mentorship updates.')
  const id = auth.user.id

  const results = await Promise.allSettled([
    supabase.from('student_profiles')
      .select('goals,learning_interests,preferred_learning_areas').eq('user_id', id).maybeSingle()
      .then((result) => unwrap(result)),
    supabase.from('profiles')
      .select('preferred_language').eq('id', id).maybeSingle()
      .then((result) => unwrap(result)),
    supabase.from('platform_announcements')
      .select('id,title,body,audience,starts_at,ends_at,created_at')
      .eq('status', 'published')
      .in('audience', ['all', 'student', 'students', 'learner', 'learners', 'mentorship'])
      .order('created_at', { ascending: false }).limit(15)
      .then((result) => unwrap(result)),
    supabase.from('notifications')
      .select('id,title,body,created_at,ref_table').eq('user_id', id)
      .in('ref_table', ['mentorship_requests', 'mentorship_sessions'])
      .order('created_at', { ascending: false }).limit(3)
      .then((result) => unwrap(result)),
    // Goals saved under My Mentorship (#9) must also appear on Home (#1).
    // This independent read must never block mentor discovery or announcements.
    supabase.from('mentorship_goals')
      .select('id,title,status,target_date').eq('learner_id', id)
      .in('status', ['planned','in_progress'])
      .order('created_at', { ascending:false }).limit(15)
      .then((result) => unwrap(result)),
  ] as const)

  const warnings: string[] = []
  const unpack = <T,>(position: number, label: string, fallback: T): T => {
    const result = results[position]
    if (result.status !== 'fulfilled') {
      warnings.push(label + ' are temporarily unavailable.')
      return fallback
    }
    return (result.value ?? fallback) as T
  }

  const learner = unpack(0, 'Your learning profile', null) as { goals?: unknown; learning_interests?: unknown; preferred_learning_areas?: unknown } | null
  const profile = unpack(1, 'Language preferences', null) as { preferred_language?: string } | null
  const announcements = unpack<MentorshipHomeNotice[]>(2, 'Mentorship announcements', [])
  const notifications = unpack<MentorshipHomeNotice[]>(3, 'Session updates', [])
  const savedGoals = unpack<{id:string;title:string;status:string;target_date:string|null}[]>(4, 'Saved mentorship goals', [])
  const goalTitles = savedGoals.map(goal => goal.title)

  return {
    goals: safeProfileTopics([...goalTitles, ...safeProfileTopics(learner?.goals)], 15),
    interests: safeProfileTopics([...(Array.isArray(learner?.learning_interests) ? learner.learning_interests : []),
      ...(Array.isArray(learner?.preferred_learning_areas) ? learner.preferred_learning_areas : []),
      ...(Array.isArray(learner?.goals) ? learner.goals : []),
      ...goalTitles], 16),
    preferredLanguage: typeof profile?.preferred_language === 'string' ? profile.preferred_language : '',
    announcements: publicMentorshipAnnouncements(announcements),
    updates: notifications,
    warnings,
  }
}
