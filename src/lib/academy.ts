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

export interface CourseLesson {
  id: string; course_id: string; module_title: string; title: string
  content_text: string | null; duration_minutes: number | null
}
export async function fetchCourseLessons(courseId: string): Promise<CourseLesson[]> {
  const { data, error } = await supabase.from('course_lessons')
    .select('id,course_id,module_title,title,content_text,duration_minutes')
    .eq('course_id', courseId).order('module_position').order('lesson_position')
  if (error) throw error
  return data ?? []
}
export async function fetchCompletedLessons(lessonIds: string[]): Promise<string[]> {
  if (!lessonIds.length) return []
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!auth.user) throw new Error('Please sign in again.')
  const { data, error } = await supabase.from('lesson_progress').select('lesson_id')
    .eq('user_id', auth.user.id).in('lesson_id', lessonIds)
  if (error) throw error
  return (data ?? []).map(row => row.lesson_id)
}
export async function completeCourseLesson(lessonId: string): Promise<void> {
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!auth.user) throw new Error('Please sign in again.')
  const { error } = await supabase.from('lesson_progress').upsert({ user_id: auth.user.id, lesson_id: lessonId }, { onConflict: 'user_id,lesson_id', ignoreDuplicates: true })
  if (error) throw error
}
