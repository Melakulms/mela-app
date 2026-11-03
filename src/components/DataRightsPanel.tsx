import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

type RequestType = 'access' | 'export' | 'rectification' | 'erasure' | 'objection' | 'restriction'
type RightsRequest = { id: string; request_type: RequestType; status: string; requested_at: string; updated_at: string | null; response_notes: string | null }
const REQUEST_TYPES: { value: RequestType; label: string }[] = [
  { value: 'access', label: 'Access my personal information' },
  { value: 'export', label: 'Request a copy of my information' },
  { value: 'rectification', label: 'Correct inaccurate information' },
  { value: 'erasure', label: 'Request deletion of my information or account' },
  { value: 'objection', label: 'Object to processing of my information' },
  { value: 'restriction', label: 'Request restricted processing' },
]

/** Uses the existing, owner-scoped public.data_subject_requests table.
 * Requests are not automatic deletions or exports. Human review is required.
 */
export default function DataRightsPanel() {
  const [requestType, setRequestType] = useState<RequestType>('access')
  const [requests, setRequests] = useState<RightsRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [cancelRequestId, setCancelRequestId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    void (async () => {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser()
        if (authError || !auth.user) throw new Error('Sign in again to view your privacy requests.')
        const { data, error: readError } = await supabase.from('data_subject_requests')
          .select('id,request_type,status,requested_at,updated_at,response_notes')
          .eq('user_id', auth.user.id)
          .order('requested_at', { ascending: false }).limit(30)
        if (readError) throw readError
        if (active) { setRequests((data ?? []) as RightsRequest[]); setError('') }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not read your privacy requests.')
      } finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [revision])

  const outstanding = requests.some(request => request.request_type === requestType &&
    (request.status === 'pending' || request.status === 'in_review'))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || loading || outstanding) return
    setBusy(true); setError(''); setNotice('')
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser()
      if (authError || !auth.user) throw new Error('Sign in again to submit your request.')
      // The existing security-invoker RPC uses auth.uid() rather than a client-supplied owner ID.
      // The partial unique index additionally closes simultaneous tab/device races.
      const { error: writeError } = await supabase.rpc('request_my_data_subject_action', {
        p_request_type: requestType,
      })
      if (writeError) {
        if (writeError.code === '23505' || /request of this type is already open/i.test(writeError.message)) {
          throw new Error('A request of this type is already open. Refresh to see its status.')
        }
        throw writeError
      }
      setNotice('Your request was recorded for authorized review. This does not automatically delete or export any information.')
      setRevision(value => value + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit your request.')
    } finally { setBusy(false) }
  }

  async function cancelPending(id: string) {
    if (busy || loading || cancelRequestId !== id) return
    setBusy(true); setError(''); setNotice('')
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser()
      if (authError || !auth.user) throw new Error('Please sign in again to cancel your request.')
      const { data, error: updateError } = await supabase.from('data_subject_requests')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('user_id', auth.user.id)
        .eq('status', 'pending')
        .select('id').maybeSingle()
      if (updateError) throw updateError
      if (!data) throw new Error('This request is no longer pending. Refresh to see its latest status.')
      setCancelRequestId(null)
      setNotice('Your pending request was cancelled. No personal records were deleted.')
      setRevision(value => value + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not cancel the request.')
    } finally { setBusy(false) }
  }

  async function copyRequestReference(id: string) {
    setError('')
    setNotice('')
    try {
      if (typeof navigator.clipboard?.writeText !== 'function')
        throw new Error('Clipboard not supported')
      await navigator.clipboard.writeText(id)
      setNotice('Request reference copied. Share it only through a verified private MELA support channel.')
    } catch {
      setError('Automatic copy is unavailable on this device. Long-press the request reference below to copy it.')
    }
  }

  return <section className="list-panel" aria-label="Personal data rights requests">
    <h2>My privacy and data rights</h2>
    <p>Request access, correction, export, deletion, objection or restriction. Your request is private and reviewed by authorized MELA staff. Identity checks and legal retention requirements may apply.</p>
    <p className="field-hint">Do not send passwords, bank credentials or identity documents here. This request form does not automatically delete your account or release files.</p>
    <a href={`${import.meta.env.BASE_URL}legal/mela-protection-plan.html`} target="_blank" rel="noopener noreferrer">Read MELA's 20-point protection plan (working draft)</a>
    {error && <p className="banner banner-error" role="alert">{error}</p>}
    {notice && <p className="banner banner-info" role="status">{notice}</p>}
    <form onSubmit={submit}>
      <div className="field">
        <label htmlFor="mela-rights-request-type">What would you like to request?</label>
        <select id="mela-rights-request-type" value={requestType} onChange={event => setRequestType(event.target.value as RequestType)} disabled={busy || loading}>
          {REQUEST_TYPES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      {outstanding && <p role="status">You already have a request of this type awaiting review. See its status below.</p>}
      <button className="btn btn-primary" type="submit" disabled={busy || loading || outstanding}>{busy ? 'Submitting request…' : 'Submit privacy request'}</button>
    </form>
    <h3>My recent requests</h3>
    {loading ? <p role="status">Loading your requests…</p> : requests.length === 0 ?
      <p>No privacy requests are recorded for this account.</p> :
      <ul>{requests.map(request => <li key={request.id}>
        {REQUEST_TYPES.find(type => type.value === request.request_type)?.label ?? request.request_type}
        {' · '}{request.status.replaceAll('_', ' ')}
        {' · '}{new Date(request.requested_at).toLocaleDateString()}
        <p className="field-hint">Private request reference: <code>{request.id}</code>{' '}
          <button type="button" className="btn btn-secondary" disabled={busy}
            aria-label={`Copy reference for ${request.request_type} request`}
            onClick={() => void copyRequestReference(request.id)}>Copy reference</button>
        </p>
        {request.status === 'in_review' && request.updated_at && <p className="field-hint">Last review update: {new Date(request.updated_at).toLocaleString()}</p>}
        {request.response_notes && <p className="field-hint">Message from MELA review: {request.response_notes}</p>}
        {request.status === 'pending' && (cancelRequestId === request.id ? <div className="field">
          <p>Cancel this pending request? This does not close your MELA account.</p>
          <button type="button" className="btn btn-secondary" onClick={() => void cancelPending(request.id)} disabled={busy}>Confirm cancellation</button>{' '}
          <button type="button" className="btn btn-secondary" onClick={() => setCancelRequestId(null)} disabled={busy}>Keep request</button>
        </div> : <div>
          <button type="button" className="btn btn-secondary" onClick={() => setCancelRequestId(request.id)} disabled={busy} aria-label={`Cancel pending ${request.request_type} request`}>Cancel pending request</button>
        </div>)}
      </li>)}</ul>}
    <button type="button" className="btn btn-secondary" onClick={() => setRevision(value => value + 1)} disabled={busy || loading}>Refresh request status</button>
    <p className="field-hint">Requests marked in review cannot be cancelled here. Please contact an authorized reviewer to discuss them. If you cannot sign in, use an independently verified MELA support channel; never post personal documents in public chats.</p>
  </section>
}
