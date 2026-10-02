import { useEffect, useState } from 'react'
import { fetchMyContracts, raiseContractDispute, type Contract } from '../lib/contracts'

export default function ContractDisputes() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    let active = true
    setLoading(true)
    fetchMyContracts().then(rows => { if (active) setContracts(rows) })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load contracts.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [revision])
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selected || saving) return
    setSaving(true); setError(''); setSuccess('')
    try {
      await raiseContractDispute(selected, reason)
      setSelected(null); setReason(''); setSuccess('Dispute submitted for support review. Your contract is on hold.'); setRevision(value => value + 1)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not submit the dispute.') }
    finally { setSaving(false) }
  }
  return <section className="list-panel" style={{ padding: '1rem', marginTop: '1rem' }}>
    <div className="section-heading"><h2>Contracts and support</h2><button className="btn btn-secondary" disabled={loading || saving} onClick={() => {setError('');setRevision(value => value + 1)}}>Refresh contracts</button></div>
    {error && <div className="banner banner-error" role="alert">{error}</div>}
    {success && <p role="status">{success}</p>}
    {loading ? <p role="status">Loading contracts…</p> : !contracts.length ? <p>No active contracts.</p> : contracts.map(contract => <div className="list-row" key={contract.id}>
      <div><strong>Contract {contract.id.slice(0,8)}</strong><p>{contract.agreed_amount} {contract.currency} · {contract.status}</p></div>
      {contract.status === 'disputed' ? <span className="pill">Support review pending</span> : <button className="btn btn-secondary" disabled={saving} onClick={() => {setSelected(contract.id);setReason('');setError('')}}>Report a contract issue</button>}
    </div>)}
    {selected && <form onSubmit={submit} aria-label="Contract dispute">
      <p>Submitting places the contract and undisbursed escrow on hold for support review. Transfers already submitted require reconciliation. It does not issue a refund.</p>
      <div className="field"><label htmlFor="contract-dispute-reason">What went wrong?</label><textarea id="contract-dispute-reason" value={reason} onChange={event => setReason(event.target.value)} minLength={10} maxLength={2000} required disabled={saving}/></div>
      <button className="btn btn-primary" disabled={saving || reason.trim().length < 10}>{saving ? 'Submitting…' : 'Submit dispute'}</button>
      <button className="btn btn-secondary" type="button" disabled={saving} onClick={() => setSelected(null)}>Cancel</button>
    </form>}
  </section>
}
