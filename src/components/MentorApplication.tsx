import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

type Application = {
  id: string; headline: string; expertise: string[]; languages: string[];
  background: string; status: string; submitted_at: string; review_notes: string | null
}
function splitTokens(input: string, limit: number) {
  return Array.from(new Set(input.split(',').map((word) => word.trim()).filter((word) => word.length >= 2))).slice(0, limit)
}
export default function MentorApplication() {
  const [application, setApplication] = useState<Application | null>(null)
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [headline, setHeadline] = useState('')
  const [expertise, setExpertise] = useState('')
  const [languages, setLanguages] = useState('')
  const [background, setBackground] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)

  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    void (async () => {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        if (!auth.user) throw new Error('Sign in to apply.')
        const { data, error: fetchError } = await supabase.from('mentorship_applications')
          .select('id,headline,expertise,languages,background,status,submitted_at,review_notes')
          .eq('applicant_id', auth.user.id).maybeSingle()
        if (fetchError) throw fetchError
        if (active) setApplication(data as Application | null)
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not check application status.')
      } finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [revision])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (lock.current) return
    const topics = splitTokens(expertise, 12)
    const spoken = splitTokens(languages, 10)
    if (headline.trim().length < 6 || topics.length===0 || spoken.length===0 || background.trim().length<30) {
      setError('Add a headline, expertise and languages, and at least 30 characters of background.')
      return
    }
    lock.current = true; setBusy(true); setError('');setNotice('')
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!auth.user) throw new Error('Sign in again to apply.')
      const { error: insertError } = await supabase.from('mentorship_applications').insert({
        applicant_id: auth.user.id, headline: headline.trim(), expertise: topics,
        languages: spoken, background: background.trim(),
      })
      if (insertError) throw new Error(insertError.message || 'Application could not be submitted.')
      setNotice('Application submitted for administrator review. You are not yet approved to mentor.')
      setRevision((current) => current + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Application could not be submitted.')
    } finally { lock.current = false;setBusy(false) }
  }

  return <section className="empty-panel" id="mentorship-apply" style={{ textAlign:'left' }} aria-label="Apply to become a MELA mentor">
    <h2>Become a MELA mentor</h2>
    <p>Qualified adults may apply to contribute. Submission does not make you a verified mentor. Applications require independent qualification and safeguarding review.</p>
    {notice && <p role="status" className="banner banner-info">{notice}</p>}
    {error && <div role="alert" className="banner banner-error">{error}
      <button className="btn btn-secondary" disabled={busy} type="button" onClick={() => setRevision((n) => n + 1)}>Retry</button></div>}
    {loading ? <p role="status">Checking your application…</p> : application
      ? <div><strong>Application: {application.status === 'reviewed_eligible' ? 'Eligible for further credential verification' :
        application.status === 'pending_review' ? 'Under review' : 'Not approved'}</strong>
        <p>Your submission: {new Date(application.submitted_at).toLocaleDateString()} · {application.headline}</p>
        {application.review_notes && <p>Reviewer note: {application.review_notes}</p>}
        <p className="muted">Only a separately verified, active mentor profile can appear in the public directory.</p>
      </div>
      : <form onSubmit={submit}>
        <div className="field"><label htmlFor="mentor-apply-headline">Professional headline</label>
          <input id="mentor-apply-headline" value={headline} onChange={(event) => setHeadline(event.target.value)} minLength={6} maxLength={140} required disabled={busy} placeholder="e.g. Secondary mathematics educator" /></div>
        <div className="field"><label htmlFor="mentor-apply-expertise">Areas of expertise (comma-separated)</label>
          <input id="mentor-apply-expertise" value={expertise} onChange={(event) => setExpertise(event.target.value)} disabled={busy} required placeholder="Mathematics, career guidance" /></div>
        <div className="field"><label htmlFor="mentor-apply-languages">Languages you can mentor in (comma-separated)</label>
          <input id="mentor-apply-languages" value={languages} onChange={(event) => setLanguages(event.target.value)} disabled={busy} required placeholder="Amharic, Afaan Oromo, English" /></div>
        <div className="field"><label htmlFor="mentor-apply-background">Qualifications and relevant mentoring experience</label>
          <textarea id="mentor-apply-background" value={background} onChange={(event) => setBackground(event.target.value)} minLength={30} maxLength={3000} rows={4} disabled={busy} required /></div>
        <p className="muted">Applicants must satisfy MELA's adult and account requirements. Do not enter identity document numbers, passwords or private contact information in this form. Verification documents are handled separately.</p>
        <button className="btn btn-primary" disabled={busy || loading}>Submit application for review</button>
      </form>}
  </section>
}
