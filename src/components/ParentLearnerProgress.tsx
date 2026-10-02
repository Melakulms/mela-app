import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Relationship = { learner_id: string; relationship: string; status: string }
type Progress = {
  learner: { id: string; full_name: string; education_stage_key: string | null; grade_level: number | null; institution_name: string | null }
  courses: { enrolled: number; completed: number; average_progress_pct: number }
  practice: { completed_sessions: number; average_score_percent: number; latest_completed_at: string | null }
  badge_count: number
  verified_skill_count: number
}

type Row = { relationship: string; progress: Progress }

export default function ParentLearnerProgress() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void (async () => {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        if (!auth.user) throw new Error('Please sign in again.')
        const { data, error: relationshipError } = await supabase.from('guardian_relationships')
          .select('learner_id,relationship,status')
          .eq('guardian_user_id', auth.user.id)
          .eq('status', 'verified')
        if (relationshipError) throw relationshipError
        const relationships = (data ?? []) as Relationship[]
        const summaries = await Promise.all(relationships.map(async (relationship) => {
          const { data: progress, error } = await supabase.rpc('get_my_guardian_learner_progress', { p_learner_id: relationship.learner_id })
          if (error) throw error
          return { relationship: relationship.relationship, progress: progress as Progress }
        }))
        if (active) setRows(summaries)
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load learner progress. Please retry.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [revision])

  return <section>
    <div className="section-heading"><div><h2>Learner progress</h2><p>Learning-only summary for verified guardian relationships.</p></div><button className="btn btn-secondary" disabled={loading} onClick={() => setRevision((value) => value + 1)}>Refresh progress</button></div>
    {error && <div className="banner banner-error" role="alert">{error}<button className="btn btn-secondary" onClick={() => setRevision((value) => value + 1)}>Retry</button></div>}
    {loading ? <p role="status">Loading learner progress…</p> : !error && rows.length === 0 ? <div className="empty-panel">Connect and verify a learner to see learning progress here.</div> : <div className="list-panel">
      {rows.map(({ relationship, progress }) => <div className="list-row" key={progress.learner.id}>
        <div style={{ width: '100%' }}>
          <div className="list-row-title">{progress.learner.full_name}</div>
          <div className="list-row-meta">{relationship} · {progress.learner.grade_level ? `Grade ${progress.learner.grade_level}` : progress.learner.education_stage_key ?? 'Education stage not set'}{progress.learner.institution_name ? ` · ${progress.learner.institution_name}` : ''}</div>
          <div className="stat-strip" style={{ marginTop: '.75rem' }}>
            <div><span className="stat-value">{progress.courses.completed}/{progress.courses.enrolled}</span><span className="stat-label">Courses</span></div>
            <div><span className="stat-value">{progress.courses.average_progress_pct}%</span><span className="stat-label">Course progress</span></div>
            <div><span className="stat-value">{progress.practice.completed_sessions}</span><span className="stat-label">Practice sessions</span></div>
            <div><span className="stat-value">{progress.practice.average_score_percent}%</span><span className="stat-label">Practice avg.</span></div>
          </div>
          <div className="list-row-meta">{progress.badge_count} badges · {progress.verified_skill_count} verified skills{progress.practice.latest_completed_at ? ` · last practice ${new Date(progress.practice.latest_completed_at).toLocaleDateString()}` : ''}</div>
        </div>
      </div>)}
    </div>}
  </section>
}
