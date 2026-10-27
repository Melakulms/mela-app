import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import MentorAvailabilityManager from './MentorAvailabilityManager'
import { cancelMentorshipSession, completeMentorshipSession, scheduleMentorshipSession, type MentorshipSession } from '../lib/mentorship'

type RequestRow = { id: string; mentee_id: string; topic: string | null; message: string | null; preferred_at: string | null; status: string; created_at: string }

export default function MentorLifecycle({ onChanged }: { onChanged: () => void }) {
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [sessions, setSessions] = useState<MentorshipSession[]>([])
  const [scheduleFor, setScheduleFor] = useState<string | null>(null)
  const [scheduledAt, setScheduledAt] = useState('')
  const [duration, setDuration] = useState(30)
  const [completionNotes, setCompletionNotes] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const lock = useRef(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void (async () => {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        if (!auth.user) throw new Error('Please sign in again.')
        const [requestResult, sessionResult] = await Promise.all([
          supabase.from('mentorship_requests').select('id,mentee_id,topic,message,preferred_at,status,created_at').eq('mentor_id', auth.user.id).order('created_at', { ascending: false }),
          supabase.from('mentorship_sessions').select('id,request_id,mentor_id,mentee_id,scheduled_at,duration_min,status,call_room_id,completed_at,cancelled_at,notes').eq('mentor_id', auth.user.id).order('scheduled_at', { ascending: false }),
        ])
        if (requestResult.error) throw requestResult.error
        if (sessionResult.error) throw sessionResult.error
        if (active) {
          setRequests((requestResult.data ?? []) as RequestRow[])
          setSessions((sessionResult.data ?? []) as MentorshipSession[])
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load mentorship.')
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

  const decide = (id: string, decision: 'accepted' | 'declined') => run(`request-${id}`, async () => {
    const { error: rpcError } = await supabase.rpc('respond_mentorship_request', { p_request_id: id, p_decision: decision })
    if (rpcError) throw rpcError
  })

  const schedule = (requestId: string) => run(`schedule-${requestId}`, async () => {
    await scheduleMentorshipSession(requestId, scheduledAt, duration)
    setScheduleFor(null)
    setScheduledAt('')
    setDuration(30)
  })

  const sessionByRequest = new Map(sessions.filter((row) => row.request_id).map((row) => [row.request_id as string, row]))

  return <section>
    <MentorAvailabilityManager />
    <p>Read the learner’s goal before accepting. Add follow-up notes after the session so the learner has a clear next step. Notes are visible to the learner.</p>
    <p className="muted">Times use {Intl.DateTimeFormat().resolvedOptions().timeZone}. Scheduling does not provide an in-app video call.</p>
    <div className="section-heading"><h2>Mentorship requests</h2><button className="btn btn-secondary" disabled={loading || !!busy} onClick={() => setRevision((value) => value + 1)}>Refresh</button></div>
    {error && <div className="banner banner-error" role="alert">{error}</div>}
    {loading ? <p role="status">Loading mentorship…</p> : requests.length === 0 ? <div className="empty-panel">No mentorship requests.</div> : <div className="list-panel">
      {requests.map((request) => {
        const session = sessionByRequest.get(request.id)
        const canSchedule = request.status === 'accepted' && (!session || session.status === 'cancelled')
        return <div className="list-row" key={request.id}>
          <div>
            <b>{request.topic ?? 'Mentorship request'}</b>
            {request.message && <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{request.message}</p>}
            {request.preferred_at && <p>Preferred time: {new Date(request.preferred_at).toLocaleString()}. This is the learner's preferred time. Accept the request first, then schedule a separate session.</p>}
            <div className="list-row-meta">{request.status}{session ? ` · session ${session.status}` : ''}</div>
            {session && <div className="list-row-meta">{new Date(session.scheduled_at).toLocaleString()} · {session.duration_min ?? 30} minutes</div>}
            {session?.notes && <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}><strong>Follow-up notes: </strong>{session.notes}</p>}
          </div>
          {request.status === 'pending' && <span>
            <button className="btn btn-primary" disabled={!!busy} onClick={() => decide(request.id, 'accepted')}>{busy === `request-${request.id}` ? 'Saving…' : 'Accept'}</button>{' '}
            <button className="btn btn-secondary" disabled={!!busy} onClick={() => decide(request.id, 'declined')}>Decline</button>
          </span>}
          {canSchedule && scheduleFor !== request.id && <button className="btn btn-primary" disabled={!!busy} onClick={() => { setScheduleFor(request.id); setError('') }}>Schedule session</button>}
          {canSchedule && scheduleFor === request.id && <div style={{ width: '100%' }}>
            <div className="field"><label htmlFor={`mentor-time-${request.id}`}>Session time</label><input id={`mentor-time-${request.id}`} type="datetime-local" value={scheduledAt} disabled={!!busy} onChange={(event) => setScheduledAt(event.target.value)} /></div>
            <div className="field"><label htmlFor={`mentor-duration-${request.id}`}>Duration</label><select id={`mentor-duration-${request.id}`} value={duration} disabled={!!busy} onChange={(event) => setDuration(Number(event.target.value))}>{[15,30,45,60,90,120].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}</select></div>
            <button className="btn btn-primary" disabled={!!busy || !scheduledAt} onClick={() => schedule(request.id)}>{busy === `schedule-${request.id}` ? 'Scheduling…' : 'Save session'}</button>{' '}
            <button className="btn btn-secondary" disabled={!!busy} onClick={() => { setScheduleFor(null); setScheduledAt('') }}>Cancel</button>
          </div>}
          {session?.status === 'scheduled' && <span>
            <div className="field"><label htmlFor={`mentor-notes-${session.id}`}>Follow-up notes for the learner (optional)</label><textarea id={`mentor-notes-${session.id}`} rows={3} maxLength={2000} disabled={!!busy} value={completionNotes[session.id] ?? ''} onChange={e => setCompletionNotes(current => ({ ...current, [session.id]: e.target.value }))} placeholder="What did you cover? What should the learner do next?" /></div>
            <button className="btn btn-primary" disabled={!!busy || new Date(session.scheduled_at).getTime() > Date.now()} onClick={() => run(`complete-${session.id}`, async () => { await completeMentorshipSession(session.id, completionNotes[session.id] ?? ''); setCompletionNotes(current => { const next = { ...current }; delete next[session.id]; return next }) })}>{busy === `complete-${session.id}` ? 'Saving…' : 'Mark complete'}</button>{' '}
            <button className="btn btn-secondary" disabled={!!busy} onClick={() => run(`cancel-${session.id}`, () => cancelMentorshipSession(session.id, 'Cancelled by mentor'))}>{busy === `cancel-${session.id}` ? 'Cancelling…' : 'Cancel session'}</button>
          </span>}
        </div>
      })}
    </div>}
  </section>
}

