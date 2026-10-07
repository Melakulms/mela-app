import { useEffect, useState } from 'react'
import {
import { useI18n } from '../i18n'
  fetchMySafetyCenter,
  refreshSchoolSafetyStatus,
  requestGuardianConsent,
  submitSafetyReport,
  type GuardianRelationship,
  type PolicyDocument,
  type SafetyProfile,
  type SafetyReport,
} from '../lib/safety'

const REPORT_REASONS = [
  ['bullying_or_harassment', 'Bullying or harassment'],
  ['unsafe_contact', 'Unsafe or unwanted contact'],
  ['sexual_or_exploitative_content', 'Sexual or exploitative content'],
  ['privacy_or_identity', 'Privacy or identity concern'],
  ['fraud_or_scam', 'Fraud or scam'],
  ['self_harm_or_crisis', 'Self-harm or crisis concern'],
  ['other_safety_concern', 'Other safety concern'],
] as const

export default function SafetyCenter({ onBack }: { onBack: () => void }) {
  const { t } = useI18n()
  const [profile, setProfile] = useState<SafetyProfile | null>(null)
  const [guardians, setGuardians] = useState<GuardianRelationship[]>([])
  const [reports, setReports] = useState<SafetyReport[]>([])
  const [policies, setPolicies] = useState<PolicyDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [revision, setRevision] = useState(0)
  const [reason, setReason] = useState<string>(REPORT_REASONS[0][0])
  const [details, setDetails] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [guardianRelationship, setGuardianRelationship] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    fetchMySafetyCenter().then((data) => {
      if (!active) return
      setProfile(data.profile)
      setGuardians(data.guardians)
      setReports(data.reports)
      setPolicies(data.policies)
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Could not load the Safety Center.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [revision])

  const schoolStage = profile?.education_stage_key?.startsWith('school_') ?? false
  const verifiedGuardian = guardians.find((guardian) => guardian.status === 'verified')
  const pendingGuardian = guardians.find((guardian) => guardian.status === 'pending')

  const sendReport = async () => {
    setBusy(true); setError(''); setSuccess('')
    try {
      await submitSafetyReport(reason, details)
      setDetails('')
      setSuccess('Your safety report was submitted. You can track its status below.')
      setRevision((value) => value + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit your report.')
    } finally { setBusy(false) }
  }

  const requestGuardian = async () => {
    setBusy(true); setError(''); setSuccess('')
    try {
      await requestGuardianConsent(guardianEmail, guardianRelationship, guardianPhone)
      await refreshSchoolSafetyStatus()
      setGuardianEmail(''); setGuardianRelationship(''); setGuardianPhone('')
      setSuccess('Guardian consent request saved. Verification must be completed by an authorized reviewer; learners cannot self-verify.')
      setRevision((value) => value + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not request guardian consent.')
    } finally { setBusy(false) }
  }

  return (
    <div className="dash-main">
      <div className="section-heading">
        <div><h1>{t('safetyPrivacy')}</h1><p>Report concerns, review your protection status, and manage guardian consent.</p></div>
        <button className="btn btn-secondary" onClick={onBack} disabled={busy}>{t('back')}</button>
      </div>

      <div className="banner banner-info" role="note">
        If you are in immediate danger or feel unsafe, contact a trusted adult or local emergency service. A MELA report is not an emergency response channel.
      </div>
      {error && <div className="banner banner-error" role="alert">{error}</div>}
      {success && <div className="banner banner-info" role="status">{success}</div>}
      {loading && <p role="status">Loading safety controls…</p>}

      {!loading && <>
        <section aria-labelledby="safety-report-heading">
          <div className="section-heading"><h2 id="safety-report-heading">Report a safety concern</h2></div>
          <div className="field">
            <label htmlFor="safety-reason">What happened?</label>
            <select id="safety-reason" value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy}>
              {REPORT_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="safety-details">Describe the concern</label>
            <textarea id="safety-details" rows={5} maxLength={4000} value={details} onChange={(event) => setDetails(event.target.value)} disabled={busy} placeholder="Describe what happened. Do not include passwords or payment secrets." />
            <span className="field-hint">{details.length}/4000</span>
          </div>
          <button className="btn btn-primary" onClick={sendReport} disabled={busy || details.trim().length < 10}>{busy ? 'Submitting…' : 'Submit report'}</button>
        </section>

        <section aria-labelledby="protection-heading">
          <div className="section-heading"><h2 id="protection-heading">Protection status</h2></div>
          <div className="list-panel">
            <div className="list-row"><div><div className="list-row-title">Account safety status</div><div className="list-row-meta">{profile?.learner_safety_status ?? 'not available'}</div></div></div>
            <div className="list-row"><div><div className="list-row-title">Private work messaging</div><div className="list-row-meta">{schoolStage ? 'Blocked for school-stage learners' : 'Available only inside authorized work flows'}</div></div></div>
            <div className="list-row"><div><div className="list-row-title">Video calls</div><div className="list-row-meta">Disabled until the production safeguarding and media path is approved</div></div></div>
          </div>
        </section>

        {schoolStage && <section aria-labelledby="guardian-heading">
          <div className="section-heading"><h2 id="guardian-heading">Guardian consent</h2></div>
          {verifiedGuardian ? <div className="banner banner-info" role="status">Verified guardian relationship: {verifiedGuardian.relationship}.</div> : pendingGuardian ? <div className="banner banner-info" role="status">Guardian verification is pending for {pendingGuardian.guardian_email ?? 'the submitted guardian'}.</div> : <p>No verified guardian relationship is on file yet.</p>}
          {!verifiedGuardian && <>
            <div className="field"><label htmlFor="guardian-email">Guardian email</label><input id="guardian-email" type="email" value={guardianEmail} onChange={(event) => setGuardianEmail(event.target.value)} disabled={busy} /></div>
            <div className="field"><label htmlFor="guardian-relationship">Relationship</label><input id="guardian-relationship" value={guardianRelationship} maxLength={80} onChange={(event) => setGuardianRelationship(event.target.value)} disabled={busy} placeholder="e.g. parent, guardian" /></div>
            <div className="field"><label htmlFor="guardian-phone">Phone (optional)</label><input id="guardian-phone" value={guardianPhone} maxLength={40} onChange={(event) => setGuardianPhone(event.target.value)} disabled={busy} /></div>
            <button className="btn btn-secondary" onClick={requestGuardian} disabled={busy || !guardianEmail.trim() || guardianRelationship.trim().length < 2}>{busy ? 'Saving…' : 'Request guardian consent'}</button>
            <p className="field-hint">Submitting this request does not verify consent. Verification is controlled by the authorized safeguarding/admin workflow.</p>
          </>}
        </section>}

        <section aria-labelledby="reports-heading">
          <div className="section-heading"><h2 id="reports-heading">My recent reports</h2></div>
          {reports.length === 0 ? <div className="empty-panel">You have not submitted a safety report.</div> : <div className="list-panel">
            {reports.map((report) => <div className="list-row" key={report.id}><div><div className="list-row-title">{REPORT_REASONS.find(([value]) => value === report.reason)?.[1] ?? report.reason}</div><div className="list-row-meta">Submitted {new Date(report.created_at).toLocaleDateString()} · {report.status.replaceAll('_', ' ')}</div></div><span className="pill">{report.status}</span></div>)}
          </div>}
        </section>

        <section aria-labelledby="policy-heading">
          <div className="section-heading"><h2 id="policy-heading">Current policy records</h2></div>
          <div className="list-panel">
            {policies.map((policy) => <div className="list-row" key={`${policy.policy_key}-${policy.version}`}><div><div className="list-row-title">{policy.title}</div><div className="list-row-meta">Version {policy.version}{policy.explicit_consent ? ' · explicit consent' : ''}{policy.revocable ? ' · revocable' : ''}</div></div></div>)}
          </div>
          <p className="field-hint">Policy text and legal suitability remain subject to qualified Ethiopian legal review before unrestricted launch.</p>
        </section>
      </>}
    </div>
  )
}
