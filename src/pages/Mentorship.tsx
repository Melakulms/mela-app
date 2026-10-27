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
import { discoverMentors, MENTORSHIP_CATEGORIES, WEEKDAYS, mentorshipTime } from '../lib/mentor-discovery'

export default function Mentorship({ onBack, stageKey, onOpenSafety, mode = 'all', initialCategory = '', initialGoal = '', preferredLanguage = '', onBusyChange }: { onBack: () => void; stageKey?: string | null; onOpenSafety?: () => void; mode?: 'all' | 'directory' | 'requests' | 'sessions'; initialCategory?: string; initialGoal?: string; preferredLanguage?: string; onBusyChange?: (busy: boolean) => void }) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(initialCategory)
  const [language, setLanguage] = useState('')
  const [availableOnly, setAvailableOnly] = useState(false)
  const [matchGoal, setMatchGoal] = useState(initialGoal)
  const showDirectory = mode === 'all' || mode === 'directory'
  const showRequests = mode === 'all' || mode === 'requests'
  const showSessions = mode === 'all' || mode === 'sessions'
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
  const matches = discoverMentors(mentors ?? [], { query, category, language, availableOnly, goal: matchGoal, preferredLanguage })
  const languages = [...new Set((mentors ?? []).flatMap(m => m.languages ?? []))].sort()
  useEffect(() => { onBusyChange?.(!!busy); return () => onBusyChange?.(false) }, [busy, onBusyChange])

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
      <section className="empty-panel" style={{ textAlign: 'left', borderTop: '4px solid #16875f' }}>
        <h2>Build your next step with a mentor</h2>
        <p>Choose a verified mentor, explain your goal, and track your request and session here.</p>
        <p>Session times use your device time zone: <strong>{localZone}</strong>.</p>
        {blockedStage ? <p role="status">Direct mentorship is not enabled for Grades 1–10. Continue with your teacher and guardian through MELA learning resources.</p>
          : stageKey === 'school_11_12' ? <p>Grades 11–12 need verified guardian consent or adult eligibility before requesting mentorship.</p> : null}
        {onOpenSafety && <button className="btn btn-secondary" disabled={!!busy} onClick={onOpenSafety}>Safety, guardian consent & reporting</button>}
      </section>
      <details className="empty-panel" style={{ textAlign: 'left' }}>
        <summary>Prepare for a useful session</summary>
        <ol><li>Choose one goal: career exploration, study planning, CV feedback, scholarships or interview practice.</li><li>Write two or three questions and explain what you have already tried.</li><li>After the session, review your mentor’s follow-up notes and agree on one next step.</li></ol>
        <p>Keep passwords, payment details and identity documents private. Report uncomfortable behaviour through Safety & Privacy. A scheduled session does not yet include an in-app video call.</p>
      </details>
      {notice && <p className="banner banner-info" role="status">{notice}</p>}
      {error && <div className="banner banner-error" role="alert">{error}</div>}
      {loading && <p className="muted" role="status">Loading mentorship…</p>}
      {!loading && error && <button className="btn btn-secondary" disabled={!!busy} onClick={() => setRevision((value) => value + 1)}>Retry mentorship</button>}

      {showSessions && !loading && !error && sessions.length === 0 && <p className="empty-panel">No sessions yet. Once a mentor accepts your request, your scheduled session will appear here.</p>}
      {showSessions && !loading && sessions.length > 0 && <>
        <div className="section-heading"><h2>Your sessions</h2></div>
        <div className="list-panel">
          {sessions.map((session) => {
            const ratingId = `session-rating-${session.id}`
            const commentId = `session-rating-comment-${session.id}`
            return <div className="list-row" key={session.id}>
              <div style={{ flex: 1 }}>
                <strong>{requestTopics.get(session.request_id ?? '') ?? 'Mentorship session'} · {mentorNames.get(session.mentor_id ?? '') ?? 'Your mentor'}</strong>
                <div className="list-row-title">{mentorshipTime(session.scheduled_at)}</div>
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

      {showRequests && !loading && requests.length > 0 && <>
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

      {showRequests && !loading && !error && !requests.length && <p className="empty-panel">No mentorship requests yet. Find a verified mentor to explain your goal.</p>}
      {showDirectory && !loading && <div className="section-heading"><h2>Verified mentors</h2></div>}
      {showDirectory && !loading && mentors && mentors.length === 0 && <div className="empty-panel">No verified mentors are available yet.</div>}
      {showDirectory && !loading && mentors && mentors.length > 0 && <div className="field"><label htmlFor="mentor-search">Find a mentor</label><input id="mentor-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search names, experience or topics" /></div>}
      {showDirectory && !loading && <div className="mentorship-panel">
        <div className="mentorship-columns">
          <div className="field"><label htmlFor="mentor-category">Guidance category</label><select id="mentor-category" value={category} disabled={!!busy} onChange={e => setCategory(e.target.value)}><option value="">All categories</option>{MENTORSHIP_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></div>
          <div className="field"><label htmlFor="mentor-language">Mentor language</label><select id="mentor-language" value={language} disabled={!!busy} onChange={e => setLanguage(e.target.value)}><option value="">Any language</option>{languages.map(l => <option key={l}>{l}</option>)}</select></div>
        </div>
        <div className="field"><label htmlFor="mentor-match-goal">Match to my goal</label><input id="mentor-match-goal" value={matchGoal} maxLength={300} disabled={!!busy} onChange={e => setMatchGoal(e.target.value)} placeholder="e.g. Engineering scholarship preparation" /></div>
        <label><input type="checkbox" checked={availableOnly} disabled={!!busy} onChange={e => setAvailableOnly(e.target.checked)} /> Only mentors with published weekly times</label>
        <p className="field-hint">Suggestions use goal keywords and your preferred language. They do not certify suitability or change your eligibility. Read the profile before requesting.</p>
        <p role="status">{matches.length} matching {matches.length === 1 ? 'mentor' : 'mentors'}</p>
        {!matches.length && !!mentors?.length && <p>No mentors match your search. Try another category or language.</p>}
      </div>}
      {showDirectory && !loading && mentors && mentors.length > 0 && <div className="module-grid">
        {matches.map(({ mentor: m, reasons }) => {
          const topicId = `mentor-topic-${m.user_id}`
          const messageId = `mentor-message-${m.user_id}`
          return <div className="module-card" key={m.user_id} style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
            <h3 style={{ color: 'var(--ink)' }}>{m.full_name}</h3>
            <p style={{ color: 'var(--muted)' }}>{m.headline ?? m.organization ?? 'MELA mentor'}</p>
            <span className="pill">Verified mentor</span>
            {reasons.length > 0 && <p className="field-hint">Suggested because: {reasons.join(' · ')}</p>}
            {m.bio && <p>{m.bio}</p>}
            <details><summary>Profile, expertise & availability</summary>
              <p>Listed expertise: {m.expertise?.join(', ') || 'Not listed'}</p>
              <p>Languages: {m.languages?.join(', ') || 'Not listed'}</p>
              {m.availability?.length ? <ul>{m.availability.map(slot => <li key={slot.id}>{WEEKDAYS[slot.weekday]} · {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)} · {slot.timezone}</li>)}</ul> : <p>No weekly times published. Propose a time in your request.</p>}
              <p className="field-hint">Weekly times are preferences, not a confirmed booking. All times use a 24-hour clock.</p>
            </details>
            {m.organization && <p>{m.organization}</p>}
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

