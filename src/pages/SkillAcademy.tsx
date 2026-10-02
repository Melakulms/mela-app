import { useEffect, useRef, useState } from 'react'
import CourseReader from '../components/CourseReader'
import { fetchCourses, fetchMyEnrollments, enrollInCourse, type Course, type Enrollment } from '../lib/academy'

export default function SkillAcademy({ onBack }: { onBack: () => void }) {
  const [selected, setSelected] = useState<Course | null>(null)
  const [revision, setRevision] = useState(0)
  const lock = useRef(false)
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [enrollments, setEnrollments] = useState<Map<string, Enrollment>>(new Map())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setError('')
    Promise.all([fetchCourses(), fetchMyEnrollments()])
      .then(([c, e]) => {
        if (!active) return
        setCourses(c)
        setEnrollments(new Map(e.map((en) => [en.course_id, en])))
      })
      .catch((err) => { if (active) setError(err.message ?? 'Could not load courses.') })
  return () => { active = false }
  }, [revision])

  const enroll = async (courseId: string) => {
    if (lock.current) return
    lock.current = true
    setBusy(courseId)
    setError('')
    try {
      await enrollInCourse(courseId)
      setEnrollments((prev) => new Map(prev).set(courseId, { course_id: courseId, progress_pct: 0, completed_at: null }))
    } catch (e: any) {
      setError(e.message ?? 'Could not enroll in that course.')
    } finally {
      lock.current = false
      setBusy(null)
    }
  }

  if (selected) return <CourseReader course={selected} onBack={() => {setSelected(null);setRevision(value => value + 1)}} />

  return (
    <div className="dash-main">
      <div className="section-heading">
        <h1>Skill Academy</h1>
        <button className="btn btn-secondary" onClick={onBack}>Back</button>
      </div>
      {error && <div className="banner banner-error" role="alert">{error}<button className="btn btn-secondary" onClick={() => setRevision(value => value + 1)}>Retry courses</button></div>}
      {!courses && !error && <p className="muted">Loading courses…</p>}
      {courses && courses.length === 0 && <div className="empty-panel">No courses published yet.</div>}
      {courses && courses.length > 0 && (
        <div className="module-grid">
          {courses.map((c) => {
            const enrollment = enrollments.get(c.id)
            const isFree = (c.price_cents ?? 0) === 0
            return (
              <div className="module-card" key={c.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
                <h3 style={{ color: 'var(--ink)' }}>{c.title}</h3>
                <p style={{ color: 'var(--muted)' }}>{c.description ?? c.category}</p>
                {enrollment ? (
                  <button className="btn btn-primary" onClick={() => setSelected(c)}>{enrollment.completed_at ? 'Review course' : 'Continue learning'}</button>
                ) : isFree ? (
                  <button className="btn btn-primary" onClick={() => enroll(c.id)} disabled={busy !== null}>
                    {busy === c.id ? 'Enrolling…' : 'Enroll free'}
                  </button>
                ) : (
                  <span className="pill">
                    {((c.price_cents ?? 0) / 100).toFixed(0)} ETB · purchasing isn't available yet
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
