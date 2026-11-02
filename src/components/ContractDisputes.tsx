import { useEffect, useRef, useState } from 'react'
import {
  fetchMyContracts, fetchMyMilestones, fetchMyReviews, raiseContractDispute,
  respondToContract, submitWorkMilestone, submitContractReview,
  type Contract, type WorkMilestone, type WorkReview,
} from '../lib/contracts'

export default function ContractDisputes({ currentUserId, workEnabled = false }: {
  currentUserId?: string; workEnabled?: boolean
}) {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [milestones, setMilestones] = useState<WorkMilestone[]>([])
  const [reviews, setReviews] = useState<WorkReview[]>([])
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [focused, setFocused] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  // Keep drafts independent: each milestone must submit only its own evidence.
  const [deliveryDrafts, setDeliveryDrafts] = useState<Record<string, { url: string; note: string }>>({})
  const [rating, setRating] = useState('5')
  const [reviewComment, setReviewComment] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const lock = useRef(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void (async () => {
      try {
        const records = await fetchMyContracts()
        const [steps, feedback] = await Promise.all([
          fetchMyMilestones(records.map(contract => contract.id)),
          fetchMyReviews(records.map(contract => contract.id)),
        ])
        if (active) { setContracts(records); setMilestones(steps); setReviews(feedback) }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load contracts.')
      } finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [revision])

  const refresh = () => setRevision(value => value + 1)
  const perform = async (operation: () => Promise<unknown>, message: string) => {
    if (lock.current) return
    lock.current = true
    setSaving(true); setError(''); setSuccess('')
    try { await operation(); setSuccess(message); refresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save. Retry safely.') }
    finally { lock.current = false; setSaving(false) }
  }
  const submitDispute = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selected) return
    const contractId = selected
    await perform(async () => {
      await raiseContractDispute(contractId, reason)
      setSelected(null); setReason('')
    }, 'Dispute submitted for support review. Your contract is on hold.')
  }
  const shown = focused ? contracts.filter(c => c.id === focused) : contracts

  return <section className="list-panel" style={{ padding: '1rem', marginTop: '1rem' }} aria-label="My contracts">
    <div className="section-heading">
      <h2>My contracts and milestones</h2>
      {focused && <button className="btn btn-secondary" type="button" disabled={saving} onClick={() => {setFocused(null);setSelected(null);setError('')}}>Back to contracts</button>}
      <button className="btn btn-secondary" type="button" disabled={loading || saving} onClick={() => {setError('');refresh()}}>Refresh contracts</button>
    </div>
    <p className="field-hint">Contract amounts are agreed terms, not available cash. Payment or escrow release requires independent confirmation.</p>
    {error && <div className="banner banner-error" role="alert">{error}</div>}
    {success && <p role="status">{success}</p>}
    {loading ? <p role="status">Loading contracts…</p> : !contracts.length ? <p>No contracts yet. Your accepted proposals will appear here after a verified employer awards the work.</p> : shown.map(contract => {
      const isFreelancer = !!currentUserId && currentUserId === contract.freelancer_id
      const steps = milestones.filter(milestone => milestone.contract_id === contract.id)
      const alreadyReviewed = reviews.some(review => review.contract_id === contract.id && review.reviewer_user_id === currentUserId)
      const canRespond = isFreelancer && workEnabled && contract.status === 'proposed'
      const canDeliver = isFreelancer && workEnabled && contract.status === 'active' && contract.funding_status === 'held'
      return <div className="list-row" key={contract.id}>
        <div style={{width:'100%'}}>
          <strong>Contract {contract.id.slice(0, 8)}</strong>
          <p>{contract.agreed_amount} {contract.currency} · {contract.status} · funding: {contract.funding_status || 'unconfirmed'}</p>
          {!focused && <button className="btn btn-secondary" type="button" onClick={() => {setFocused(contract.id);setError('');setSuccess('')}}>Open contract</button>}
          {(!focused || focused === contract.id) && contract.status !== 'disputed' &&
            <button className="btn btn-secondary" type="button" disabled={saving} onClick={() => {setSelected(contract.id);setReason('');setError('')}}>Report a contract issue</button>}
          {contract.status === 'disputed' && <span className="pill">Support review pending</span>}
          {focused === contract.id && <>
            {contract.terms && <p><strong>Agreed terms:</strong> {contract.terms}</p>}
            {contract.status === 'proposed' && !workEnabled && <p className="banner banner-info">New paid work decisions are paused. Do not begin work or send money.</p>}
            {isFreelancer && contract.status === 'active' && contract.funding_status !== 'held' && <p className="banner banner-info" role="status">Milestone delivery is not available until held escrow funding is confirmed. Do not begin paid work based only on an accepted contract.</p>}
            {canRespond && <>
              <p>Review these terms before accepting. Acceptance does not mean payment is funded.</p>
              <button className="btn btn-primary" type="button" disabled={saving}
                onClick={() => { if (window.confirm('Accept these contract terms? Payment is not guaranteed until escrow is independently verified.')) void perform(() => respondToContract(contract.id, true), 'Contract accepted. Confirm funding before starting paid work.') }}>Accept contract</button>
              <button className="btn btn-secondary" type="button" disabled={saving} onClick={() => void perform(() => respondToContract(contract.id, false), 'Contract declined.')}>Decline offer</button>
            </>}
            <h3>Milestones</h3>
            {!steps.length && <p>No milestones have been recorded for this contract.</p>}
            {steps.map(step => <div className="list-panel" key={step.id}>
              <strong>{step.title}</strong>
              <p>{step.amount} {contract.currency} · {step.status}{step.due_at ? ' · due ' + new Date(step.due_at).toLocaleDateString() : ''}</p>
              {step.description && <p>{step.description}</p>}
              {step.deliverable_url && /^https:\/\//i.test(step.deliverable_url) && <a href={step.deliverable_url} target="_blank" rel="noopener noreferrer">View submitted deliverable</a>}
              {step.review_notes && <p><strong>Reviewer note:</strong> {step.review_notes}</p>}
              {canDeliver && ['pending','in_progress','rejected'].includes(step.status) &&
                <div className="field">
                  <label htmlFor={`deliverable-${step.id}`}>HTTPS deliverable link for {step.title}</label>
                  <input id={`deliverable-${step.id}`} type="url" value={deliveryDrafts[step.id]?.url ?? ''} maxLength={2000} onChange={e => setDeliveryDrafts(current => ({ ...current, [step.id]: { url: e.target.value, note: current[step.id]?.note ?? '' } }))} placeholder="https://…" />
                  <label htmlFor={`delivery-note-${step.id}`}>Delivery note (optional)</label>
                  <textarea id={`delivery-note-${step.id}`} value={deliveryDrafts[step.id]?.note ?? ''} maxLength={2000} onChange={e => setDeliveryDrafts(current => ({ ...current, [step.id]: { url: current[step.id]?.url ?? '', note: e.target.value } }))} />
                  <button className="btn btn-primary" type="button" disabled={saving || !/^https:\/\//i.test((deliveryDrafts[step.id]?.url ?? '').trim())}
                    onClick={() => void perform(async () => {
                      await submitWorkMilestone(step.id, deliveryDrafts[step.id]?.url ?? '', deliveryDrafts[step.id]?.note ?? '')
                      setDeliveryDrafts(current => { const next = { ...current }; delete next[step.id]; return next })
                    }, 'Delivery submitted for employer review. It is not a payment confirmation.')}>Submit milestone</button>
                </div>}
            </div>)}
            {isFreelancer && contract.status === 'completed' && !alreadyReviewed &&
              <div className="field">
                <h3>Review this completed contract</h3>
                <label htmlFor="work-rating">Rating (1 to 5)</label>
                <select id="work-rating" value={rating} onChange={e => setRating(e.target.value)}>
                  {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} stars</option>)}
                </select>
                <label htmlFor="work-review">Your feedback (optional)</label>
                <textarea id="work-review" value={reviewComment} maxLength={2000} onChange={e => setReviewComment(e.target.value)} />
                <button className="btn btn-secondary" type="button" disabled={saving} onClick={() => void perform(() => submitContractReview(contract.id, Number(rating), reviewComment), 'Review saved.')}>Submit review</button>
              </div>}
            {alreadyReviewed && <p>You have reviewed this contract.</p>}
          </>}
        </div>
      </div>
    })}
    {selected && <form onSubmit={submitDispute} aria-label="Contract dispute">
      <p>Disputing places the contract and undisbursed escrow on hold for support review. It does not issue a refund.</p>
      <div className="field">
        <label htmlFor="contract-dispute-reason">What went wrong?</label>
        <textarea id="contract-dispute-reason" value={reason} onChange={event => setReason(event.target.value)} minLength={10} maxLength={2000} required disabled={saving} />
      </div>
      <button className="btn btn-primary" disabled={saving || reason.trim().length < 10}> {saving ? 'Submitting…' : 'Submit dispute'} </button>
      <button className="btn btn-secondary" type="button" disabled={saving} onClick={() => setSelected(null)}>Cancel</button>
    </form>}
  </section>
}
