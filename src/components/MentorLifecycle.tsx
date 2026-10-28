import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { sessionEndTime } from '../lib/mentorship-calendar'
import MentorshipCalendarButton from './MentorshipCalendarButton'
import MentorAvailabilityManager from './MentorAvailabilityManager'
import { cancelMentorshipSession, completeMentorshipSession, DECLINE_NOTE_MAX, respondToMentorshipRequest, scheduleMentorshipSession, type DeclineReasonCode, type MentorshipSession } from '../lib/mentorship'
import { DECLINE_REASON_OPTIONS } from '../lib/mentorship-status-copy'
import { useI18n } from '../i18n'

type RequestRow = { id: string; mentee_id: string; topic: string | null; message: string | null; preferred_at: string | null; status: string; created_at: string }

export default function MentorLifecycle({ onChanged }: { onChanged: () => void }) {
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [sessions, setSessions] = useState<MentorshipSession[]>([])
  const { language } = useI18n()
  const declineText = language === 'am'
  const [declineFor, setDeclineFor] = useState<string | null>(null)
  const [declineCode, setDeclineCode] = useState<DeclineReasonCode | ''>('')
  const [declineNote, setDeclineNote] = useState('')
  const [scheduleFor, setScheduleFor] = useState<string | null>(null)
  const [scheduledAt, setScheduledAt] = useState('')
  const [duration, setDuration] = useState(30)
  const [completionNotes, setCompletionNotes] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [loadFailed, setLoadFailed] = useState(false)
  const [requestsError, setRequestsError] = useState('')
  const [sessionsError, setSessionsError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const lock = useRef(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadFailed(false)
    setRequestsError('')
    setSessionsError('')
    // Never retain private records from a previous session during refresh.
    setRequests([])
    setSessions([])
    setError('')
    void (async () => {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        if (!auth.user) throw new Error('Please sign in again.')
        const [requestResult, sessionResult] = await Promise.allSettled([
          supabase.from('mentorship_requests').select('id,mentee_id,topic,message,preferred_at,status,created_at').eq('mentor_id', auth.user.id).order('created_at', { ascending: false }),
          supabase.from('mentorship_sessions').select('id,request_id,mentor_id,mentee_id,scheduled_at,duration_min,status,call_room_id,completed_at,cancelled_at,notes').eq('mentor_id', auth.user.id).order('scheduled_at', { ascending: false }),
        ])
        if (!active) return
        if (requestResult.status === 'fulfilled' && !requestResult.value.error) {
          setRequests((requestResult.value.data ?? []) as RequestRow[])
        } else {
          const cause = requestResult.status === 'rejected' ? requestResult.reason : requestResult.value.error
          setRequestsError(cause instanceof Error ? cause.message : 'Could not load mentor requests.')
        }
        if (sessionResult.status === 'fulfilled' && !sessionResult.value.error) {
          setSessions((sessionResult.value.data ?? []) as MentorshipSession[])
        } else {
          const cause = sessionResult.status === 'rejected' ? sessionResult.reason : sessionResult.value.error
          setSessionsError(cause instanceof Error ? cause.message : 'Could not load mentor sessions.')
        }
      } catch (cause) {
        if (active) { setLoadFailed(true); setError(cause instanceof Error ? cause.message : 'Could not load mentorship.') }
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [revision])

  const run = async (key: string, action: () => Promise<void>) => {
    if (lock.current) return
    lock.current = true
    setBusy(key)
    setError('')
    try {
      await action()
      setRevision((value) => value + 1)
      onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this mentorship change. Please retry.')
    } finally {
      lock.current = false
      setBusy(null)
    }
  }

  const decide = (id: string, decision: 'accepted' | 'declined', reasonCode: DeclineReasonCode | '' = '', note = '') =>
    run(`request-${id}`, async () => {
      await respondToMentorshipRequest(id, decision, reasonCode, note)
      if (decision === 'declined') {
        setDeclineFor(null)
        setDeclineCode('')
        setDeclineNote('')
      }
    })

  const hasValidFutureTime = scheduledAt !== '' && Number.isFinite(Date.parse(scheduledAt)) &&
    Date.parse(scheduledAt) > Date.now()
  const schedule = (requestId: string) => run(`schedule-${requestId}`, async () => {
    if (!hasValidFutureTime) throw new Error('Choose a valid future session time in your device time zone.')
    if (loading || sessionsError || requestsError) throw new Error('Refresh your complete request and session history before scheduling.')
    await scheduleMentorshipSession(requestId, scheduledAt, duration)
    setScheduleFor(null)
    setScheduledAt('')
    setDuration(30)
  })

  // Rows are newest first. Keep the current scheduled appointment in preference
  // to older cancelled history, which must never unlock duplicate scheduling.
  const sessionByRequest = new Map<string, MentorshipSession>()
  for (const session of sessions) {
    if (!session.request_id) continue
    const previous = sessionByRequest.get(session.request_id)
    if (!previous || (session.status === 'scheduled' && previous.status !== 'scheduled')) {
      sessionByRequest.set(session.request_id, session)
    }
  }

  return <section>
    <MentorAvailabilityManager />
    <p>Read the learner’s goal before accepting. Add follow-up notes after the session so the learner has a clear next step. Notes are visible to the learner.</p>
    <p className="muted">Session entry times use your device time zone ({Intl.DateTimeFormat().resolvedOptions().timeZone}). You must first publish weekly mentoring hours covering the complete appointment in your chosen availability time zone. The system rejects overlapping appointments. Scheduling does not activate video calls.</p>
    <div className="section-heading"><h2>Mentorship requests</h2><button className="btn btn-secondary" disabled={loading || !!busy} onClick={() => setRevision((value) => value + 1)}>Refresh</button></div>
    {error && <div className="banner banner-error" role="alert">{error}</div>}
    {!loading && requestsError && <p role="alert" className="banner banner-error">Requests unavailable: {requestsError}. Please retry.</p>}
    {!loading && sessionsError && <p role="alert" className="banner banner-error">Sessions unavailable: {sessionsError}. Booking is paused until your calendar has been checked. Existing request decisions remain available.</p>}
    {loading ? <p role="status">Loading mentorship…</p> : loadFailed ? null : requestsError ? <p className="empty-panel">Your private request history could not be checked. This is not a confirmed empty inbox.</p> : requests.length === 0 ? <div className="empty-panel">No mentorship requests.</div> : <div className="list-panel">
      {requests.map((request) => {
        const session = sessionByRequest.get(request.id)
        const canSchedule = !sessionsError && !requestsError && request.status === 'accepted' && (!session || session.status === 'cancelled')
        return <div className="list-row" key={request.id}>
          <div>
            <b>{request.topic ?? 'Mentorship request'}</b>
            {request.message && <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{request.message}</p>}
            {request.preferred_at && <p>Preferred time: {new Date(request.preferred_at).toLocaleString()}. This is the learner's preferred time. Accept the request first, then schedule a separate session.</p>}
            <div className="list-row-meta">{request.status}{session ? ` · session ${session.status}` : ''}</div>
            {session && <div className="list-row-meta">{new Date(session.scheduled_at).toLocaleString()} · {session.duration_min ?? 30} minutes</div>}
            {session && <MentorshipCalendarButton session={session} />}
            {session?.notes && <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}><strong>Follow-up notes: </strong>{session.notes}</p>}
          </div>
          {request.status === 'pending' && <span>
            <button className="btn btn-primary" disabled={!!busy} onClick={() => decide(request.id, 'accepted')}>{busy === `request-${request.id}` ? 'Saving…' : 'Accept'}</button>{' '}
            <button className="btn btn-secondary" disabled={!!busy} onClick={() => { setDeclineFor(request.id); setDeclineCode(''); setDeclineNote(''); setError('') }}>Decline</button>
            {declineFor === request.id && <div className="empty-panel" role="group" aria-label="Decline request" style={{ marginTop: '.5rem' }}>
              <div className="field">
                <label htmlFor={`decline-code-${request.id}`}>{declineText ? 'የውድቅ ምክንያት (ያስፈልጋል)' : 'Reason for declining (required)'}</label>
                <select id={`decline-code-${request.id}`} value={declineCode} disabled={!!busy} onChange={(event) => setDeclineCode(event.target.value as DeclineReasonCode | '')}>
                  <option value="">{declineText ? 'ምክንያት ይምረጡ' : 'Choose a reason'}</option>
                  {DECLINE_REASON_OPTIONS[declineText ? 'am' : 'en'].map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor={`decline-note-${request.id}`}>{declineText ? 'ማብራሪያ (አማራጭ)' : 'Short note for the learner (optional)'}</label>
                <textarea id={`decline-note-${request.id}`} rows={2} maxLength={DECLINE_NOTE_MAX} disabled={!!busy} value={declineNote} onChange={(event) => setDeclineNote(event.target.value)} />
                <span className="field-hint">{declineNote.length}/{DECLINE_NOTE_MAX}</span>
              </div>
              <button className="btn btn-primary" disabled={!!busy || !declineCode} onClick={() => decide(request.id, 'declined', declineCode, declineNote.trim())}>{busy === `request-${request.id}` ? 'Saving…' : 'Confirm decline'}</button>{' '}
              <button className="btn btn-secondary" disabled={!!busy} onClick={() => { setDeclineFor(null); setDeclineCode(''); setDeclineNote('') }}>Keep request</button>
            </div>}
          </span>}
          {canSchedule && scheduleFor !== request.id && <button className="btn btn-primary" disabled={!!busy} onClick={() => { setScheduleFor(request.id); setError('') }}>Schedule session</button>}
          {canSchedule && scheduleFor === request.id && <div style={{ width: '100%' }}>
            <div className="field"><label htmlFor={`mentor-time-${request.id}`}>Session time</label><input id={`mentor-time-${request.id}`} type="datetime-local" value={scheduledAt} disabled={!!busy} onChange={(event) => setScheduledAt(event.target.value)} /></div>
            <div className="field"><label htmlFor={`mentor-duration-${request.id}`}>Duration</label><select id={`mentor-duration-${request.id}`} value={duration} disabled={!!busy} onChange={(event) => setDuration(Number(event.target.value))}>{[15,30,45,60,90,120].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}</select></div>
            {scheduledAt && !hasValidFutureTime && <p role="status" className="muted">
              Select a future appointment time. Your saved availability and any existing appointments will also be checked by MELA.
            </p>}
            <button className="btn btn-primary" disabled={!!busy || !hasValidFutureTime} onClick={() => schedule(request.id)}>{busy === `schedule-${request.id}` ? 'Scheduling…' : 'Save session'}</button>{' '}
            <button className="btn btn-secondary" disabled={!!busy} onClick={() => { setScheduleFor(null); setScheduledAt('') }}>Cancel</button>
          </div>}
          {session?.status === 'scheduled' && <span>
            <div className="field"><label htmlFor={`mentor-notes-${session.id}`}>Follow-up notes for the learner (optional)</label><textarea id={`mentor-notes-${session.id}`} rows={3} maxLength={2000} disabled={!!busy} value={completionNotes[session.id] ?? ''} onChange={e => setCompletionNotes(current => ({ ...current, [session.id]: e.target.value }))} placeholder="What did you cover? What should the learner do next?" /></div>
            <button className="btn btn-primary" disabled={!!busy || !Number.isFinite(sessionEndTime(session)) || sessionEndTime(session) > Date.now()} onClick={() => run(`complete-${session.id}`, async () => { await completeMentorshipSession(session.id, completionNotes[session.id] ?? ''); setCompletionNotes(current => { const next = { ...current }; delete next[session.id]; return next }) })}>{busy === `complete-${session.id}` ? 'Saving…' : 'Mark complete'}</button>{' '}
            <button className="btn btn-secondary" disabled={!!busy} onClick={() => run(`cancel-${session.id}`, () => cancelMentorshipSession(session.id, 'Cancelled by mentor'))}>{busy === `cancel-${session.id}` ? 'Cancelling…' : 'Cancel session'}</button>
          </span>}
        </div>
      })}
    </div>}
  </section>
}

