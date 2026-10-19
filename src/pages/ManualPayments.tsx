import { useEffect, useState } from 'react'
import { manualPayments as api, type PaymentOrder } from '../lib/manual-payments'

/** Mount in the learner or admin app after authentication. Server enforces reviewer+MFA. */
export default function ManualPayments({ reviewer = false }: { reviewer?: boolean }) {
  const [orders, setOrders] = useState<PaymentOrder[]>([])
  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof api.catalog>>>()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [selected, setSelected] = useState<PaymentOrder>()
  const [reference, setReference] = useState('')
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [paidAt, setPaidAt] = useState('')
  const [note, setNote] = useState('')
  const [received, setReceived] = useState(false)
  const [owner, setOwner] = useState(false)
  async function refresh() {
    setOrders(await (reviewer ? api.queue() : api.myOrders()))
    if (!reviewer) setCatalog(await api.catalog())
  }
  async function run(fn: () => Promise<unknown>) {
    if (busy) return
    setBusy(true); setMessage('')
    try { const result = await fn(); await refresh(); setMessage(result && typeof result === 'object' && 'reason' in result ? String(result.reason) : 'Updated successfully') }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Could not complete request. Refresh before retrying.') }
    finally { setBusy(false) }
  }
  useEffect(() => { void run(refresh) }, [reviewer])
  function choose(order: PaymentOrder) {
    setSelected(order); setReference(reviewer ? '' : order.reference ?? ''); setAmount(''); setRecipient(''); setPaidAt(''); setNote(''); setReceived(false); setOwner(false)
  }
  return <section className="card">
    <h1>{reviewer ? 'Verify incoming payments' : 'Pay by transfer'}</h1>
    <p>Submitting a transaction reference does not confirm payment. Approval follows verification in the receiving account.</p>
    <p role="status" aria-live="polite">{message}</p>
    <button disabled={busy} onClick={() => void run(refresh)}>Refresh payment status</button>
    {!reviewer && catalog && (!catalog.enabled ? <p>Payment collection is not enabled.</p> : catalog.products.map(product => <article key={product.id}>
      <h2>{product.title} · {(product.amount_minor / 100).toFixed(2)} {product.currency}</h2>
      {catalog.accounts.map(account => <button disabled={busy} key={account.id} onClick={() => void run(async () => { const order = await api.createOrder(product.id, account.id); choose(order); return order })}>Create order · {account.label}</button>)}
    </article>))}
    <h2>{reviewer ? 'Pending review' : 'Your orders'}</h2>
    {!orders.length && <p>No orders to show.</p>}
    {orders.map(order => <article key={order.id} className="list-row"><div>
      <strong>{(order.amount_minor / 100).toFixed(2)} {order.currency} · {order.status}</strong>
      <p>{order.reason}</p><small>Order: {order.id}</small>
      <p>Recipient: {order.provider} · {order.recipient}</p>
      <p>Reference: {order.reference || 'Not submitted'}</p>
      {order.status !== 'approved' && order.status !== 'rejected' && <button disabled={busy} onClick={() => choose(order)}>{reviewer ? 'Review' : 'Submit reference'}</button>}
    </div></article>)}
    {selected && <form onSubmit={e => { e.preventDefault(); void run(async () => {
      if (!reviewer) return api.submit(selected.id, reference)
      if (!/^\d+(\.\d{1,2})?$/.test(amount)) throw new Error('Enter an amount with up to two decimal places')
      const minor = Math.round(Number(amount) * 100)
      if (!Number.isSafeInteger(minor) || !paidAt) throw new Error('Valid amount and payment date required')
      const result = await api.recordReceived({ order_id: selected.id, reference, recipient, amount_minor: minor, currency: 'ETB', paid_at: new Date(paidAt).toISOString(), confirmed_received: received, confirmed_order_owner: owner, evidence_note: note })
      setSelected(undefined); return result
    }) }}>
      <h2>{reviewer ? 'Record verified incoming transfer' : 'Submit your transfer reference'}</h2>
      <p>Order {selected.id} · {(selected.amount_minor / 100).toFixed(2)} ETB</p>
      <label>Transaction reference<input required maxLength={64} value={reference} onChange={e => setReference(e.target.value)} /></label>
      {reviewer && <>
        <p>Read the actual incoming-account record. A customer screenshot is not enough. Confirm who the payment belongs to using the order memo or a separate payer check.</p>
        <label>Amount received (ETB)<input required inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} /></label>
        <label>Recipient account shown in record<input required value={recipient} onChange={e => setRecipient(e.target.value)} /></label>
        <label>Payment date and time (your local time)<input required type="datetime-local" value={paidAt} onChange={e => setPaidAt(e.target.value)} /></label>
        <label>Verification note<textarea required minLength={20} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} /></label>
        <label><input type="checkbox" required checked={received} onChange={e => setReceived(e.target.checked)} /> I verified this successful incoming payment in our receiving account.</label>
        <label><input type="checkbox" required checked={owner} onChange={e => setOwner(e.target.checked)} /> I verified this payment belongs to this order and buyer.</label>
      </>}
      <button disabled={busy}>{busy ? 'Checking…' : reviewer ? 'Record and run verification agent' : 'Submit for verification'}</button>
      <button type="button" disabled={busy} onClick={() => setSelected(undefined)}>Close</button>
      {reviewer && <button type="button" disabled={busy || note.trim().length < 10} onClick={() => void run(async () => { const result = await api.reject(selected.id, note); setSelected(undefined); return result })}>Reject with this note</button>}
    </form>}
  </section>
}
