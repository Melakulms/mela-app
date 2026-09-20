import { supabase } from './supabase'

export interface Course {
  id: string
  title: string
  description: string | null
  category: string | null
  level: string | null
  duration_minutes: number | null
  price_cents: number | null
}

export interface Enrollment {
  course_id: string
  progress_pct: number | null
  completed_at: string | null
}

export async function fetchCourses(): Promise<Course[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('id, title, description, category, level, duration_minutes, price_cents')
    .eq('is_published', true)
    .order('featured_rank', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data as Course[]
}

export async function fetchMyEnrollments(): Promise<Enrollment[]> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return []
  const { data, error } = await supabase
    .from('course_enrollments')
    .select('course_id, progress_pct, completed_at')
    .eq('user_id', auth.user.id)
  if (error) throw error
  return data as Enrollment[]
}

export async function enrollInCourse(courseId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('You need to be logged in to enroll.')
  const { error } = await supabase.from('course_enrollments').insert({
    user_id: auth.user.id,
    course_id: courseId,
    progress_pct: 0,
  })
  if (error) throw error
}
