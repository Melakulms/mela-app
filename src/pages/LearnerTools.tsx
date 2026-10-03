import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

import { goalOptionsForStage } from '../lib/transition-goals'

type ToolView = 'mastery' | 'graph' | 'next' | 'wallet'

export default function LearnerTools({ view, onBack }: { view: ToolView; onBack: () => void }) {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const [goalTitle, setGoalTitle] = useState('')
  const [goalType, setGoalType] = useState('')
  const saving = useRef(false)
  const goalOptions = goalOptionsForStage(data?.audience?.stage_key)
  const selectedGoalType = goalOptions.some(option => option.value === goalType) ? goalType : goalOptions[0]?.value ?? ''
  const [targetDate, setTargetDate] = useState('')
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    setData(null); setError('')
    const rpc = view === 'mastery' ? 'get_my_mastery_engine'
      : view === 'graph' ? 'get_my_opportunity_graph'
      : view === 'next' ? 'get_my_mela_next'
      : 'get_my_wallet'
    Promise.resolve(supabase.rpc(rpc)).then(({ data, error }) => {
      if (!active) return
      if (error) setError(error.message)
      else setData(data)
    }).catch(() => { if (active) setError('Could not connect. Please retry.') })
    return () => { active = false }
  }, [view, revision])

  const saveGoal = async () => {
    if (!goalTitle.trim() || !selectedGoalType || saving.current) return
    saving.current = true
    setBusy(true); setError('')
    try {
      const { error } = await supabase.rpc('set_my_mela_next_goal', {
        p_goal_type: selectedGoalType, p_goal_title: goalTitle.trim(),
        p_career_path_id: null, p_target_date: targetDate || null,
      })
      if (error) throw error
      setGoalTitle('')
      setRevision(value => value + 1)
    } catch (cause: any) { setError(cause?.message ?? 'Could not save your goal. Please retry.') }
    finally { saving.current = false; setBusy(false) }
  }

  if (error && !data) return <div className="dash-main"><div className="section-heading"><h1>{title(view)}</h1><button className="btn btn-secondary" onClick={onBack}>Back</button></div><div className="banner banner-error" role="alert">{error}</div><button className="btn btn-primary" onClick={() => setRevision(value => value + 1)}>Retry</button></div>
  if (!data) return <div className="centered-loading">Loading {title(view)}…</div>

  if (view === 'mastery') return <Mastery data={data} onBack={onBack} />
  if (view === 'graph') return <Graph data={data} onBack={onBack} />
  if (view === 'wallet') return <Wallet data={data} onBack={onBack} />

  const plan = data.active_plan
  const steps = data.steps ?? []
  return <div className="dash-main">
    <div className="section-heading"><h1>Mela Next</h1><button className="btn btn-secondary" onClick={onBack}>Back</button></div>
    <p className="muted">Your next education, career or transition steps, based on your current mastery and opportunity map.</p>
    {plan ? <div className="list-panel">
      <div className="list-row"><div><div className="list-row-title">{plan.title ?? plan.goal_title ?? 'Active transition plan'}</div><div className="list-row-meta">{plan.status ?? 'active'}</div></div></div>
      {steps.length ? steps.map((s:any) => <div className="list-row" key={s.id}><div><div className="list-row-title">{s.title}</div><div className="list-row-meta">{s.status ?? 'planned'}{s.target_date ? ` · ${s.target_date}` : ''}</div></div></div>) : <div className="empty-panel">Your plan has no steps yet.</div>}
    </div> : <div className="empty-panel">You do not have an active transition plan yet. Set your first goal below.</div>}
    <div className="section-heading"><h2>Set a goal</h2></div>
    {error && <div className="banner banner-error">{error}</div>}
    {!goalOptions.length && <p role="status">Complete your learner education stage before setting a goal.</p>}
    <div className="field"><label htmlFor="goal-title">Goal</label><input id="goal-title" value={goalTitle} onChange={e=>setGoalTitle(e.target.value)} placeholder="e.g. Prepare for university admission" /></div>
    <div className="field"><label htmlFor="goal-type">Goal type</label><select id="goal-type" disabled={busy || !goalOptions.length} value={selectedGoalType} onChange={e=>setGoalType(e.target.value)}>{goalOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
    <div className="field"><label htmlFor="goal-date">Target date</label><input id="goal-date" type="date" value={targetDate} onChange={e=>setTargetDate(e.target.value)} /></div>
    <button className="btn btn-primary" onClick={saveGoal} disabled={busy || !goalTitle.trim() || !selectedGoalType}>{busy ? 'Saving…' : 'Save goal'}</button>
  </div>
}

function title(v: ToolView) { return v === 'mastery' ? 'My Mastery Map' : v === 'graph' ? 'My Future Map' : v === 'next' ? 'Mela Next' : 'Mela Wallet' }

function Mastery({data,onBack}:{data:any;onBack:()=>void}) {
 return <div className="dash-main"><div className="section-heading"><h1>My Mastery Map</h1><button className="btn btn-secondary" onClick={onBack}>Back</button></div>
 <div className="stat-strip"><div><span className="stat-value">{data.overall_score ?? 0}</span><span className="stat-label">Overall mastery</span></div><div><span className="stat-value">{data.mastered_count ?? 0}</span><span className="stat-label">Mastered</span></div><div><span className="stat-value">{data.competency_count ?? 0}</span><span className="stat-label">Competencies</span></div></div>
 <div className="section-heading"><h2>Next to learn</h2></div><div className="list-panel">{(data.next_to_learn ?? []).length ? data.next_to_learn.map((x:any)=><div className="list-row" key={x.id}><div><div className="list-row-title">{x.title}</div><div className="list-row-meta">{x.domain} · {x.level}</div></div><span className="pill">{x.score ?? 0}</span></div>) : <div className="empty-panel">No mastery gaps have been recorded yet.</div>}</div>
 <div className="section-heading"><h2>Domains</h2></div><div className="list-panel">{(data.domains ?? []).map((d:any)=><div className="list-row" key={d.domain_key}><div className="list-row-title">{d.domain_title}</div><span className="pill">{d.score}</span></div>)}</div>
 </div>
}

function Graph({data,onBack}:{data:any;onBack:()=>void}) {
 return <div className="dash-main"><div className="section-heading"><h1>My Future Map</h1><button className="btn btn-secondary" onClick={onBack}>Back</button></div>
 <p className="muted">Your learning stage connected to education and career pathways.</p>
 <div className="stat-strip"><div><span className="stat-value">{data.real_opportunities?.open ?? 0}</span><span className="stat-label">Open opportunities</span></div><div><span className="stat-value">{data.real_opportunities?.scholarships ?? 0}</span><span className="stat-label">Scholarships</span></div><div><span className="stat-value">{(data.nodes ?? []).length}</span><span className="stat-label">Map nodes</span></div></div>
 <div className="list-panel">{(data.nodes ?? []).map((n:any)=><div className="list-row" key={n.id}><div><div className="list-row-title">{n.title}</div><div className="list-row-meta">{n.node_type}{n.description ? ` · ${n.description}` : ''}</div></div>{n.route_key && <span className="pill">{n.route_key}</span>}</div>)}</div>
 </div>
}

function Wallet({data,onBack}:{data:any;onBack:()=>void}) {
 return <div className="dash-main"><div className="section-heading"><h1>Mela Wallet</h1><button className="btn btn-secondary" onClick={onBack}>Back</button></div>
 <div className="stat-strip"><div><span className="stat-value">{data.available_balance ?? 0}</span><span className="stat-label">Available ETB</span></div><div><span className="stat-value">{data.pending_earnings ?? 0}</span><span className="stat-label">Pending</span></div><div><span className="stat-value">{data.paid_out ?? 0}</span><span className="stat-label">Paid out</span></div><div><span className="stat-value">{data.lifetime_earned ?? 0}</span><span className="stat-label">Lifetime</span></div></div>
 {data.payouts_enabled ? <div className="banner banner-info">Payouts are enabled for this account.</div> : <div className="banner banner-info">Payout initiation is currently disabled while payout readiness gates are completed.</div>}
 <div className="section-heading"><h2>Recent earnings</h2></div><div className="list-panel">{(data.recent_ledger ?? []).length ? data.recent_ledger.map((x:any)=><div className="list-row" key={x.id}><div><div className="list-row-title">{x.source_type}</div><div className="list-row-meta">{x.status} · {x.occurred_at ? new Date(x.occurred_at).toLocaleDateString() : ''}</div></div><span className="pill">{x.net_amount} {x.currency}</span></div>) : <div className="empty-panel">No earnings have been recorded yet.</div>}</div>
 </div>
}
