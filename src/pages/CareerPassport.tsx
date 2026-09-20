import { useEffect, useState } from 'react'
import { fetchMyAchievements, fetchMyVerifiedSkills, type PassportAchievement, type VerifiedSkill } from '../lib/passport'
import { fetchDashboard } from '../lib/dashboard'

export default function CareerPassport({ onBack }: { onBack: () => void }) {
  const [achievements, setAchievements] = useState<PassportAchievement[] | null>(null)
  const [skills, setSkills] = useState<VerifiedSkill[] | null>(null)
  const [score, setScore] = useState<{ profile_score: number; badge_count: number } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([fetchMyAchievements(), fetchMyVerifiedSkills(), fetchDashboard()])
      .then(([a, s, dash]) => { setAchievements(a); setSkills(s); setScore(dash.passport) })
      .catch((e) => setError(e.message ?? 'Could not load your career passport.'))
  }, [])

  return (
    <div className="dash-main">
      <div className="section-heading">
        <h1>Career Passport</h1>
        <button className="btn btn-secondary" onClick={onBack}>Back</button>
      </div>
      {error && <div className="banner banner-error">{error}</div>}

      {score && (
        <div className="stat-strip">
          <div><span className="stat-value">{score.profile_score}</span><span className="stat-label">Profile score</span></div>
          <div><span className="stat-value">{score.badge_count}</span><span className="stat-label">Badges</span></div>
        </div>
      )}

      <div className="section-heading"><h2>Verified skills</h2></div>
      {skills && skills.length === 0 && <div className="empty-panel">No verified skills yet — they're earned through practice, courses, and mentorship.</div>}
      {skills && skills.length > 0 && (
        <div className="list-panel">
          {skills.map((s) => (
            <div className="list-row" key={s.id}>
              <div className="list-row-title">{s.skill_name}</div>
              <span className="pill">{s.verified ? (s.level ?? 'Verified') : 'Pending'}</span>
            </div>
          ))}
        </div>
      )}

      <div className="section-heading"><h2>Achievements</h2></div>
      {achievements && achievements.length === 0 && <div className="empty-panel">No achievements recorded yet.</div>}
      {achievements && achievements.length > 0 && (
        <div className="list-panel">
          {achievements.map((a) => (
            <div className="list-row" key={a.id}>
              <div>
                <div className="list-row-title">{a.title}</div>
                <div className="list-row-meta">{a.issuer ?? a.achievement_type}</div>
              </div>
              {a.verified && <span className="pill">Verified</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
