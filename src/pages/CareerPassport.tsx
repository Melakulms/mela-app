import PassportRecords from '../components/PassportRecords'
import PassportGuidance from '../components/PassportGuidance'
import type { StudentView } from '../hooks/useStudentNavigation'
import { useEffect, useState } from 'react'
import { fetchMyAchievements, fetchMyCourseCertificates, fetchMyVerifiedSkills, type CourseCertificate, type PassportAchievement, type VerifiedSkill } from '../lib/passport'
import { fetchDashboard, type MelaDashboard } from '../lib/dashboard'
import { useI18n } from '../i18n'

function verificationLink(code: string) {
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('certificate', code)
  return url.toString()
}

export default function CareerPassport({ onBack, onNavigate, stageKey, gradeLevel }: { onBack: () => void; onNavigate?: (view: StudentView) => void; stageKey?: string | null; gradeLevel?: number | null }) {
  const { t } = useI18n()
  const [achievements, setAchievements] = useState<PassportAchievement[] | null>(null)
  const [skills, setSkills] = useState<VerifiedSkill[] | null>(null)
  const [certificates, setCertificates] = useState<CourseCertificate[] | null>(null)
  const [score, setScore] = useState<MelaDashboard['passport'] | null>(null)
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    setError(''); setSectionErrors({}); setLoading(true)
    setAchievements(null); setSkills(null); setCertificates(null); setScore(null)
    const load = async () => {
      const results = await Promise.allSettled([fetchMyAchievements(), fetchMyVerifiedSkills(), fetchMyCourseCertificates(), fetchDashboard()] as const)
      if (!active) return
      const [a, s, c, dash] = results
      const failures: Record<string, string> = {}
      if (a.status === 'fulfilled') setAchievements(a.value); else failures.achievements = 'Achievements could not load.'
      if (s.status === 'fulfilled') setSkills(s.value); else failures.skills = 'Skills could not load.'
      if (c.status === 'fulfilled') setCertificates(c.value); else failures.certificates = 'Credentials could not load.'
      if (dash.status === 'fulfilled') setScore(dash.value.passport); else failures.overview = 'Passport overview could not load.'
      setSectionErrors(failures); setLoading(false)
    }
    void load()
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
        <h1>{t('careerPassport')}</h1>
        <button className="btn btn-secondary" onClick={onBack}>{t('back')}</button>
      </div>
      {error && <div className="banner banner-error" role="alert">{error}<button className="btn btn-secondary" onClick={() => setRevision((value) => value + 1)}>Retry</button></div>}

      <p>Your learning record brings together skills, achievements and MELA course credentials. A profile score measures profile completeness; it is not proof of professional qualification.</p>
      {loading && <p role="status">Loading your career passport…</p>}
      {Object.keys(sectionErrors).length > 0 && <div className="banner banner-error" role="alert"><p>{Object.values(sectionErrors).join(' ')} Other available sections are shown below.</p><button className="btn btn-secondary" disabled={loading} onClick={() => setRevision(v => v + 1)}>Retry unavailable sections</button></div>}
      {score && (
        <div className="stat-strip">
          <div><span className="stat-value">{score.profile_score}</span><span className="stat-label">Profile score</span></div>
          <div><span className="stat-value">{score.badge_count}</span><span className="stat-label">Badges</span></div>
        </div>
      )}

      {score && <section className="list-panel question-card" aria-label="Passport record overview"><h2>Your passport records</h2><dl style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:16}}>{[
        ['Education',score.education_count],['Experience',score.experience_count],['Projects',score.project_count],['Languages',score.language_count],['Documents',score.document_count],['Verified documents',score.verified_document_count],
      ].map(([label,count]) => <div key={String(label)}><dt>{label}</dt><dd style={{margin:0,fontWeight:700}}>{typeof count === 'number' ? count : 'Unavailable'}</dd></div>)}</dl><p className="field-hint">These counts reflect saved records. Having a record does not mean it has been verified.</p></section>}
      <PassportGuidance passport={score} skills={skills} certificates={certificates} stageKey={stageKey} gradeLevel={gradeLevel} onNavigate={onNavigate} />
      <PassportRecords onSaved={() => setRevision(v => v + 1)} />
      <div className="section-heading"><h2>Course credentials</h2></div>
      <p className="field-hint">Only issued credentials appear here. Before sharing a verification link, open it to review the learner name and credential information it reveals. Revoked credentials are not valid.</p>
      {certificates && certificates.length === 0 && <div className="empty-panel">Complete every lesson in a credential-bearing MELA course to earn a verifiable credential.</div>}
      {certificates && certificates.length > 0 && <div className="list-panel">
        {certificates.map((certificate) => <div className="list-row" key={certificate.id}>
          <div>
            <div className="list-row-title">{certificate.course_title}</div>
            <div className="list-row-meta">{certificate.credential_type} · issued {new Date(certificate.issued_at).toLocaleDateString()}</div>
            <div className="list-row-meta"><code>{certificate.certificate_code}</code></div>
          </div>
          <a className="btn btn-secondary" href={verificationLink(certificate.certificate_code)} target="_blank" rel="noopener noreferrer">View credential</a>
          {certificate.revoked_at ? <span className="pill">Revoked</span> : <button className="btn btn-secondary" onClick={() => copyVerification(certificate)}>{copied === certificate.id ? 'Link copied' : 'Copy verification link'}</button>}
        </div>)}
      </div>}

      <div className="section-heading"><h2>Skills and verification</h2></div>
      {skills && <p>{skills.filter(s => s.verified === true).length} verified · {skills.filter(s => s.verified !== true).length} awaiting verification</p>}
      {skills && skills.length === 0 && <div className="empty-panel">No skills recorded yet. Continue learning and completing assessments; skills appear here when recorded by MELA.</div>}
      {skills && skills.length > 0 && (
        <div className="list-panel">
          {skills.map((s) => (
            <div className="list-row" key={s.id}>
              <div className="list-row-title">{s.skill_name}</div>
              <span className="pill">{s.verified === true ? `Verified${s.level ? ` · ${s.level}` : ''}` : 'Awaiting verification'}</span>
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
              <div><span className="pill">{a.verified === true ? 'Verified' : 'Unverified'}</span><span className="pill">{a.is_public === true ? 'Marked public' : 'Private'}</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
