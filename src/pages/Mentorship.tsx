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
import MentorshipHome from '../components/MentorshipHome'
import MentorshipLearningWorkspace from '../components/MentorshipLearningWorkspace'
import { discoverMentors, getMentorLanguages, MENTORSHIP_CATEGORIES, mentorMatchesCategory, WEEKDAYS, type MentorshipCategory } from '../lib/mentor-discovery'

export default function Mentorship({ onBack, stageKey, onOpenSafety }: { onBack: () => void; stageKey?: string | null; onOpenSafety?: () => void }) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<MentorshipCategory>('all')
  const [language, setLanguage] = useState('')
  const [mentors, setMentors] = useState<Mentor[] | null>(null)
  const [requests, setRequests] = useState<MyMentorshipRequest[]>([])
  const [sessions, setSessions] = useState<MentorshipSession[]>([])
  const [error, setError] = useState('')
  const [openMentor, setOpenMentor] = useState<string | null>(null)
  const [topic, setTopic] = useState('')
  const [message, setMessage] = useState('')
  const [preferredAt, setPreferredAt] = useState('')
  const [notice, setNotice] = useState('')
  const blockedStage = ['school_1_6', 'school_7_8', 'school_9_10'].includes(stageKey ?? '')
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

  const alreadyRequested = (mentorId: string) => requests.some((r) => r.mentor_id === mentorId &&
    (r.status === 'pending' || (r.status === 'accepted' && !sessions.some(s => s.request_id === r.id && s.status === 'completed'))))
  const mentorNames = new Map((mentors ?? []).map(m => [m.user_id, m.full_name ?? 'MELA mentor']))
  const requestTopics = new Map(requests.map(r => [r.id, r.topic]))
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const visibleMentors = discoverMentors(mentors ?? [], { query, category, language })
  const languages = getMentorLanguages(mentors ?? [])
  const pendingCount = requests.filter((request) => request.status === 'pending').length
  const upcomingCount = sessions.filter((session) => session.status === 'scheduled' && new Date(session.scheduled_at).getTime() > Date.now()).length
  const completedCount = sessions.filter((session) => session.status === 'completed').length

  const runAction = async (key: string, action: () => Promise<void>) => {
    if (actionLock.current) return
    actionLock.current = true
    setBusy(key)
    setError('')
    setNotice('')
    try {
      await action()
      setNotice('Your mentorship change was saved.')
      setRevision((value) => value + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save that mentorship change. Please retry.')
    } finally {
      actionLock.current = false
      setBusy(null)
    }
  }

  const submitRequest = async (mentorId: string) => {
    if (blockedStage) return
    const cleanTopic = topic.trim()
    const cleanMessage = message.trim()
    if (cleanTopic.length < 2) { setError('Add a short topic before sending the request.'); return }
    if (cleanTopic.length > 120) { setError('Keep the mentorship topic to 120 characters or fewer.'); return }
    if (cleanMessage.length > 1000) { setError('Keep the message to 1000 characters or fewer.'); return }
    await runAction(`request-${mentorId}`, async () => {
      if (preferredAt) await requestMentor(mentorId, cleanTopic, cleanMessage, preferredAt)
      else await requestMentor(mentorId, cleanTopic, cleanMessage)
      setOpenMentor(null)
      setTopic('')
      setMessage('')
      setPreferredAt('')
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
    setPreferredAt('')
    setError('')
  }

  return (
    <div className="dash-main">
      <div className="section-heading">
        <h1>{t('mentorship')}</h1>
        <button className="btn btn-secondary" onClick={onBack} disabled={!!busy}>{t('back')}</button>
      </div>
      {!loading && !error && mentors && <MentorshipHome
        mentors={mentors}
        requests={requests}
        sessions={sessions}
        stageKey={stageKey}
        revision={revision}
      />}
      {blockedStage && <p role="status" className="banner banner-info">Direct mentorship is not enabled for Grades 1–10. Continue with your teacher and guardian through MELA learning resources.</p>}
      {stageKey === 'school_11_12' && <p className="banner banner-info">Grades 11–12 need verified guardian consent or adult eligibility before requesting mentorship.</p>}
      {onOpenSafety && <button className="btn btn-secondary" disabled={!!busy} onClick={onOpenSafety}>Safety, guardian consent & reporting</button>}
      <p className="muted">Session times use your device time zone: {localZone}.</p>
      <details id="mentorship-resources" className="empty-panel" style={{ textAlign: 'left' }}>
        <summary>Prepare for a useful session</summary>
        <ol><li>Choose one goal: career exploration, study planning, CV feedback, scholarships or interview practice.</li><li>Write two or three questions and explain what you have already tried.</li><li>After the session, review your mentor’s follow-up notes and agree on one next step.</li></ol>
        <p>Keep passwords, payment details and identity documents private. Report uncomfortable behaviour through Safety & Privacy. A scheduled session does not yet include an in-app video call.</p>
      </details>
      {notice && <p className="banner banner-info" role="status">{notice}</p>}
      {error && <div className="banner banner-error" role="alert">{error}</div>}
      {loading && <p className="muted" role="status">Loading mentorship…</p>}
      {!loading && error && <button className="btn btn-secondary" disabled={!!busy} onClick={() => setRevision((value) => value + 1)}>Retry mentorship</button>}

      {!loading && !error && <MentorshipLearningWorkspace mode="learner" />}
      <div id="mentorship-journey" className="section-heading"><h2>My mentorship journey</h2></div>
      {!loading && !error && sessions.length === 0 && <p className="empty-panel">No sessions yet. Once a mentor accepts your request, your scheduled session will appear here.</p>}
      {!loading && sessions.length > 0 && <>
        <div className="section-heading"><h2>Your sessions</h2></div>
        <div className="list-panel">
          {sessions.map((session) => {
            const ratingId = `session-rating-${session.id}`
            const commentId = `session-rating-comment-${session.id}`
            return <div className="list-row" key={session.id}>
              <div style={{ flex: 1 }}>
                <strong>{requestTopics.get(session.request_id ?? '') ?? 'Mentorship session'} · {mentorNames.get(session.mentor_id ?? '') ?? 'Your mentor'}</strong>
                <div className="list-row-title">{new Date(session.scheduled_at).toLocaleString()}</div>
                <div className="list-row-meta">{session.duration_min ?? 30} minutes · {session.status}</div>
                {session.notes && <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}><strong>Follow-up notes: </strong>{session.notes}</p>}
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
              <div>{mentorNames.get(r.mentor_id) ?? 'Your mentor'} · {r.status}</div>
              {r.message && <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.message}</p>}
              {r.preferred_at && <p>Preferred time: {new Date(r.preferred_at).toLocaleString()}</p>}
              {r.status === 'accepted' && !sessions.some(s => s.request_id === r.id) && <p>Your mentor has accepted. A session time is still to be scheduled.</p>}
              {r.status === 'accepted' && sessions.some(s => s.request_id === r.id && s.status === 'cancelled') && <p>The session was cancelled. Your mentor can schedule a replacement.</p>}
              <div className="list-row-meta">Requested {new Date(r.created_at).toLocaleDateString()}</div>
            </div>
            {r.status === 'pending'
              ? <button className="btn btn-secondary" disabled={!!busy} onClick={() => runAction(`request-${r.id}`, () => cancelMentorshipRequest(r.id))}>{busy === `request-${r.id}` ? 'Cancelling…' : 'Cancel request'}</button>
              : <span className="pill">{r.status}</span>}
          </div>)}
        </div>
      </>}

      {!loading && <div id="mentor-directory" className="section-heading"><h2>Find a verified mentor</h2></div>}
      {!loading && mentors && <section className="empty-panel" style={{ textAlign: 'left' }}>
        <p>Browse guidance areas or search real, approved mentor profiles. Category suggestions are based on profile descriptions, not a separate certification.</p>
        <div className="field">
          <label htmlFor="mentor-search">Search by name, field, skills, or interests</label>
          <input id="mentor-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. engineering, interview, scholarship" />
        </div>
        <div className="field">
          <label htmlFor="mentor-category">Mentorship category</label>
          <select id="mentor-category" value={category} onChange={(event) => setCategory(event.target.value as MentorshipCategory)}>
            <option value="all">All guidance areas ({mentors.length})</option>
            {MENTORSHIP_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label} ({mentors.filter((mentor) => mentorMatchesCategory(mentor, item.id)).length})</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="mentor-language">Mentoring language</label>
          <select id="mentor-language" value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option value="">Any listed language</option>
            {languages.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>
        <p role="status">{visibleMentors.length} verified {visibleMentors.length === 1 ? 'mentor' : 'mentors'} match your filters.</p>
        {(query || language || category !== 'all') && <button className="btn btn-secondary" type="button" onClick={() => { setQuery(''); setCategory('all'); setLanguage('') }}>Clear filters</button>}
      </section>}
      {!loading && mentors && mentors.length === 0 && <div className="empty-panel">No verified mentors have been onboarded yet. Your mentorship requests and sessions will appear here when an approved mentor becomes available.</div>}
      {!loading && mentors && mentors.length > 0 && visibleMentors.length === 0 && <p className="empty-panel">No approved mentor currently matches those filters. Try a different guidance area or language.</p>}
      {!loading && mentors && visibleMentors.length > 0 && <div className="module-grid">
        {visibleMentors.map((m) => {
          const topicId = `mentor-topic-${m.user_id}`
          const messageId = `mentor-message-${m.user_id}`
          return <div className="module-card" key={m.user_id} style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
            <h3 style={{ color: 'var(--ink)' }}>{m.full_name}</h3>
            <p style={{ color: 'var(--muted)' }}>{m.headline ?? m.organization ?? 'MELA mentor'}</p>
            {m.bio && <p>{m.bio}</p>}
            {m.organization && <p>{m.organization}</p>}
            {(m.expertise ?? []).length > 0 && <p><strong>Mentoring fields:</strong> {(m.expertise ?? []).join(', ')}</p>}
            {(m.languages ?? []).length > 0 && <p><strong>Languages:</strong> {(m.languages ?? []).join(', ')}</p>}
            {(m.availability ?? []).length > 0
              ? <details><summary>Published weekly hours ({(m.availability ?? []).length})</summary>
                  <ul>{(m.availability ?? []).map((slot) => <li key={slot.id}>{WEEKDAYS[slot.weekday] ?? 'Day'} · {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)} ({slot.timezone})</li>)}</ul>
                  <p className="muted">Weekly availability is indicative. A mentor must confirm the session.</p>
                </details>
              : <p className="muted">No weekly availability published. You can still submit a request.</p>}
            {m.years_experience != null && <p>{m.years_experience} years of experience</p>
            }
            {m.rating_count > 0 && <p className="muted">{m.rating_average.toFixed(2)}/5 · {m.rating_count} {m.rating_count === 1 ? 'rating' : 'ratings'}</p>}
            {blockedStage ? <span className="pill">Direct mentorship unavailable for your grade</span> : alreadyRequested(m.user_id) ? <span className="pill">Requested</span> : openMentor === m.user_id ? <div>
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
                <div className="field" style={{ width: '100%' }}><label htmlFor={`mentor-preferred-${m.user_id}`}>Preferred session time (optional)</label><input id={`mentor-preferred-${m.user_id}`} type="datetime-local" value={preferredAt} disabled={!!busy} onChange={e => setPreferredAt(e.target.value)} /><span className="field-hint">Time zone: {localZone}. If accepted with this time, a 30-minute session is scheduled.</span></div>
                <button className="btn btn-primary" onClick={() => submitRequest(m.user_id)} disabled={!!busy || topic.trim().length < 2}>{busy === `request-${m.user_id}` ? 'Sending…' : 'Send request'}</button>
                <button className="btn btn-secondary" onClick={closeComposer} disabled={!!busy}>Cancel</button>
              </div>
            </div> : <button className="btn btn-secondary" disabled={!!busy || loading} onClick={() => { setOpenMentor(m.user_id); setTopic(''); setMessage(''); setPreferredAt(''); setError('') }}>Request mentorship</button>}
          </div>
        })}
      </div>}
    </div>
  )
}

