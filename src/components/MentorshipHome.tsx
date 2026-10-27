import { useEffect, useState } from 'react'
import type { Mentor, MentorshipSession, MyMentorshipRequest } from '../lib/mentorship'
import {
  recommendMentors, summarizeMentorshipHome, type MentorshipHomeExtras,
} from '../lib/mentorship-home'

type Props = {
  mentors: Mentor[]
  requests: MyMentorshipRequest[]
  sessions: MentorshipSession[]
  stageKey?: string | null
  revision: number
}

export default function MentorshipHome({ mentors, requests, sessions, stageKey, revision }: Props) {
  const [extras, setExtras] = useState<MentorshipHomeExtras | null>(null)
  const [loadingExtras, setLoadingExtras] = useState(true)
  const [extrasError, setExtrasError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let mounted = true
    setLoadingExtras(true)
    setExtrasError('')
    // Home enhancements must never block verified mentor discovery or existing session actions.
    import('../lib/mentorship-home-data')
      .then(({ fetchMentorshipHomeExtras }) => fetchMentorshipHomeExtras())
      .then((value) => { if (mounted) setExtras(value) })
      .catch(() => { if (mounted) { setExtras(null); setExtrasError('Your personal home details are unavailable. Your requests and sessions remain accessible below.') } })
      .finally(() => { if (mounted) setLoadingExtras(false) })
    return () => { mounted = false }
  }, [revision, retry])

  const summary = summarizeMentorshipHome(requests, sessions)
  const topics = new Map(requests.map((request) => [request.id, request.topic]))
  const next = summary.nextSession
  const recommendations = extras
    ? recommendMentors(mentors, extras.interests, extras.preferredLanguage, requests, stageKey)
    : []
  const blockedStage = ['school_1_6', 'school_7_8', 'school_9_10'].includes(stageKey ?? '')

  return <section id="mentorship-home" className="empty-panel" aria-label="Mentorship Home" style={{ textAlign: 'left', borderTop: '4px solid #16875f' }}>
    <h2>Mentorship Home</h2>
    <p>Build your next step with trusted guidance. Your overview uses your actual MELA requests, sessions, and learning profile.</p>

    <div className="module-grid" aria-label="Your mentorship overview">
      <div><strong>{mentors.length}</strong><div className="muted">Verified mentors</div></div>
      <div><strong>{summary.pendingRequests}</strong><div className="muted">Pending requests</div></div>
      <div><strong>{summary.upcomingCount}</strong><div className="muted">Upcoming sessions</div></div>
      <div><strong>{summary.completedCount}</strong><div className="muted">Completed sessions</div></div>
    </div>
    <nav aria-label="Mentorship sections" style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', margin: '1rem 0' }}>
      <a className="btn btn-secondary" href="#mentor-directory">Find a mentor</a>
      <a className="btn btn-secondary" href="#mentorship-journey">My mentorship</a>
      <a className="btn btn-secondary" href="#mentorship-resources">Prepare for a session</a>
    </nav>

    <div className="section-heading"><h3>Your next session</h3></div>
    {next
      ? <div className="list-panel"><div className="list-row">
          <div>
            <strong>{topics.get(next.request_id ?? '') ?? 'Mentorship session'}</strong>
            <p>{new Date(next.scheduled_at).toLocaleString()} · {next.duration_min ?? 30} minutes</p>
            <p className="muted">Displayed in your device time zone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).</p>
          </div>
          <a className="btn btn-secondary" href="#mentorship-journey">View session</a>
        </div></div>
      : <p className="muted">No upcoming confirmed sessions. An accepted request may still need scheduling.</p>}

    {loadingExtras && <p role="status">Loading learning goals and updates…</p>}
    {extrasError && <p role="status">{extrasError} <button type="button" className="btn btn-secondary" onClick={() => setRetry((n) => n + 1)}>Retry personal details</button></p>}
    {extras && <>
      {extras.warnings.length > 0 && <p role="status" className="muted">{extras.warnings.join(' ')}</p>}
      <div className="section-heading"><h3>Current learning goals</h3></div>
      {extras.goals.length
        ? <ul>{extras.goals.map((goal) => <li key={goal}>{goal}</li>)}</ul>
        : <p className="muted">No learning goals are saved in your education profile yet. Your own goals will appear here after you add them to your profile.</p>}
      <p className="muted">Goals are copied from your private student profile. Completing sessions does not automatically certify these goals.</p>

      <div className="section-heading"><h3>Mentors suggested for your interests</h3></div>
      {blockedStage
        ? <p className="muted">Direct mentorship is not available for your school stage. Continue with your approved teacher and guardian.</p>
        : recommendations.length > 0
          ? <>
              {stageKey === 'school_11_12' && <p className="muted">Any request still requires guardian verification or adult eligibility.</p>}
              <div className="module-grid">
                {recommendations.map((mentor) => <article key={mentor.user_id} className="module-card" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
                  <h4>{mentor.full_name ?? 'MELA mentor'}</h4>
                  <p>{mentor.headline ?? 'Verified mentor'}</p>
                  {(mentor.expertise ?? []).length > 0 && <p className="muted">{mentor.expertise.slice(0, 4).join(', ')}</p>}
                  <a className="btn btn-secondary" href="#mentor-directory">View verified mentor directory</a>
                </article>)}
              </div>
              <p className="muted">Suggested using saved learning interests and mentor descriptions. This is not a guaranteed eligibility or quality assessment.</p>
            </>
          : <p className="muted">No profile-based suggestions yet. Browse all verified mentors below; suggestions appear when your learning interests match verified mentor expertise.</p>}

      <div className="section-heading"><h3>Recent mentorship updates</h3></div>
      {extras.updates.length
        ? <ul>{extras.updates.map((entry) => <li key={entry.id}><strong>{entry.title}</strong> — {entry.body}</li>)}</ul>
        : <p className="muted">No mentorship notifications yet.</p>}

      <div className="section-heading"><h3>Announcements</h3></div>
      {extras.announcements.length
        ? <ul>{extras.announcements.map((entry) => <li key={entry.id}><strong>{entry.title}</strong> — {entry.body}</li>)}</ul>
        : <p className="muted">No current public announcements for learners.</p>}
    </>}

    <p className="muted">Mentor verification and age-based access remain mandatory. Please use MELA's Safety & Privacy center for concerns.</p>
  </section>
}
