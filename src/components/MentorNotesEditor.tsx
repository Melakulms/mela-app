import { useEffect, useRef, useState } from 'react'
import MentorMfaGate from './MentorMfaGate'
import { getNotesDraft, NOTES_MAX, publishNotes, saveNotesDraft } from '../lib/mentorship-notes'

/** No draft is read until AAL2 is achieved. Publication sends the exact visible text. */
export default function MentorNotesEditor({ sessionId, onPublished, onClose }: {
  sessionId: string
  onPublished?: () => void
  onClose: () => void
}) {
  const [verified, setVerified] = useState(false)
  const [body, setBody] = useState('')
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [confirmPublish, setConfirmPublish] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const lock = useRef(false)

  useEffect(() => {
    let active = true
    setVerified(false); setLoaded(false); setBody(''); setRevision(0); setError('')
    return () => { active = false; void active }
  }, [sessionId])

  useEffect(() => {
    if (!verified) return
    let active = true
    setLoaded(false)
    getNotesDraft(sessionId).then(draft => {
      if (!active) return
      setBody(draft.body ?? ''); setRevision(draft.publishedRevision)
      setLoaded(true)
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load notes.') })
    return () => { active = false }
  }, [sessionId, verified])

  const execute = async (kind: 'save' | 'publish') => {
    if (lock.current || !loaded) return
    lock.current = true
    setBusy(true); setError(''); setStatus('')
    try {
      if (kind === 'save') {
        await saveNotesDraft(sessionId, body)
        setStatus('Draft saved privately.')
      } else {
        const textBeingConfirmed = body.trim()
        const next = await publishNotes(sessionId, textBeingConfirmed, revision)
        setRevision(next); setConfirmPublish(false)
        setStatus('Published. The learner can now view these notes.')
        onPublished?.()
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save notes. Please retry.') }
    finally { lock.current = false; setBusy(false) }
  }

  if (!verified) return <MentorMfaGate purpose="view, save, or publish mentorship notes"
    onReady={() => setVerified(true)} onCancel={onClose} />

  return <div style={{ display: 'grid', gap: '.5rem', maxWidth: '36rem' }}>
    <label htmlFor={`notes-draft-${sessionId}`}>Follow-up notes (private until published)</label>
    <textarea id={`notes-draft-${sessionId}`} rows={4} maxLength={NOTES_MAX} disabled={busy || !loaded}
      value={body} onChange={e => { setBody(e.target.value); setConfirmPublish(false); setStatus('') }} />
    <span className="field-hint">{body.length}/{NOTES_MAX} · Published revision {revision}</span>
    {!loaded && !error && <p role="status">Loading private notes…</p>}
    <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
      <button className="btn btn-secondary" disabled={busy || !loaded}
        onClick={() => void execute('save')}>Save private draft</button>
      {!confirmPublish ? <button className="btn btn-primary" disabled={busy || !loaded || !body.trim()}
        onClick={() => setConfirmPublish(true)}>Publish notes…</button>
        : <div role="group" aria-label="Confirm notes publication" className="empty-panel">
          <p>Publish the exact text above to the learner? A notification may be sent.</p>
          <button className="btn btn-primary" disabled={busy} onClick={() => void execute('publish')}>
            {busy ? 'Publishing…' : 'Confirm publish'}
          </button>
          <button className="btn btn-secondary" disabled={busy} onClick={() => setConfirmPublish(false)}>Keep editing</button>
        </div>}
      <button className="btn btn-secondary" disabled={busy} onClick={onClose}>Close notes</button>
    </div>
    {status && <p className="banner banner-info" role="status">{status}</p>}
    {error && <p className="banner banner-error" role="alert">{error}</p>}
  </div>
}
