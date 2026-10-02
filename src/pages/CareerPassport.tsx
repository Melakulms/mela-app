import { useEffect, useState } from 'react'
import { fetchMyAchievements, fetchMyCourseCertificates, fetchMyVerifiedSkills, type CourseCertificate, type PassportAchievement, type VerifiedSkill } from '../lib/passport'
import { fetchDashboard } from '../lib/dashboard'

function verificationLink(code: string) {
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('certificate', code)
  return url.toString()
}

export default function CareerPassport({ onBack }: { onBack: () => void }) {
  const [achievements, setAchievements] = useState<PassportAchievement[] | null>(null)
  const [skills, setSkills] = useState<VerifiedSkill[] | null>(null)
  const [certificates, setCertificates] = useState<CourseCertificate[] | null>(null)
  const [score, setScore] = useState<{ profile_score: number; badge_count: number } | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    setError('')
    Promise.all([fetchMyAchievements(), fetchMyVerifiedSkills(), fetchMyCourseCertificates(), fetchDashboard()])
      .then(([a, s, c, dash]) => { if (active) { setAchievements(a); setSkills(s); setCertificates(c); setScore(dash.passport) } })
      .catch((e) => { if (active) setError(e.message ?? 'Could not load your career passport.') })
    return () => { active = false }
  }, [revision])

  const copyVerification = async (certificate: CourseCertificate) => {
    setCopied('')
    try {
      await navigator.clipboard.writeText(verificationLink(certificate.certificate_code))
      setCopied(certificate.id)
    } catch {
      setError('Could not copy the verification link. You can still share the certificate code.')
    }
  }

  return (
    <div className="dash-main">
      <div className="section-heading">
        <h1>Career Passport</h1>
        <button className="btn btn-secondary" onClick={onBack}>Back</button>
      </div>
      {error && <div className="banner banner-error" role="alert">{error}<button className="btn btn-secondary" onClick={() => setRevision((value) => value + 1)}>Retry</button></div>}

      {score && (
        <div className="stat-strip">
          <div><span className="stat-value">{score.profile_score}</span><span className="stat-label">Profile score</span></div>
          <div><span className="stat-value">{score.badge_count}</span><span className="stat-label">Badges</span></div>
        </div>
      )}

      <div className="section-heading"><h2>Verified course credentials</h2></div>
      {certificates && certificates.length === 0 && <div className="empty-panel">Complete every lesson in a credential-bearing MELA course to earn a verifiable credential.</div>}
      {certificates && certificates.length > 0 && <div className="list-panel">
        {certificates.map((certificate) => <div className="list-row" key={certificate.id}>
          <div>
            <div className="list-row-title">{certificate.course_title}</div>
            <div className="list-row-meta">{certificate.credential_type} · issued {new Date(certificate.issued_at).toLocaleDateString()}</div>
            <div className="list-row-meta"><code>{certificate.certificate_code}</code></div>
          </div>
          {certificate.revoked_at ? <span className="pill">Revoked</span> : <button className="btn btn-secondary" onClick={() => copyVerification(certificate)}>{copied === certificate.id ? 'Link copied' : 'Copy verification link'}</button>}
        </div>)}
      </div>}

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
