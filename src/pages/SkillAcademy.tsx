import { useEffect, useState } from 'react'
import { fetchCourses, fetchMyEnrollments, enrollInCourse, type Course, type Enrollment } from '../lib/academy'

export default function SkillAcademy({ onBack }: { onBack: () => void }) {
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [enrollments, setEnrollments] = useState<Map<string, Enrollment>>(new Map())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchCourses(), fetchMyEnrollments()])
      .then(([c, e]) => {
        setCourses(c)
        setEnrollments(new Map(e.map((en) => [en.course_id, en])))
      })
      .catch((err) => setError(err.message ?? 'Could not load courses.'))
  }, [])

  const enroll = async (courseId: string) => {
    setBusy(courseId)
    setError('')
    try {
      await enrollInCourse(courseId)
      setEnrollments((prev) => new Map(prev).set(courseId, { course_id: courseId, progress_pct: 0, completed_at: null }))
    } catch (e: any) {
      setError(e.message ?? 'Could not enroll in that course.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="dash-main">
      <div className="section-heading">
        <h1>Skill Academy</h1>
        <button className="btn btn-secondary" onClick={onBack}>Back</button>
      </div>
      {error && <div className="banner banner-error">{error}</div>}
      {!courses && !error && <p className="muted">Loading courses…</p>}
      {courses && courses.length === 0 && <div className="empty-panel">No courses published yet.</div>}
      {courses && courses.length > 0 && (
        <div className="module-grid">
          {courses.map((c) => {
            const enrollment = enrollments.get(c.id)
            return (
              <div className="module-card" key={c.id}>
                <h3>{c.title}</h3>
                <p>{c.description ?? c.category}</p>
                {enrollment ? (
                  <span className="pill">{enrollment.completed_at ? 'Completed' : `${Math.round(enrollment.progress_pct ?? 0)}% complete`}</span>
                ) : (
                  <button className="btn btn-primary" onClick={() => enroll(c.id)} disabled={busy === c.id}>
                    {busy === c.id ? 'Enrolling…' : 'Enroll'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
