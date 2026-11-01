import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

// This page is not a payment processor. All order amounts, accounts and
// entitlements are set and checked by the server. References are not receipts.
type Plan = { id:string; plan_key:string; name:string; tier:string; price_minor:number; currency:string; billing_period_days:number|null }
type Subscription = { status:string; starts_at:string|null; expires_at:string|null; plan_id:string }
type Referral = { registered_user_id:string }
type Commission = { registered_user_id:string|null; amount:number; status:string }
type PaymentProduct = { id:string; title:string; amount_minor:number; currency:string }
type PaymentAccount = { id:string; provider:string; recipient:string; label:string }
type Order = { id:string; amount_minor:number; status:string; provider:string; recipient:string; reference:string|null; reason:string|null }
type Catalog = { enabled:boolean; products:PaymentProduct[]; accounts:PaymentAccount[] }
const emptyCatalog:Catalog={enabled:false,products:[],accounts:[]}

function messageOf(error:unknown):string {
  return error instanceof Error ? error.message : 'This service could not be loaded. Try again.'
}
function validPlan(p:Plan) {
  return (p.plan_key==='normal_monthly' || p.plan_key==='pro_monthly' || p.plan_key==='premium_monthly')
    && p.currency==='ETB' && (p.price_minor===5000 || p.price_minor===10000)
}
function money(amount:number) {return (amount/100).toFixed(0)+' ETB'}

export default function MembershipAndReferrals({ userId }:{userId:string}) {
  const [plans,setPlans]=useState<Plan[]>([])
  const [subscriptions,setSubscriptions]=useState<Subscription[]>([])
  const [referralCode,setReferralCode]=useState('')
  const [referralCount,setReferralCount]=useState(0)
  const [commissions,setCommissions]=useState<Commission[]>([])
  const [catalog,setCatalog]=useState<Catalog>(emptyCatalog)
  const [orders,setOrders]=useState<Order[]>([])
  const [planKey,setPlanKey]=useState('')
  const [accountId,setAccountId]=useState('')
  const [reference,setReference]=useState('')
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [busy,setBusy]=useState(false)
  const [revision,setRevision]=useState(0)
  const [loaded,setLoaded]=useState(false)

  const reload=useCallback(()=>setRevision(n=>n+1),[])
  useEffect(()=>{
    let active=true
    async function load(){
      setError('');setLoaded(false)
      try{
        const [p,s,c,r,com,cat,ord]=await Promise.all([
          supabase.from('subscription_plans').select('id,plan_key,name,tier,price_minor,currency,billing_period_days').eq('active',true),
          supabase.from('user_subscriptions').select('status,starts_at,expires_at,plan_id').eq('user_id',userId),
          supabase.from('referral_codes').select('code').eq('owner_user_id',userId).eq('active',true).limit(1).maybeSingle(),
          supabase.from('registration_referrals').select('registered_user_id').eq('inviter_user_id',userId),
          supabase.from('invitation_commissions').select('registered_user_id,amount,status').eq('inviter_user_id',userId),
          supabase.rpc('payment_command_v1',{p_action:'catalog',p_data:{}}),
          supabase.rpc('payment_command_v1',{p_action:'my_orders',p_data:{}}),
        ])
        if(!active)return
        for(const result of [p,s,c,r,com])if(result.error)throw result.error
        setPlans(((p.data??[]) as Plan[]).filter(validPlan).sort((a,b)=>a.price_minor-b.price_minor))
        setSubscriptions((s.data??[]) as Subscription[])
        setReferralCode(c.data?.code??'')
        setReferralCount(((r.data??[]) as Referral[]).length)
        setCommissions((com.data??[]) as Commission[])
        // Fail closed on a catalog error or malformed financial response.
        const raw=(!cat.error && cat.data && typeof cat.data==='object')?cat.data as Partial<Catalog>:null
        setCatalog(raw && raw.enabled===true && Array.isArray(raw.products) && Array.isArray(raw.accounts)
          ? {enabled:true,products:raw.products,accounts:raw.accounts}:emptyCatalog)
        setOrders(!ord.error && Array.isArray(ord.data)?ord.data as Order[]:[])
      }catch(e){if(active){setError(messageOf(e));setCatalog(emptyCatalog)}}
      finally{if(active)setLoaded(true)}
    }
    void load()
    return()=>{active=false}
  },[userId,revision])

  const selected=plans.find(p=>p.plan_key===planKey)
  const eligibleProduct=selected && catalog.enabled
    ? catalog.products.find(p=>p.amount_minor===selected.price_minor && p.currency==='ETB' &&
       (selected.price_minor===5000 ? /\bpro\b/i.test(p.title) : /\bpremium\b/i.test(p.title)))
    : undefined
  const account=catalog.accounts.find(a=>a.id===accountId)
  const openOrder=orders.find(o=>o.status==='awaiting_payment'||o.status==='pending')
  const referralUrl=referralCode ? `${window.location.origin}${import.meta.env.BASE_URL}?ref=${encodeURIComponent(referralCode)}`:''
  const commissionTotal=useMemo(()=>commissions.filter(c=>c.status==='paid').reduce((sum,c)=>sum+Number(c.amount||0),0),[commissions])
  const pendingTotal=useMemo(()=>commissions.filter(c=>c.status==='pending').reduce((sum,c)=>sum+Number(c.amount||0),0),[commissions])

  const createOrder=async()=>{
    if(!selected || !eligibleProduct || !account || !catalog.enabled)return
    setBusy(true);setError('');setNotice('')
    try{
      const {data,error}=await supabase.rpc('payment_command_v1',{p_action:'create_order',p_data:{product_id:eligibleProduct.id,account_id:account.id}})
      if(error)throw error
      if(!data?.id || data.amount_minor!==selected.price_minor || data.currency!=='ETB' || data.recipient!==account.recipient)
        throw new Error('The order was not confirmed with the correct amount and recipient. Do not transfer money.')
      setNotice('Order created. Pay only the exact server-confirmed amount and recipient shown in your order, then submit the reference.')
      reload()
    }catch(e){setError(messageOf(e))}
    finally{setBusy(false)}
  }

  const submitReference=async()=>{
    if(!openOrder || !/^[A-Za-z0-9][A-Za-z0-9-]{5,63}$/.test(reference.trim())){setError('Enter the actual 6–64 character transfer reference.');return}
    setBusy(true);setError('');setNotice('')
    try{
      const {data,error}=await supabase.rpc('payment_command_v1',{p_action:'submit',p_data:{order_id:openOrder.id,reference:reference.trim().toUpperCase()}})
      if(error)throw error
      if(!data || !['pending','awaiting_payment'].includes(data.status))throw new Error('The submission was not recorded as pending.')
      setReference('')
      setNotice('Reference received for independent review. No subscription or commission has been activated.')
      reload()
    }catch(e){setError(messageOf(e))}
    finally{setBusy(false)}
  }
  const copyReferral=async()=>{
    if(!referralUrl)return
    try{await navigator.clipboard.writeText(referralUrl);setNotice('Invitation link copied. You earn nothing for registration alone.')}catch{setError('Copy unavailable. Long-press the invitation link to copy it.')}
  }

  const activeSub=subscriptions.find(s=>['premium_active','pro_active'].includes(s.status)&&(!s.expires_at||new Date(s.expires_at)>new Date()))
  const activePlan=plans.find(p=>p.id===activeSub?.plan_id)

  return <section className="list-panel" aria-label="Plans, payments and referrals">
    <h2>My subscription and invitations</h2>
    {!loaded&&<p role="status">Checking your private MELA membership…</p>}
    {error&&<div className="banner banner-error" role="alert">{error}</div>}
    {notice&&<div className="banner banner-info" role="status">{notice}</div>}
    <p><strong>Current membership:</strong> {activePlan?.name??'Free Core'} {activeSub?.expires_at?`(until ${new Date(activeSub.expires_at).toLocaleDateString()})`:''}</p>
    <p>Core learning stays free. Paid subscriptions are never activated just because a reference was submitted.</p>
    <h3>Choose a plan</h3>
    <div className="module-grid">
      <div className="module-card"><strong>Free Core</strong><p>0 ETB · Foundational education</p><span className="field-hint">Always available without payment.</span></div>
      {plans.map(p=><div className="module-card" key={p.id}>
        <strong>{p.name}</strong><p>{money(p.price_minor)} / {p.billing_period_days??30} days</p>
        <button type="button" className="btn btn-secondary" aria-pressed={planKey===p.plan_key} onClick={()=>setPlanKey(p.plan_key)}>Select {p.name}</button>
      </div>)}
    </div>
    {selected&&<div className="list-panel" aria-label="Selected membership plan">
      <p><strong>Selected:</strong> {selected.name} — {money(selected.price_minor)}. Selection alone is not a purchase.</p>
      {(!catalog.enabled || !eligibleProduct || !catalog.accounts.length)
        ? <p className="banner banner-info" role="status">Subscription checkout is not open yet. Do not transfer money for this plan. Your free membership stays available.</p>
        : <>
          <label htmlFor="membership-account">Receiving account</label>
          <select id="membership-account" value={accountId} onChange={e=>setAccountId(e.target.value)}>
            <option value="">Choose a payment method</option>
            {catalog.accounts.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
          <button className="btn btn-primary" type="button" disabled={busy||!account||!!openOrder} onClick={()=>void createOrder()}>Create verified {selected.name} order</button>
        </>
      }
    </div>}
    <h3>My payment orders</h3>
    {!orders.length?<p>No subscription orders yet.</p>:<ul>{orders.map(o=><li key={o.id}>
      {money(o.amount_minor)} · {o.status} · {o.provider} · {o.recipient} {o.reason&&<small>{o.reason}</small>}
    </li>)}</ul>}
    {openOrder&&<div className="field">
      <label htmlFor="membership-reference">Transfer reference for pending order</label>
      <input id="membership-reference" value={reference} onChange={e=>setReference(e.target.value)} maxLength={64} placeholder="Actual transfer reference" />
      <button className="btn btn-secondary" type="button" disabled={busy} onClick={()=>void submitReference()}>Submit reference for review</button>
      <p className="field-hint">A bank or Telebirr receipt must be independently matched by a verified reviewer before any paid access or referral reward is activated.</p>
    </div>}
    <h3>Invite friends</h3>
    {referralUrl?<div className="field"><label htmlFor="my-mela-referral">My personal referral link</label>
      <input id="my-mela-referral" readOnly value={referralUrl} onFocus={e=>e.currentTarget.select()} />
      <button className="btn btn-secondary" type="button" onClick={()=>void copyReferral()}>Copy invitation link</button>
    </div>:<p>Your private referral code is not yet available. Contact MELA support if it does not appear.</p>}
    <p><strong>Invited registrations:</strong> {referralCount} · <strong>Pending commission:</strong> {pendingTotal.toFixed(0)} ETB · <strong>Recorded paid:</strong> {commissionTotal.toFixed(0)} ETB</p>
    <p className="field-hint">The planned first-payment reward is 20 ETB for Pro and 40 ETB for Premium. Only an independently verified first paid subscription can make a referral eligible. No reward is granted for registration alone; payouts require actual outgoing-transfer evidence.</p>
    <button type="button" className="btn btn-secondary" onClick={reload} disabled={busy}>Refresh membership and referrals</button>
  </section>
}
