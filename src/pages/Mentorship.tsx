import { useEffect, useState } from 'react'
import { fetchVerifiedMentors, fetchMyMentorshipRequests, requestMentor, type Mentor, type MyMentorshipRequest } from '../lib/mentorship'

export default function Mentorship({ onBack }: { onBack: () => void }) {
  const [mentors, setMentors] = useState<Mentor[] | null>(null)
  const [requests, setRequests] = useState<MyMentorshipRequest[]>([])
  const [error, setError] = useState('')
  const [openMentor, setOpenMentor] = useState<string | null>(null)
  const [topic, setTopic] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => {
    Promise.all([fetchVerifiedMentors(), fetchMyMentorshipRequests()])
      .then(([m, r]) => { setMentors(m); setRequests(r) })
      .catch((e) => setError(e.message ?? 'Could not load mentors.'))
  }
  useEffect(load, [])

  const alreadyRequested = (mentorId: string) => requests.some((r) => r.mentor_id === mentorId && r.status !== 'declined' && r.status !== 'cancelled')

  const submitRequest = async (mentorId: string) => {
    if (!topic.trim()) { setError('Add a short topic before sending the request.'); return }
    setBusy(true)
    setError('')
    try {
      await requestMentor(mentorId, topic, message)
      setOpenMentor(null)
      setTopic('')
      setMessage('')
      load()
    } catch (e: any) {
      setError(e.message ?? 'Could not send that request.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dash-main">
      <div className="section-heading">
        <h1>Mentorship</h1>
        <button className="btn btn-secondary" onClick={onBack}>Back</button>
      </div>
      {error && <div className="banner banner-error">{error}</div>}

      {requests.length > 0 && (
        <>
          <div className="section-heading"><h2>Your requests</h2></div>
          <div className="list-panel">
            {requests.map((r) => (
              <div className="list-row" key={r.id}>
                <div className="list-row-title">{r.topic ?? 'Mentorship request'}</div>
                <span className="pill">{r.status}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-heading"><h2>Verified mentors</h2></div>
      {!mentors && !error && <p className="muted">Loading mentors…</p>}
      {mentors && mentors.length === 0 && <div className="empty-panel">No verified mentors are available yet.</div>}
      {mentors && mentors.length > 0 && (
        <div className="module-grid">
          {mentors.map((m) => (
            <div className="module-card" key={m.user_id}>
              <h3>{m.full_name}</h3>
              <p>{m.headline ?? m.organization ?? 'MELA mentor'}</p>
              {alreadyRequested(m.user_id) ? (
                <span className="pill">Requested</span>
              ) : openMentor === m.user_id ? (
                <div>
                  <div className="field">
                    <label>Topic</label>
                    <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. CV review" />
                  </div>
                  <div className="field">
                    <label>Message (optional)</label>
                    <input value={message} onChange={(e) => setMessage(e.target.value)} />
                  </div>
                  <button className="btn btn-primary btn-block" onClick={() => submitRequest(m.user_id)} disabled={busy}>
                    {busy ? 'Sending…' : 'Send request'}
                  </button>
                </div>
              ) : (
                <button className="btn btn-secondary" onClick={() => setOpenMentor(m.user_id)}>Request mentorship</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
