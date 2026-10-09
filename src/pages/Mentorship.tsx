import { useEffect, useRef, useState } from 'react'
import {
  cancelMentorshipRequest,
  cancelMentorshipSession,
  fetchMyMentorshipRequests,
  fetchMyMentorshipSessions,
  fetchVerifiedMentors,
  rateMentorshipSession,
  requestMentor,
  type Mentor,
  type MentorshipSession,
  type MyMentorshipRequest,
} from '../lib/mentorship'
import { useI18n } from '../i18n'

export default function Mentorship({ onBack }: { onBack: () => void }) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [mentors, setMentors] = useState<Mentor[] | null>(null)
  const [requests, setRequests] = useState<MyMentorshipRequest[]>([])
  const [sessions, setSessions] = useState<MentorshipSession[]>([])
  const [error, setError] = useState('')
  const [openMentor, setOpenMentor] = useState<string | null>(null)
  const [topic, setTopic] = useState('')
  const [message, setMessage] = useState('')
  const [ratingDraft, setRatingDraft] = useState<Record<string, number>>({})
  const [ratingComment, setRatingComment] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const actionLock = useRef(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    Promise.all([fetchVerifiedMentors(), fetchMyMentorshipRequests(), fetchMyMentorshipSessions()])
      .then(([m, r, s]) => {
        if (!active) return
        setMentors(m)
        setRequests(r)
        setSessions(s)
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load mentorship. Please retry.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [revision])

  const alreadyRequested = (mentorId: string) => requests.some((r) => r.mentor_id === mentorId && !['declined', 'cancelled'].includes(r.status))

  const runAction = async (key: string, action: () => Promise<void>) => {
    if (actionLock.current) return
    actionLock.current = true
    setBusy(key)
    setError('')
    try {
      await action()
      setRevision((value) => value + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save that mentorship change. Please retry.')
    } finally {
      actionLock.current = false
      setBusy(null)
    }
  }

  const submitRequest = async (mentorId: string) => {
    const cleanTopic = topic.trim()
    const cleanMessage = message.trim()
    if (cleanTopic.length < 2) { setError('Add a short topic before sending the request.'); return }
    if (cleanTopic.length > 120) { setError('Keep the mentorship topic to 120 characters or fewer.'); return }
    if (cleanMessage.length > 1000) { setError('Keep the message to 1000 characters or fewer.'); return }
    await runAction(`request-${mentorId}`, async () => {
      await requestMentor(mentorId, cleanTopic, cleanMessage)
      setOpenMentor(null)
      setTopic('')
      setMessage('')
    })
  }

  const submitRating = async (sessionId: string) => {
    const rating = ratingDraft[sessionId] ?? 5
    const comment = ratingComment[sessionId] ?? ''
    if (comment.length > 2000) { setError('Keep the rating comment to 2000 characters or fewer.'); return }
    await runAction(`rating-${sessionId}`, async () => {
      await rateMentorshipSession(sessionId, rating, comment)
      setRatingDraft((current) => { const next = { ...current }; delete next[sessionId]; return next })
      setRatingComment((current) => { const next = { ...current }; delete next[sessionId]; return next })
    })
  }

  const closeComposer = () => {
    if (busy) return
    setOpenMentor(null)
    setTopic('')
    setMessage('')
    setError('')
  }

  return (
    <div className="dash-main">
      <div className="section-heading">
        <h1>{t('mentorship')}</h1>
        <button className="btn btn-secondary" onClick={onBack} disabled={!!busy}>{t('back')}</button>
      </div>
      {error && <div className="banner banner-error" role="alert">{error}</div>}
      {loading && <p className="muted" role="status">Loading mentorship…</p>}
      {!loading && error && <button className="btn btn-secondary" disabled={!!busy} onClick={() => setRevision((value) => value + 1)}>Retry mentorship</button>}

      {!loading && sessions.length > 0 && <>
        <div className="section-heading"><h2>Your sessions</h2></div>
        <div className="list-panel">
          {sessions.map((session) => {
            const ratingId = `session-rating-${session.id}`
            const commentId = `session-rating-comment-${session.id}`
            return <div className="list-row" key={session.id}>
              <div style={{ flex: 1 }}>
                <div className="list-row-title">{new Date(session.scheduled_at).toLocaleString()}</div>
                <div className="list-row-meta">{session.duration_min ?? 30} minutes · {session.status}</div>
                {session.status === 'completed' && session.rating !== null && <div className="list-row-meta">Rated {session.rating}/5{session.rating_comment ? ` · ${session.rating_comment}` : ''}</div>}
                {session.status === 'completed' && session.rating === null && <div style={{ marginTop: '.75rem', display: 'grid', gap: '.5rem', maxWidth: '32rem' }}>
                  <label htmlFor={ratingId}>Rate this completed session</label>
                  <select
                    id={ratingId}
                    value={ratingDraft[session.id] ?? 5}
                    disabled={!!busy}
                    onChange={(event) => setRatingDraft((current) => ({ ...current, [session.id]: Number(event.target.value) }))}
                  >
                    <option value={5}>5 — Excellent</option>
                    <option value={4}>4 — Very good</option>
                    <option value={3}>3 — Good</option>
                    <option value={2}>2 — Needs improvement</option>
                    <option value={1}>1 — Poor</option>
                  </select>
                  <label htmlFor={commentId}>Rating comment (optional)</label>
                  <textarea
                    id={commentId}
                    rows={3}
                    maxLength={2000}
                    value={ratingComment[session.id] ?? ''}
                    disabled={!!busy}
                    onChange={(event) => setRatingComment((current) => ({ ...current, [session.id]: event.target.value }))}
                  />
                  <span className="field-hint">{(ratingComment[session.id] ?? '').length}/2000</span>
                  <button className="btn btn-primary" disabled={!!busy} onClick={() => submitRating(session.id)}>
                    {busy === `rating-${session.id}` ? 'Submitting rating…' : 'Submit rating'}
                  </button>
                </div>}
              </div>
              {session.status === 'scheduled'
                ? <button className="btn btn-secondary" disabled={!!busy} onClick={() => runAction(`session-${session.id}`, () => cancelMentorshipSession(session.id, 'Cancelled by learner'))}>{busy === `session-${session.id}` ? 'Cancelling…' : 'Cancel session'}</button>
                : <span className="pill">{session.status}</span>}
            </div>
          })}
        </div>
      </>}

      {!loading && requests.length > 0 && <>
        <div className="section-heading"><h2>Your requests</h2></div>
        <div className="list-panel">
          {requests.map((r) => <div className="list-row" key={r.id}>
            <div>
              <div className="list-row-title">{r.topic ?? 'Mentorship request'}</div>
              <div className="list-row-meta">Requested {new Date(r.created_at).toLocaleDateString()}</div>
            </div>
            {r.status === 'pending'
              ? <button className="btn btn-secondary" disabled={!!busy} onClick={() => runAction(`request-${r.id}`, () => cancelMentorshipRequest(r.id))}>{busy === `request-${r.id}` ? 'Cancelling…' : 'Cancel request'}</button>
              : <span className="pill">{r.status}</span>}
          </div>)}
        </div>
      </>}

      {!loading && <div className="section-heading"><h2>Verified mentors</h2></div>}
      {!loading && mentors && mentors.length === 0 && <div className="empty-panel">No verified mentors are available yet.</div>}
      {!loading && mentors && mentors.length > 0 && <div className="field"><label htmlFor="mentor-search">Find a mentor</label><input id="mentor-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search names, experience or topics" /></div>}
      {!loading && mentors && mentors.length > 0 && !mentors.some(m => `${m.full_name} ${m.headline ?? ''} ${m.bio ?? ''} ${m.organization ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) && <p className="empty-panel">No mentors match your search.</p>}
      {!loading && mentors && mentors.length > 0 && <div className="module-grid">
        {mentors.filter(m => `${m.full_name} ${m.headline ?? ''} ${m.bio ?? ''} ${m.organization ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).map((m) => {
          const topicId = `mentor-topic-${m.user_id}`
          const messageId = `mentor-message-${m.user_id}`
          return <div className="module-card" key={m.user_id} style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
            <h3 style={{ color: 'var(--ink)' }}>{m.full_name}</h3>
            <p style={{ color: 'var(--muted)' }}>{m.headline ?? m.organization ?? 'MELA mentor'}</p>
            {m.bio && <p>{m.bio}</p>}
            {m.organization && <p>{m.organization}</p>}
            {m.years_experience != null && <p>{m.years_experience} years of experience</p>
            }
            {m.rating_count > 0 && <p className="muted">{m.rating_average.toFixed(2)}/5 · {m.rating_count} {m.rating_count === 1 ? 'rating' : 'ratings'}</p>}
            {alreadyRequested(m.user_id) ? <span className="pill">Requested</span> : openMentor === m.user_id ? <div>
              <div className="field">
                <label htmlFor={topicId}>Topic</label>
                <input id={topicId} value={topic} maxLength={120} disabled={!!busy} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. CV review" />
                <span className="field-hint">{topic.length}/120</span>
              </div>
              <div className="field">
                <label htmlFor={messageId}>Message (optional)</label>
                <textarea id={messageId} value={message} maxLength={1000} rows={4} disabled={!!busy} onChange={(e) => setMessage(e.target.value)} />
                <span className="field-hint">{message.length}/1000</span>
              </div>
              <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => submitRequest(m.user_id)} disabled={!!busy || topic.trim().length < 2}>{busy === `request-${m.user_id}` ? 'Sending…' : 'Send request'}</button>
                <button className="btn btn-secondary" onClick={closeComposer} disabled={!!busy}>Cancel</button>
              </div>
            </div> : <button className="btn btn-secondary" disabled={!!busy} onClick={() => { setOpenMentor(m.user_id); setTopic(''); setMessage(''); setError('') }}>Request mentorship</button>}
          </div>
        })}
      </div>}
    </div>
  )
}
