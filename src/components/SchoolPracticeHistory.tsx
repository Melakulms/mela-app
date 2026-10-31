import { useEffect, useState } from 'react'
import { fetchSchoolPracticeHistory, type SchoolPracticeResult } from '../lib/question-history'

type Program = { program_key: string; subject_title: string }

export default function SchoolPracticeHistory({ programs }: { programs: Program[] }) {
  const [rows, setRows] = useState<SchoolPracticeResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void fetchSchoolPracticeHistory(programs.map(program => program.program_key))
      .then(items => { if (active) setRows(items) })
      .catch(cause => {
        if (active) {
          setRows([])
          setError(cause instanceof Error ? cause.message : 'Could not load your previous scores.')
        }
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [programs, revision])

  return <section className="list-panel question-card" aria-label="My saved school practice results">
    <div className="section-heading">
      <div>
        <h2>My saved practice results</h2>
        <p className="muted">Your last eight submitted curriculum sessions for your enrolled subjects. Results are private to your account.</p>
      </div>
      <button type="button" className="btn btn-secondary" disabled={loading} onClick={() => setRevision(value => value + 1)}>Refresh scores</button>
    </div>
    {loading && <p role="status">Loading saved scores…</p>}
    {error && <div role="alert">{error}<button type="button" className="btn btn-secondary" onClick={() => setRevision(value => value + 1)}>Retry</button></div>}
    {!loading && !error && rows.length === 0 && <p>No saved results yet. Complete and submit a practice session to save your score.</p>}
    {!loading && !error && rows.map(item => {
      const score = Number(item.score_percent)
      const title = programs.find(program => program.program_key === item.program_key)?.subject_title ?? 'Curriculum subject'
      const date = item.submitted_at && Number.isFinite(Date.parse(item.submitted_at))
        ? new Date(item.submitted_at).toLocaleDateString()
        : 'Date unavailable'
      return <div className="list-row" key={item.id}>
        <div>
          <strong>{title}</strong>
          <p className="list-row-meta">{date} · {item.correct_count}/{item.answered_count} correct</p>
        </div>
        <span className="pill">{item.score_percent == null || !Number.isFinite(score) ? 'Pending score' : score + '%'}</span>
      </div>
    })}
  </section>
}
