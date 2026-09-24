import { useEffect, useState } from 'react'
import { fetchLearningLibrary, type LearningProgram } from '../lib/materials'

export default function StudyMaterials({ stageKey, gradeLevel, onBack }: { stageKey: string | null; gradeLevel: number | null; onBack: () => void }) {
  const [programs, setPrograms] = useState<LearningProgram[] | null>(null)
  const [error, setError] = useState('')
  const [openProgram, setOpenProgram] = useState<string | null>(null)

  useEffect(() => {
    if (!stageKey) {
      setError("We don't know your education stage yet, so we can't load the right materials for you.")
      return
    }
    fetchLearningLibrary(stageKey, gradeLevel)
      .then((lib) => setPrograms(lib.programs))
      .catch((e) => setError(e.message ?? 'Could not load study materials.'))
  }, [stageKey, gradeLevel])

  return (
    <div className="dash-main">
      <div className="section-heading">
        <h1>Study Materials</h1>
        <button className="btn btn-secondary" onClick={onBack}>Back</button>
      </div>
      {error && <div className="banner banner-error">{error}</div>}
      {!programs && !error && <p className="muted">Loading…</p>}
      {programs && programs.length === 0 && <div className="empty-panel">No materials published for your stage yet.</div>}

      {programs?.map((p) => (
        <div key={p.program_key} className="list-panel">
          <button
            className="list-row"
            style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer' }}
            onClick={() => setOpenProgram(openProgram === p.program_key ? null : p.program_key)}
          >
            <div>
              <div className="list-row-title">{p.title}</div>
              <div className="list-row-meta">{p.subject_title}</div>
            </div>
            <span className="pill">{p.units.length} units</span>
          </button>

          {openProgram === p.program_key && p.units.map((u) => (
            <div key={u.id} style={{ borderTop: '1px solid var(--line)', padding: '0.8rem 1.1rem' }}>
              <div className="list-row-title" style={{ marginBottom: '0.5rem' }}>Unit {u.unit_number}: {u.title}</div>
              {u.materials.length === 0 ? (
                <p className="muted" style={{ fontSize: '0.85rem' }}>No materials in this unit yet.</p>
              ) : (
                u.materials.map((m) => (
                  <div key={m.material_key} className="list-row" style={{ padding: '0.6rem 0' }}>
                    <div className="list-row-title" style={{ fontSize: '0.9rem' }}>{m.title}</div>
                    {m.can_access ? (
                      <span className="pill" style={{ background: 'var(--surface-2)', color: 'var(--success)' }}>Available</span>
                    ) : (
                      <span className="pill">{m.access_tier === 'subscription' ? 'Needs subscription' : 'Needs purchase'}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
