import type { StudentView } from '../hooks/useStudentNavigation'
import type { MelaDashboard } from '../lib/dashboard'
import type { CourseCertificate, VerifiedSkill } from '../lib/passport'
import { buildPassportPathway, type PassportStepStatus } from '../lib/passport-guidance'

const statusText: Record<PassportStepStatus, string> = {
  recorded: 'Record found', next: 'Next step', unavailable: 'Not available', suggested: 'Recommended',
}

export default function PassportGuidance({ passport, skills, certificates, stageKey, gradeLevel, onNavigate }: {
  passport: MelaDashboard['passport'] | null
  skills: VerifiedSkill[] | null
  certificates: CourseCertificate[] | null
  stageKey?: string | null
  gradeLevel?: number | null
  onNavigate?: (view: StudentView) => void
}) {
  const { schoolPath, steps } = buildPassportPathway({ passport, skills, certificates, stageKey, gradeLevel })
  return <section className="list-panel question-card" aria-label="Career Passport next steps">
    <h2>{schoolPath ? 'My learning journey' : 'My career pathway'}</h2>
    <p>Choose a next step based on your MELA records. This is guidance, not a hiring score, a verified résumé or an eligibility decision.</p>
    {schoolPath && <p className="field-hint">School learners focus on learning and safe portfolios. Adult work and scholarship opportunities have separate eligibility and safeguarding rules.</p>}
    <ol style={{ paddingLeft: '1.5rem' }}>
      {steps.map((step) => <li key={step.id} style={{ marginBottom: '1.25rem' }}>
        <strong>{step.title}</strong>{' '}<span className="pill">{statusText[step.status]}</span>
        <p>{step.detail}</p>
        {step.status === 'unavailable' && <p className="field-hint">This record could not be confirmed. Try refreshing Career Passport.</p>}
        {step.destination === '#passport-records'
          ? <a className="btn btn-secondary" href="#passport-records">{step.action}</a>
          : <button className="btn btn-secondary" type="button" disabled={!onNavigate} onClick={() => onNavigate?.(step.destination as StudentView)}>{step.action}</button>}
      </li>)}
    </ol>
    <p className="field-hint">A saved project is self-reported. Only MELA-issued or independently verified records should be described as verified. Your passport is not shared automatically from this screen.</p>
  </section>
}
