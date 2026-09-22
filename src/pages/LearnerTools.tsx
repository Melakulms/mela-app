import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type ToolView = 'mastery' | 'graph' | 'next' | 'wallet'

export default function LearnerTools({ view, onBack }: { view: ToolView; onBack: () => void }) {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const [goalTitle, setGoalTitle] = useState('')
  const [goalType, setGoalType] = useState('education')
  const [targetDate, setTargetDate] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setData(null); setError('')
    const rpc = view === 'mastery' ? 'get_my_mastery_engine'
      : view === 'graph' ? 'get_my_opportunity_graph'
      : view === 'next' ? 'get_my_mela_next'
      : 'get_my_wallet'
    supabase.rpc(rpc).then(({ data, error }) => {
      if (error) setError(error.message)
      else setData(data)
    })
  }, [view])

  const saveGoal = async () => {
    if (!goalTitle.trim()) return
    setBusy(true); setError('')
    const { error } = await supabase.rpc('set_my_mela_next_goal', {
      p_goal_type: goalType,
      p_goal_title: goalTitle.trim(),
      p_career_path_id: null,
      p_target_date: targetDate || null,
    })
    setBusy(false)
    if (error) setError(error.message)
    else {
      setGoalTitle('')
      const { data } = await supabase.rpc('get_my_mela_next')
      setData(data)
    }
  }

  if (error) return <div className="dash-main"><div className="section-heading"><h1>{title(view)}</h1><button className="btn btn-secondary" onClick={onBack}>Back</button></div><div className="banner banner-error">{error}</div></div>
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
    <div className="field"><label>Goal</label><input value={goalTitle} onChange={e=>setGoalTitle(e.target.value)} placeholder="e.g. Prepare for university admission" /></div>
    <div className="field"><label>Goal type</label><select value={goalType} onChange={e=>setGoalType(e.target.value)}><option value="education">Education</option><option value="career">Career</option><option value="skills">Skills</option><option value="entrepreneurship">Entrepreneurship</option></select></div>
    <div className="field"><label>Target date</label><input type="date" value={targetDate} onChange={e=>setTargetDate(e.target.value)} /></div>
    <button className="btn btn-primary" onClick={saveGoal} disabled={busy || !goalTitle.trim()}>{busy ? 'Saving…' : 'Save goal'}</button>
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
