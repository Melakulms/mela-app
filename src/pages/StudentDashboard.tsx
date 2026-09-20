import { useEffect, useState } from 'react'
import { fetchDashboard, type MelaDashboard } from '../lib/dashboard'
import { logoutUser } from '../lib/auth'

const MODULES: { key: string; label: string; blurb: string; view?: string }[] = [
  { key: 'career_passport', label: 'Career Passport', blurb: 'Your verified profile, skills, and achievements.', view: 'passport' },
  { key: 'practice', label: 'Practice', blurb: 'Subject questions with instant explanations.', view: 'practice' },
  { key: 'arena', label: 'Arena', blurb: 'Head-to-head question battles.', view: 'arena' },
  { key: 'academy', label: 'Skill Academy', blurb: 'Courses and learning paths.', view: 'academy' },
  { key: 'ai_career_coach', label: 'AI Career Coach', blurb: 'Personalized guidance on your next step.', view: 'coach' },
  { key: 'opportunities', label: 'Opportunity Hub', blurb: 'Jobs, internships, and training.', view: 'opportunities' },
  { key: 'scholarships', label: 'EthioScholar Connect', blurb: 'Scholarships matched to you.' },
  { key: 'mentorship', label: 'Mentorship', blurb: 'Book time with a verified mentor.', view: 'mentorship' },
  { key: 'earn_work', label: 'Earn & Work', blurb: 'Freelance tasks and micro-work.' },
  { key: 'challenges', label: 'Sponsored Challenges', blurb: 'Competitions run by employers.' },
  { key: 'study_materials', label: 'Study Materials', blurb: 'Notes, PDFs, and videos by subject.', view: 'materials' },
  { key: 'student_services', label: 'Scholarships, Wallet & More', blurb: 'Scholarships, notifications, earnings, applications, documents, challenges, and progress.', view: 'services' },
]

export default function StudentDashboard({ onNavigate }: { onNavigate: (view: string) => void }) {
  const [data, setData] = useState<MelaDashboard | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchDashboard()
      .then(setData)
      .catch((e) => setError(e.message ?? 'Could not load your dashboard.'))
  }, [])

  if (error) {
    return (
      <div className="dash-main">
        <div className="banner banner-error">{error}</div>
      </div>
    )
  }

  if (!data) {
    return <div className="centered-loading">Loading your dashboard…</div>
  }

  const { profile, passport, practice, arena, scholarships, feature_flags } = data

  return (
    <div className="dash-main">
      <div className="dash-greeting">
        <h1>Welcome back, {profile.full_name?.split(' ')[0] ?? 'there'}</h1>
        <p className="muted">Here's where your career passport stands today.</p>
      </div>

      <div className="stat-strip">
        <div>
          <span className="stat-value">{passport.profile_score}</span>
          <span className="stat-label">Profile score</span>
        </div>
        <div>
          <span className="stat-value">{passport.badge_count}</span>
          <span className="stat-label">Badges earned</span>
        </div>
        <div>
          <span className="stat-value">{practice.stats.current_streak_days}</span>
          <span className="stat-label">Day streak</span>
        </div>
        <div>
          <span className="stat-value">{arena.arena_achievements}</span>
          <span className="stat-label">Arena achievements</span>
        </div>
      </div>

      <div className="section-heading">
        <h2>Where to go next</h2>
      </div>
      <div className="module-grid">
        {MODULES.map((m) => {
          const enabled = m.key === 'study_materials' ? true : feature_flags[m.key]
          const isBuilt = !!m.view
          return (
            <div
              key={m.key}
              className={`module-card${enabled ? '' : ' disabled'}`}
              style={isBuilt && enabled ? { cursor: 'pointer' } : undefined}
              onClick={isBuilt && enabled ? () => onNavigate(m.view!) : undefined}
            >
              <h3>{m.label}</h3>
              <p>{m.blurb}</p>
              {!enabled && <span className="soon">Not enabled yet</span>}
              {enabled && !isBuilt && <span className="soon">Screen not built yet</span>}
            </div>
          )
        })}
      </div>

      <div className="section-heading">
        <h2>Recommended practice</h2>
        <span className="muted">Based on what you haven't tried yet</span>
      </div>
      {practice.recommendations.length === 0 ? (
        <div className="empty-panel">No recommendations yet — come back after your first practice session.</div>
      ) : (
        <div className="list-panel">
          {practice.recommendations.slice(0, 5).map((rec) => (
            <div className="list-row" key={rec.topic_id}>
              <div>
                <div className="list-row-title">{rec.topic}</div>
                <div className="list-row-meta">{rec.subject}</div>
              </div>
              <span className="pill">{rec.reason}</span>
            </div>
          ))}
        </div>
      )}

      <div className="section-heading">
        <h2>Scholarships matched to you</h2>
      </div>
      {scholarships.length === 0 ? (
        <div className="empty-panel">No scholarship matches yet.</div>
      ) : (
        <div className="list-panel">
          {scholarships.map((s) => (
            <div className="list-row" key={s.id}>
              <div>
                <div className="list-row-title">{s.title}</div>
                <div className="list-row-meta">{s.institution} · {s.study_country}</div>
              </div>
              <span className="pill">Due {s.deadline}</span>
            </div>
          ))}
        </div>
      )}

      <button className="btn btn-secondary" onClick={() => logoutUser()}>Log out</button>
    </div>
  )
}
