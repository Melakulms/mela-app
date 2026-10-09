import { useEffect, useRef, useState } from 'react'
import LessonText from './LessonText'
import { completeCourseLesson, fetchCompletedLessons, fetchCourseLessons, type Course, type CourseLesson } from '../lib/academy'

export default function CourseReader({ course, onBack, preview = false }: { course: Course; onBack: () => void; preview?: boolean }) {
  const [lessons, setLessons] = useState<CourseLesson[]>([])
  const [completed, setCompleted] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const saveLock = useRef(false)
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    void (async () => {
      try {
        const rows = await fetchCourseLessons(course.id)
        const done = preview ? [] : await fetchCompletedLessons(rows.map(row => row.id))
        if (active) { setLessons(rows); setCompleted(done); setSelected(rows.find(row => !done.includes(row.id))?.id ?? rows[0]?.id ?? null) }
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Could not load course lessons. Please retry.') }
      finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [course.id, preview, revision])
  const selectedIndex = lessons.findIndex(row => row.id === selected)
  const lesson = lessons.find(row => row.id === selected)
  const complete = async () => {
    if (preview || !lesson || saveLock.current || completed.includes(lesson.id)) return
    saveLock.current = true; setSaving(true); setError('')
    try { await completeCourseLesson(lesson.id); setCompleted(previous => [...new Set([...previous, lesson.id])]) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save completion. Please retry.') }
    finally { saveLock.current = false; setSaving(false) }
  }
  return <div className="dash-main">
    <div className="section-heading"><h1>{course.title}</h1><button className="btn btn-secondary" disabled={saving} onClick={onBack}>Back to courses</button></div>
    {error && <div className="banner banner-error" role="alert">{error}<button className="btn btn-secondary" disabled={saving || loading} onClick={() => setRevision(value => value + 1)}>Reload lessons</button></div>}
    {loading ? <p role="status">Loading lessons…</p> : !error && !lessons.length ? <p>No lessons are available for this course yet.</p> : <>
      <p role="status">{preview ? `Preview: ${lessons.length} of ${course.lesson_count} lessons` : `${completed.length} of ${lessons.length} lessons completed`}</p>
      {!preview && lessons.length > 0 && completed.length === lessons.length && <p className="banner" role="status">You have completed every lesson. Your saved course progress is available in My courses.</p>}
      <nav aria-label="Course lessons" className="list-panel">{lessons.map(row => <button key={row.id} className="btn btn-secondary" disabled={saving} aria-current={row.id === selected ? 'step' : undefined} onClick={() => {setSelected(row.id);setError('')}}>{row.module_title} · {row.title}{completed.includes(row.id) ? ' · Completed' : ''}</button>)}</nav>
      {lesson && <article><h2>{lesson.title}</h2><p>{lesson.duration_minutes ? `${lesson.duration_minutes} minutes` : ''}</p>
        <LessonText text={lesson.content_text || 'Lesson content has not been published yet.'} />
        {!preview && <button className="btn btn-primary" disabled={saving || !lesson.content_text || completed.includes(lesson.id)} onClick={complete}>{saving ? 'Saving…' : completed.includes(lesson.id) ? 'Lesson completed' : 'Mark lesson complete'}</button>}
        <div className="section-heading"><button className="btn btn-secondary" disabled={saving || selectedIndex <= 0} onClick={() => {setSelected(lessons[selectedIndex - 1].id);setError('')}}>Previous lesson</button><button className="btn btn-secondary" disabled={saving || selectedIndex < 0 || selectedIndex >= lessons.length - 1} onClick={() => {setSelected(lessons[selectedIndex + 1].id);setError('')}}>Next lesson</button></div>
      </article>}
    </>}
  </div>
}
