import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

type Review = {
  id: string
  status: 'pending' | 'approved' | 'declined'
  created_at: string
  reviewed_at: string | null
}

export default function MentorshipAdultEligibility({onApprovalChange}:{onApprovalChange?:(approved:boolean)=>void}) {
  const [review, setReview] = useState<Review | null>(null)
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  const lock = useRef(false)

  useEffect(() => {
    let active = true
    setLoading(true);setError('')
    void (async () => {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser()
        if (authError) throw new Error(authError.message)
        if (!auth.user) throw new Error('Please sign in to review eligibility.')
        const { data, error: readError } = await supabase.from('mentorship_adult_age_reviews')
          .select('id,status,created_at,reviewed_at')
          .eq('learner_id', auth.user.id).maybeSingle()
        if (readError) throw new Error(readError.message)
        if (active) { setReview(data as Review | null); onApprovalChange?.(data?.status==='approved') }
      } catch (cause) {
        if (active) { setError(cause instanceof Error ? cause.message : 'Unable to check mentorship eligibility.'); onApprovalChange?.(false) }
      } finally { if (active) setLoading(false) }
    })()
    return () => {active=false}
  },[revision])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (lock.current || !acknowledged) return
    const date = Date.parse(dateOfBirth)
    const today = new Date()
    const threshold = new Date(today.getFullYear()-18,today.getMonth(),today.getDate())
    if (!Number.isFinite(date) || date>threshold.getTime() || date<Date.parse('1900-01-01')) {
      setError('This review is only for eligible adults 18 or older. Please check your date and account stage.')
      return
    }
    lock.current=true;setBusy(true);setError('');setNotice('')
    try {
      const { data: auth, error: authError }=await supabase.auth.getUser()
      if (authError) throw new Error(authError.message)
      if (!auth.user) throw new Error('Please sign in again to continue.')
      const { error: insertError }=await supabase.from('mentorship_adult_age_reviews').insert({
        learner_id:auth.user.id,
        claimed_date_of_birth:dateOfBirth,
        consent_to_mentorship_rules:true,
      })
      if (insertError) throw new Error(insertError.message)
      setDateOfBirth('')
      setAcknowledged(false)
      setNotice('Request received. You cannot access direct adult mentorship until an authorized administrator independently verifies your age.')
      setRevision(n=>n+1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to submit eligibility review.')
    } finally {setBusy(false);lock.current=false}
  }

  return <section className="empty-panel" aria-label="Adult mentorship eligibility" style={{textAlign:'left'}}>
    <h3>Adult mentorship eligibility</h3>
    <p>University and TVET learners must be at least 18 and have their age independently reviewed by a MELA administrator before requesting direct or group mentorship. Your birth date is private and is not shown to mentors.</p>
    {error&&<p className="banner banner-error" role="alert">{error} <button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>setRevision(n=>n+1)}>Retry status</button></p>}
    {notice&&<p className="banner banner-info" role="status">{notice}</p>}
    {loading?<p role="status">Checking eligibility…</p>:
      review ? <div>
        <strong>{review.status==='approved'?'Adult eligibility approved':
          review.status==='declined'?'Age review not approved':'Awaiting independent administrator review'}</strong>
        <p className="muted">Request submitted {new Date(review.created_at).toLocaleDateString()}.
          {review.status==='approved'?' Mentorship features still require verified mentors and the usual rules.':''}</p>
        {review.status==='declined'&&<p>Contact MELA support if your verified identity information needs correction. Do not create another account to bypass a decision.</p>}
        <button className="btn btn-secondary" type="button" onClick={()=>setRevision(n=>n+1)} disabled={busy}>Refresh status</button>
      </div>
      : <form onSubmit={submit}>
        <label className="field" htmlFor="mentorship-age-date">Date of birth (Gregorian calendar)
          <input id="mentorship-age-date" type="date" value={dateOfBirth}
            min="1900-01-01" required disabled={busy}
            onChange={event=>setDateOfBirth(event.target.value)}/>
        </label>
        <label className="field">
          <input type="checkbox" checked={acknowledged} disabled={busy}
            onChange={event=>setAcknowledged(event.target.checked)}/>
          I confirm that I am 18 or older, the date is accurate, and I agree to follow MELA's mentorship safeguarding rules. I understand that submitting this form does not verify my identity or automatically approve mentoring.
        </label>
        <p className="muted">Do not upload identity documents, national identification numbers or other private records through this form. An authorized administrator will arrange appropriate verification separately.</p>
        <button type="submit" className="btn btn-primary" disabled={busy||!acknowledged||!dateOfBirth}>
          {busy?'Submitting…':'Request private age verification'}
        </button>
      </form>}
  </section>
}
