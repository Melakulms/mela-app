import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Plan = { key: 'pro_monthly' | 'premium_monthly'; name: string; amount_etb: number; days: number; referral_etb: number }
type Order = { id: string; plan_key: string; amount_minor: number; status: string; created_at: string }
type Method = { method_code: string; institution_name: string }
type Checkout = { id: string; status: string; plan: string; amount_etb: number; method: string; recipient: string }
const statusLabels: Record<string,string> = {
  draft: 'Awaiting transfer reference',
  pending_review: 'Awaiting independent payment verification',
  verified: 'Subscription activated',
  rejected: 'Payment rejected',
  reversed: 'Payment reversed'
}

/** Prices come from the database, not from the client or Telegram. */
export default function SubscriptionPlans() {
  const [plans,setPlans] = useState<Plan[]>([])
  const [orders,setOrders] = useState<Order[]>([])
  const [methods,setMethods] = useState<Method[]>([])
  const [open,setOpen] = useState(false)
  const [chosen,setChosen] = useState('')
  const [method,setMethod] = useState('')
  const [checkout,setCheckout] = useState<Checkout|null>(null)
  const [reference,setReference] = useState('')
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [message,setMessage] = useState('')

  const refresh = useCallback(async () => {
    const [catalog,history] = await Promise.all([
      supabase.rpc('mela_billing_user_v1',{p_action:'plans',p_data:{}}),
      supabase.rpc('mela_billing_user_v1',{p_action:'my_orders',p_data:{}})
    ])
    if (catalog.error) throw catalog.error
    if (history.error) throw history.error
    const data = catalog.data as {plans?:Plan[];submissions_open?:boolean}|null
    setPlans(data?.plans??[])
    setOpen(data?.submissions_open===true)
    setOrders(Array.isArray(history.data)?history.data as Order[]:[])
    if (data?.submissions_open) {
      const {data:accounts,error:accountError} = await supabase
        .from('payment_receiving_accounts').select('method_code,institution_name').eq('active',true)
      if (accountError) throw accountError
      setMethods((accounts??[]) as Method[])
    }
  },[])

  useEffect(() => { let cancelled=false
    void refresh().catch(e=>{ if (!cancelled) setError(e instanceof Error?e.message:'Cannot load subscription information') })
    return ()=>{cancelled=true}
  },[refresh])

  const start = async() => {
    setBusy(true);setError('');setMessage('')
    try {
      const {data,error:problem}=await supabase.rpc('mela_billing_user_v1',{
        p_action:'create',p_data:{plan_key:chosen,method_code:method}
      })
      if(problem)throw problem
      setCheckout(data as Checkout);await refresh()
    }catch(e){setError(e instanceof Error?e.message:'Cannot create payment order')}finally{setBusy(false)}
  }
  const submit = async() => {
    if(!checkout)return
    setBusy(true);setError('');setMessage('')
    try {
      const {error:problem}=await supabase.rpc('mela_billing_user_v1',{
        p_action:'submit',p_data:{order_id:checkout.id,reference:reference.trim()}
      })
      if(problem)throw problem
      setMessage('Reference submitted. Access and referral rewards remain pending until the transfer is verified against bank records.')
      setCheckout(null);setReference('');await refresh()
    }catch(e){setError(e instanceof Error?e.message:'Cannot submit reference')}finally{setBusy(false)}
  }

  return <section className="list-panel" aria-label="MELA subscriptions">
    <div className="section-heading"><h2>MELA subscriptions · የMELA አባልነት</h2></div>
    <p>Free foundational education stays free. Choose Pro or Premium for additional paid services when payment collection opens.</p>
    <div role="list" className="cards-grid">
      {plans.map(plan=><article role="listitem" key={plan.key} className="list-panel">
        <h3>{plan.name}</h3>
        <p><strong>{plan.amount_etb} ETB</strong> / {plan.days} days</p>
        <p>Invitation reward: {plan.referral_etb} ETB for a new user's first independently verified purchase. No reward for signing up alone.</p>
        {open&&methods.length>0&&<button type="button" className="btn btn-secondary" onClick={()=>{setChosen(plan.key);setCheckout(null)}} disabled={busy}>Choose {plan.name}</button>}
      </article>)}
    </div>
    {!open&&<p role="status" className="field-hint">Payment collection is currently closed. Do not transfer money until MELA provides an order with a verified receiving account.</p>}
    {open&&chosen&&methods.length>0&&!checkout&&<div>
      <label htmlFor="mela-plan-method">Payment method</label>
      <select id="mela-plan-method" value={method} onChange={e=>setMethod(e.target.value)}>
        <option value="">Select receiving institution</option>
        {methods.map(m=><option key={m.method_code} value={m.method_code}>{m.institution_name}</option>)}
      </select>{' '}
      <button type="button" className="btn btn-primary" disabled={!method||busy} onClick={()=>void start()}>Create my payment order</button>
    </div>}
    {checkout&&<div className="list-panel" aria-live="polite">
      <h3>Your payment order</h3>
      <p>Amount: <strong>{checkout.amount_etb} ETB</strong>. Receiving account: <strong>{checkout.recipient}</strong> ({checkout.method}). Verify the recipient in your own banking app before transferring.</p>
      <label htmlFor="mela-transfer-ref">Actual bank transaction reference</label>
      <input id="mela-transfer-ref" value={reference} maxLength={64} onChange={e=>setReference(e.target.value)} placeholder="Enter reference after transferring" />
      <p className="field-hint">Entering a reference is not proof of payment. Do not share a PIN, password, or one-time code.</p>
      <button type="button" className="btn btn-primary" disabled={busy||reference.trim().length<6} onClick={()=>void submit()}>Submit for manual verification</button>
    </div>}
    {orders.length>0&&<div><h3>Recent payment orders</h3>
      <ul>{orders.map(order=><li key={order.id}>{order.plan_key==='pro_monthly'?'Pro':'Premium'} · {order.amount_minor/100} ETB — {statusLabels[order.status]??order.status}</li>)}</ul>
    </div>}
    {error&&<p role="alert">{error}</p>}
    {message&&<p role="status">{message}</p>}
    {open&&<button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>void refresh().catch(e=>setError(e instanceof Error?e.message:'Cannot refresh orders'))}>Refresh order status</button>}
  </section>
}
