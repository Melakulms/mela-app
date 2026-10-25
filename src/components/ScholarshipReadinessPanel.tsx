import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { educationReadiness, type ScholarshipAcademicProfile } from '../lib/scholarship-readiness'

const ACADEMIC_DOCUMENT_TYPES = new Set([
  'academic_transcript', 'transcript', 'degree_certificate', 'degree',
  'school_result', 'academic_record', 'grade_report',
])

type EvidenceState = { status: 'loading' | 'available' | 'unavailable'; count: number }

/** Non-decisional guidance based only on the signed-in learner's own profile.
 * It never awards admission, marks documents as verified or changes application state.
 */
export default function ScholarshipReadinessPanel({ verifiedOfferCount }: { verifiedOfferCount: number | null }) {
  const [profile, setProfile] = useState<ScholarshipAcademicProfile | null>(null)
  const [evidence, setEvidence] = useState<EvidenceState>({ status: 'loading', count: 0 })
  const [loading, setLoading] = useState(true)
  const [signedOut, setSignedOut] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setEvidence({ status: 'loading', count: 0 })
    void (async () => {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        if (!auth.user) {
          if (active) { setSignedOut(true); setProfile(null); setEvidence({ status: 'unavailable', count: 0 }) }
          return
        }
        if (active) setSignedOut(false)
        const { data: learner, error: profileError } = await supabase.from('profiles')
          .select('role,full_name,education_stage_key,education_onboarding_completed,grade_level,major,graduation_year,email_verified,phone_verified')
          .eq('id', auth.user.id).maybeSingle()
        if (profileError) throw profileError
        if (active) setProfile((learner ?? null) as ScholarshipAcademicProfile | null)
        // An inaccessible document query must never be interpreted as zero verified evidence.
        const { data: documents, error: documentError } = await supabase.from('profile_documents')
          .select('document_type,verified').eq('user_id', auth.user.id).eq('verified', true)
        if (!active) return
        if (documentError) {
          setEvidence({ status: 'unavailable', count: 0 })
        } else {
          setEvidence({
            status: 'available',
            count: (documents ?? []).filter(doc =>
              ACADEMIC_DOCUMENT_TYPES.has(String(doc.document_type).toLowerCase())
            ).length,
          })
        }
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Could not check scholarship readiness.')
          setProfile(null)
          setEvidence({ status: 'unavailable', count: 0 })
        }
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [revision])

  const readiness = educationReadiness(profile)
  return <section className="list-panel" aria-label="Your MELA scholarship readiness" style={{ marginBottom: 16 }}>
    <div className="section-heading">
      <div>
        <h2>My scholarship readiness</h2>
        <p className="muted">Prepare your education profile before looking for a possible study-level fit. MELA does not automatically assume nationality, qualifications, uploaded documents or admission.</p>
      </div>
      <button type="button" className="btn btn-secondary" onClick={() => setRevision(value => value + 1)} disabled={loading}>Recheck profile</button>
    </div>
    {loading ? <p role="status">Checking your profile and verified academic evidence…</p> :
      signedOut ? <p role="status">Sign in to see your own scholarship readiness. You can still research public opportunities.</p> :
      error ? <div className="banner banner-error" role="alert">Readiness could not be confirmed: {error}. No eligibility assessment is being made.</div> :
      <>
        <p role="status"><strong>{readiness.completed} of {readiness.total} profile checks complete</strong> — {readiness.profileReadyForResearchMatching ? 'Ready for preliminary study-level research, not verified scholarship eligibility.' : 'More information needed before personalized matching.'}</p>
        <progress aria-label="Education profile readiness" value={readiness.completed} max={readiness.total} style={{ width: '100%' }} />
        <ul>
          {readiness.checks.map(check => <li key={check.key}>
            {check.complete ? '✓' : '○'} {check.label}{!check.complete ? ' — missing or not confirmed' : ''}
          </li>)}
        </ul>
        <p><strong>Academic documents:</strong> {evidence.status === 'available'
          ? evidence.count + ' verified academic document(s) recorded in MELA.'
          : 'Verification status unavailable — no evidence is assumed.'}</p>
        <p className="muted">If information is missing, open Profile using the bottom navigation and add accurate education details. Documents must be verified by authorized MELA reviewers; uploading or checking a box is not verification.</p>
        {profile?.education_stage_key?.startsWith('school_') && profile.grade_level !== null && profile.grade_level <= 10 &&
          <div className="banner banner-info">School grades 1–10: explore universities for future planning. A degree scholarship application is not appropriate at this stage.</div>}
      </>}
    <div className="banner banner-info">
      <strong>What MELA still cannot confirm</strong>
      <p>Nationality and residence eligibility, academic qualifications required by each university, language certificates, guardian authorization where applicable, scholarship deadlines and award decisions must be verified independently. A profile score or checklist is never an admission decision.</p>
      <p>{verifiedOfferCount === null
        ? 'Loading currently approved scholarship listings…'
        : verifiedOfferCount + ' currently approved, open and source-checked scholarship listing(s) are available in Verified offers. Research them individually; this count is not personalized eligibility.'}</p>
    </div>
  </section>
}
