import { useEffect, useState } from 'react'
import { fetchMaterials, type StudyMaterial } from '../lib/materials'

export default function StudyMaterials({ onBack }: { onBack: () => void }) {
  const [materials, setMaterials] = useState<StudyMaterial[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchMaterials().then(setMaterials).catch((e) => setError(e.message ?? 'Could not load study materials.'))
  }, [])

  const bySubject = (materials ?? []).reduce<Record<string, StudyMaterial[]>>((acc, m) => {
    (acc[m.subject] ??= []).push(m)
    return acc
  }, {})

  return (
    <div className="dash-main">
      <div className="section-heading">
        <h1>Study Materials</h1>
        <button className="btn btn-secondary" onClick={onBack}>Back</button>
      </div>
      {error && <div className="banner banner-error">{error}</div>}
      {!materials && !error && <p className="muted">Loading…</p>}
      {materials && materials.length === 0 && <div className="empty-panel">No study materials published yet.</div>}
      {Object.entries(bySubject).map(([subject, items]) => (
        <div key={subject}>
          <div className="section-heading"><h2>{subject}</h2></div>
          <div className="list-panel">
            {items.map((m) => (
              <div className="list-row" key={m.id}>
                <div className="list-row-title">{m.title}</div>
                <a className="btn btn-secondary" href={m.file_url} target="_blank" rel="noreferrer">Open</a>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
