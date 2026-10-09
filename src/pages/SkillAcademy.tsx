import { useEffect, useRef, useState } from 'react'
import CourseReader from '../components/CourseReader'
import { fetchCourses, fetchMyEnrollments, enrollInCourse, type Course, type Enrollment } from '../lib/academy'
import { useI18n } from '../i18n'

export default function SkillAcademy({ onBack }: { onBack: () => void }) {
  const { t } = useI18n()
  const [query, setQuery] = useState(''), [category, setCategory] = useState(''), [scope, setScope] = useState('all')
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
      setSelected(courses?.find(course => course.id === courseId) ?? null)
    } catch (e: any) {
      setError(e.message ?? 'Could not enroll in that course.')
    } finally {
      lock.current = false
      setBusy(null)
    }
  }

  const visibleCourses = (courses ?? []).filter(course => (!category || course.category === category) && (scope === 'all' || (scope === 'enrolled' && enrollments.has(course.id)) || (scope === 'completed' && !!enrollments.get(course.id)?.completed_at)) && `${course.title} ${course.description ?? ''} ${course.category ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))

  if (selected) return <CourseReader course={selected} onBack={() => { setSelected(null); setRevision(value => value + 1) }} />

  return (
    <div className="dash-main">
      <div className="section-heading">
        <h1>{t('skillAcademy')}</h1>
        <button className="btn btn-secondary" onClick={onBack}>{t('back')}</button>
      </div>
      {error && <div className="banner banner-error" role="alert">{error}<button className="btn btn-secondary" onClick={() => setRevision(value => value + 1)}>Retry courses</button></div>}
      {!courses && !error && <p className="muted">Loading courses…</p>}
      {courses && courses.length === 0 && <div className="empty-panel">No courses published yet.</div>}
      {courses && courses.length > 0 && <>
        <div className="field"><label htmlFor="course-search">Search courses</label><input id="course-search" type="search" value={query} onChange={e => setQuery(e.target.value)} /></div>
        <div className="field"><label htmlFor="course-category">Category</label><select id="course-category" value={category} onChange={e => setCategory(e.target.value)}><option value="">All categories</option>{Array.from(new Set(courses.map(course => course.category).filter((value): value is string => !!value))).map(value => <option key={value} value={value}>{value}</option>)}</select></div>
        <div className="field"><label htmlFor="course-scope">Show courses</label><select id="course-scope" value={scope} onChange={e => setScope(e.target.value)}><option value="all">All courses</option><option value="enrolled">My courses</option><option value="completed">Completed courses</option></select></div>
        <p role="status">Showing {visibleCourses.length} of {courses.length} courses</p>
        {!visibleCourses.length && <p className="empty-panel">No courses match these filters.</p>}
      </>}
      {visibleCourses.length > 0 && (
        <div className="module-grid">
          {visibleCourses.map((c) => {
            const enrollment = enrollments.get(c.id)
            const isFree = (c.price_cents ?? 0) === 0
            const progress = Math.max(0, Math.min(100, enrollment?.progress_pct ?? 0))
            return (
              <div className="module-card" key={c.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
                <h3 style={{ color: 'var(--ink)' }}>{c.title}</h3>
                <p style={{ color: 'var(--muted)' }}>{c.description ?? c.category}</p><p>{c.category ?? 'General'}{c.level ? ` · ${c.level}` : ''}{c.duration_minutes ? ` · ${c.duration_minutes} minutes` : ''}</p>
                <details><summary>Course overview</summary>{c.audience && <p>Audience: {c.audience}</p>}{c.career_track && <p>Career track: {c.career_track}</p>}{c.prerequisites && <p>Prerequisites: {c.prerequisites}</p>}{Array.isArray(c.learning_outcomes) && <><h4>Learning outcomes</h4><ul>{c.learning_outcomes.filter((item): item is string => typeof item === 'string').map((item, index) => <li key={index}>{item}</li>)}</ul></>}</details>
                {enrollment && <div className="list-row-meta">{enrollment.completed_at ? '100% complete · credential earned' : `${progress}% complete`}</div>}
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
