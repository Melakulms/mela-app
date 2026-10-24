import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Link = { id: string; guardian_email: string; relationship: string; status: string; requested_at: string }
export default function GuardianConsentRequest() {
  const [school, setSchool] = useState(false)
  const [links, setLinks] = useState<Link[]>([])
  const [email, setEmail] = useState('')
  const [relationship, setRelationship] = useState('parent')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let live = true
    void (async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        if (!user) return
        const { data: profile, error: profileError } = await supabase.from('profiles')
          .select('role,education_stage_key').eq('id', user.id).maybeSingle()
        if (profileError) throw profileError
        const needed = profile?.role === 'student' && String(profile.education_stage_key ?? '').startsWith('school_')
        if (live) setSchool(needed)
        if (!needed) return
        const { data, error: relationshipError } = await supabase.from('guardian_relationships')
          .select('id,guardian_email,relationship,status,requested_at')
          .eq('learner_id', user.id).order('requested_at', { ascending: false }).limit(10)
        if (relationshipError) throw relationshipError
        if (live) setLinks((data ?? []) as Link[])
      } catch (cause) {
        if (live) setError(cause instanceof Error ? cause.message : 'Guardian requests could not be loaded')
      }
    })()
    return () => { live = false }
  }, [revision])
  const request = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setMessage('')
    try {
      const { error } = await supabase.rpc('request_my_guardian_consent', {
        p_guardian_email: email.trim().toLowerCase(), p_relationship: relationship, p_guardian_phone: null,
      })
      if (error) throw error
      setMessage('Request recorded. A registered parent must confirm their email and a qualified administrator must independently verify the relationship. This is not automatic approval.')
      setEmail('')
      setRevision(x => x + 1)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not submit guardian request') }
    finally { setBusy(false) }
  }
  if (!school) return null
  return <section className="list-panel" aria-label="Guardian consent">
    <div className="section-heading"><div><h2>Guardian consent</h2><p className="muted">School learners require independent guardian verification for restricted application features.</p></div></div>
    {error && <div className="banner banner-error" role="alert">{error}</div>}
    {message && <p role="status">{message}</p>}
    {links.length > 0 && <div>{links.map(link => <p key={link.id} className="list-row-meta">
      {link.guardian_email} · {link.relationship} · <strong>{link.status}</strong>
    </p>)}</div>}
    <form onSubmit={request}>
      <label htmlFor="guardian-email">Parent or guardian account email</label>
      <input id="guardian-email" type="email" required maxLength={254} autoComplete="off" placeholder="guardian@example.com" value={email} onChange={e => setEmail(e.target.value)} />
      <label htmlFor="guardian-relationship">Relationship</label>
      <select id="guardian-relationship" value={relationship} onChange={e => setRelationship(e.target.value)}>
        <option value="parent">Parent</option><option value="legal_guardian">Legal guardian</option>
      </select>
      <button className="btn btn-secondary" disabled={busy || !email.trim()} type="submit">{busy ? 'Sending…' : 'Request verification'}</button>
    </form>
    <p className="muted">Do not upload identity cards or private family documents here. MELA administrators must use their authorized verification process.</p>
  </section>
}
