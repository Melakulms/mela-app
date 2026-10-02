import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function EducatorObservationForm({ classroomId, learnerId, learnerName, onSaved }: {
  classroomId: string
  learnerId: string
  learnerName: string
  onSaved: () => void
}) {
  const [score, setScore] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const lock = useRef(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (lock.current) return
    const cleanNotes = notes.trim()
    const numericScore = score === '' ? null : Number(score)
    if (!cleanNotes) { setError('Observation notes are required.'); return }
    if (numericScore !== null && (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > 100)) {
      setError('Score must be between 0 and 100.'); return
    }
    lock.current = true
    setBusy(true); setError(''); setSaved(false)
    try {
      const { error: rpcError } = await supabase.rpc('record_educator_observation', {
        p_classroom_id: classroomId,
        p_learner_id: learnerId,
        p_competency_id: null,
        p_score: numericScore,
        p_notes: cleanNotes,
        p_observation_type: 'mastery_observation',
      })
      if (rpcError) throw rpcError
      setScore(''); setNotes(''); setSaved(true); onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the observation. Please retry.')
    } finally {
      lock.current = false; setBusy(false)
    }
  }

  return <form onSubmit={submit} style={{ width: '100%', marginTop: '.75rem' }}>
    <h4>Record observation for {learnerName}</h4>
    {error && <div className="banner banner-error" role="alert">{error}</div>}
    {saved && <div className="banner banner-info" role="status">Observation saved.</div>}
    <div className="field"><label htmlFor={`observation-score-${learnerId}`}>Score (optional)</label><input id={`observation-score-${learnerId}`} type="number" min="0" max="100" step="1" value={score} disabled={busy} onChange={(event) => setScore(event.target.value)} /></div>
    <div className="field"><label htmlFor={`observation-notes-${learnerId}`}>Observation notes</label><textarea id={`observation-notes-${learnerId}`} required maxLength={2000} rows={3} value={notes} disabled={busy} onChange={(event) => setNotes(event.target.value)} /></div>
    <button className="btn btn-primary" disabled={busy || !notes.trim()}>{busy ? 'Saving…' : 'Save observation'}</button>
  </form>
}
