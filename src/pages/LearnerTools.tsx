import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

import { saveTransitionStep, type TransitionStepStatus } from '../lib/transition-plan'
import { learnerRoute } from '../lib/learner-routes'
import { VIEW_LABELS, type StudentView } from '../hooks/useStudentNavigation'
import { useI18n } from '../i18n'
import { goalOptionsForStage } from '../lib/transition-goals'

type ToolView = 'mastery' | 'graph' | 'next' | 'wallet'

export default function LearnerTools({ view, onBack, onNavigate }: { view: ToolView; onBack: () => void; onNavigate?: (view: StudentView) => void }) {
  const { t } = useI18n()
  const [savingStep, setSavingStep] = useState<string | null>(null)
  const [careerPath, setCareerPath] = useState('')
  const [replaceConfirmed, setReplaceConfirmed] = useState(false)
  const [notice, setNotice] = useState('')
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
      else if (!data || typeof data !== 'object') setError('This section returned no data. Please retry.')
      else setData(data)
    }).catch(() => { if (active) setError('Could not connect. Please retry.') })
    return () => { active = false }
  }, [view, revision])

  const saveGoal = async () => {
    if (!goalTitle.trim() || !selectedGoalType || saving.current) return
    if (data?.active_plan && !replaceConfirmed) { setError('Confirm that you want to replace your active goal.'); return }
    saving.current = true
    setBusy(true); setError('')
    try {
      const { error } = await supabase.rpc('set_my_mela_next_goal', {
        p_goal_type: selectedGoalType, p_goal_title: goalTitle.trim(),
        p_career_path_id: selectedGoalType === 'career_path' ? careerPath || null : null, p_target_date: targetDate || null,
      })
      if (error) throw error
      setGoalTitle(''); setTargetDate(''); setCareerPath(''); setReplaceConfirmed(false); setNotice('Your goal and transition plan have been saved.')
      setRevision(value => value + 1)
    } catch (cause: any) { setError(cause?.message ?? 'Could not save your goal. Please retry.') }
    finally { saving.current = false; setBusy(false) }
  }

  const updateStep = async (stepId: string, status: TransitionStepStatus) => {
    if (saving.current || !data?.active_plan?.id) return
    saving.current = true; setSavingStep(stepId); setError(''); setNotice('')
    try {
      const saved = await saveTransitionStep(data.active_plan.id, stepId, status)
      setData((previous: any) => ({ ...previous, steps: previous.steps.map((step: any) => step.id === stepId ? { ...step, ...saved } : step) }))
      setNotice('Plan progress saved.')
    } catch (cause: any) { setError(cause?.message ?? 'Could not save step progress. Please retry.') }
    finally { saving.current = false; setSavingStep(null) }
  }

  if (error && !data) return <div className="dash-main"><div className="section-heading"><h1>{title(view)}</h1><button className="btn btn-secondary" onClick={onBack}>Back</button></div><div className="banner banner-error" role="alert">{error}</div><button className="btn btn-primary" onClick={() => setRevision(value => value + 1)}>Retry</button></div>
  if (!data) return <div className="centered-loading">Loading {title(view)}…</div>

  if (view === 'mastery') return <Mastery data={data} onBack={onBack} onNavigate={onNavigate} />
  if (view === 'graph') return <Graph data={data} onBack={onBack} onNavigate={onNavigate} />
  if (view === 'wallet') return <Wallet data={data} onBack={onBack} />

  const plan = data.active_plan
  const steps = data.steps ?? []
  return <div className="dash-main">
    <div className="section-heading"><h1>{t('melaNext')}</h1><button className="btn btn-secondary" disabled={busy || savingStep !== null} onClick={onBack}>Back</button></div>
    <p className="muted">Your next education, career or transition steps, based on your current mastery and opportunity map.</p>
    {plan && <p>Track your own plan progress here. Verified skills and credentials are earned through learning and assessment.</p>}
    {plan ? <div className="list-panel">
      <div className="list-row"><div><div className="list-row-title">{plan.title ?? plan.goal_title ?? 'Active transition plan'}</div><div className="list-row-meta">{plan.status ?? 'active'}{plan.target_date ? ` · Target ${plan.target_date}` : ''}</div></div></div>
      {steps.length ? steps.map((s:any) => <div className="list-row" key={s.id}><div><div className="list-row-title">{s.title}</div><div className="list-row-meta">{(s.status ?? 'not_started').replaceAll('_', ' ')}{s.due_date ? ` · Due ${s.due_date}` : ''}</div>{s.description && <p>{s.description}</p>}<RouteAction route={s.route_key} onNavigate={busy || savingStep !== null ? undefined : onNavigate} /><div className="field"><label htmlFor={`step-${s.id}`}>Step progress: {s.title}</label><select id={`step-${s.id}`} value={s.status ?? 'not_started'} disabled={busy || savingStep !== null} onChange={e => void updateStep(s.id, e.target.value as TransitionStepStatus)}><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="skipped">Skipped</option></select>{savingStep === s.id && <p role="status">Saving step…</p>}</div></div></div>) : <div className="empty-panel">Your plan has no steps yet.</div>}
    </div> : <div className="empty-panel">You do not have an active transition plan yet. Set your first goal below.</div>}
    {notice && <p role="status">{notice}</p>}
    <div className="section-heading"><h2>Set a goal</h2></div>
    {error && <div className="banner banner-error" role="alert">{error}</div>}
    {!goalOptions.length && <p role="status">Complete your learner education stage before setting a goal.</p>}
    <div className="field"><label htmlFor="goal-title">Goal</label><input id="goal-title" value={goalTitle} onChange={e=>setGoalTitle(e.target.value)} placeholder="e.g. Prepare for university admission" /></div>
    <div className="field"><label htmlFor="goal-type">Goal type</label><select id="goal-type" disabled={busy || !goalOptions.length} value={selectedGoalType} onChange={e=>setGoalType(e.target.value)}>{goalOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
    {selectedGoalType === 'career_path' && <div className="field"><label htmlFor="career-path">Career pathway</label><select id="career-path" value={careerPath} disabled={busy} onChange={e => setCareerPath(e.target.value)}><option value="">Explore all pathways</option>{(data.career_paths ?? []).map((path: any) => <option key={path.id} value={path.id}>{path.title}</option>)}</select>{careerPath && <p>{data.career_paths?.find((path: any) => path.id === careerPath)?.description}</p>}</div>}
    {plan && <label><input type="checkbox" checked={replaceConfirmed} disabled={busy} onChange={e => setReplaceConfirmed(e.target.checked)} /> Replace my active goal and archive its current plan</label>}
    <div className="field"><label htmlFor="goal-date">Target date</label><input id="goal-date" type="date" value={targetDate} onChange={e=>setTargetDate(e.target.value)} /></div>
    <button className="btn btn-primary" onClick={saveGoal} disabled={busy || savingStep !== null || !goalTitle.trim() || !selectedGoalType || (!!plan && !replaceConfirmed)}>{busy ? 'Saving…' : 'Save goal'}</button>
  </div>
}

function title(v: ToolView) { return v === 'mastery' ? 'My Mastery Map' : v === 'graph' ? 'My Future Map' : v === 'next' ? 'Mela Next' : 'Mela Wallet' }

function RouteAction({ route, onNavigate }: { route: unknown; onNavigate?: (view: StudentView) => void }) {
  const view = learnerRoute(route)
  if (!view || !onNavigate) return null
  return <button className="btn btn-secondary" onClick={() => onNavigate(view)}>Open {VIEW_LABELS[view]}</button>
}

function Mastery({ data, onBack, onNavigate }: { data: any; onBack: () => void; onNavigate?: (view: StudentView) => void }) {
 const { t } = useI18n()
 const [query, setQuery] = useState(''), [domain, setDomain] = useState(''), [level, setLevel] = useState('')
 const competencies: any[] = data.competencies ?? []
 const filtered = competencies.filter(x => (!domain || x.domain_key === domain) && (!level || x.mastery_level === level) && `${x.title} ${x.description ?? ''} ${x.domain_title}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
 return <div className="dash-main"><div className="section-heading"><h1>{t('masteryMap')}</h1><button className="btn btn-secondary" onClick={onBack}>{t('back')}</button></div>
 <div className="stat-strip"><div><span className="stat-value">{data.overall_score ?? 0}</span><span className="stat-label">Overall mastery</span></div><div><span className="stat-value">{data.mastered_count ?? 0}</span><span className="stat-label">Mastered</span></div><div><span className="stat-value">{data.competency_count ?? competencies.length}</span><span className="stat-label">Competencies</span></div></div>
 <div className="section-heading"><h2>Next to learn</h2></div><div className="list-panel">{(data.next_to_learn ?? []).length ? data.next_to_learn.map((x:any)=><div className="list-row" key={x.id}><div><div className="list-row-title">{x.title}</div><div className="list-row-meta">{x.domain} · {x.level?.replaceAll('_', ' ')}</div></div><span className="pill">{x.score ?? 0}</span></div>) : <div className="empty-panel">No mastery gaps have been recorded yet.</div>}</div>
 <RouteAction route="practice" onNavigate={onNavigate} /><RouteAction route="assessments" onNavigate={onNavigate} />
 <div className="section-heading"><h2>Domains</h2></div><div className="list-panel">{(data.domains ?? []).length ? data.domains.map((d:any)=><div className="list-row" key={d.domain_key}><div><div className="list-row-title">{d.domain_title}</div><p>{d.mastered ?? 0} mastered · {d.needs_growth ?? 0} need growth · {d.competencies ?? 0} competencies</p></div><span className="pill">{d.score}</span></div>) : <p className="empty-panel">No domains are available for your education stage yet.</p>}</div>
 <div className="section-heading"><h2>All competencies</h2></div>
 <div className="field"><label htmlFor="competency-search">Search competencies</label><input id="competency-search" type="search" value={query} onChange={e => setQuery(e.target.value)} /></div>
 <div className="field"><label htmlFor="competency-domain">Domain</label><select id="competency-domain" value={domain} onChange={e => setDomain(e.target.value)}><option value="">All domains</option>{(data.domains ?? []).map((d:any) => <option key={d.domain_key} value={d.domain_key}>{d.domain_title}</option>)}</select></div>
 <div className="field"><label htmlFor="competency-level">Mastery level</label><select id="competency-level" value={level} onChange={e => setLevel(e.target.value)}><option value="">All levels</option>{Array.from(new Set(competencies.map(x => x.mastery_level).filter(Boolean))).map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></div>
 <p role="status">Showing {filtered.length} of {competencies.length} competencies</p>
 <div className="list-panel">{filtered.map(x => <div className="list-row" key={x.id}><div><h3>{x.title}</h3><p>{x.description}</p><p>{x.domain_title} · {x.mastery_level?.replaceAll('_', ' ')} · Score {x.mastery_score ?? 0}</p><p>{x.evidence_count ?? 0} evidence records · {x.verified_evidence_count ?? 0} verified</p>{x.last_evidence_at && <p>Last evidence: {new Date(x.last_evidence_at).toLocaleDateString()}</p>}</div></div>)}</div>
 {!filtered.length && <p className="empty-panel">{competencies.length ? 'No competencies match these filters.' : 'No competencies have been published for your education stage yet.'}</p>}
 </div>
}

function Graph({ data, onBack, onNavigate }: { data: any; onBack: () => void; onNavigate?: (view: StudentView) => void }) {
 const { t } = useI18n()
 const [query, setQuery] = useState(''), [type, setType] = useState('')
 const nodes: any[] = data.nodes ?? []
 const filtered = nodes.filter(n => (!type || n.node_type === type) && `${n.title} ${n.description ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
 const byId = new Map(nodes.map(n => [n.id, n]))
 return <div className="dash-main"><div className="section-heading"><h1>{t('futureMap')}</h1><button className="btn btn-secondary" onClick={onBack}>{t('back')}</button></div>
 <p className="muted">Your learning stage connected to education and career pathways.</p>
 <div className="stat-strip"><div><span className="stat-value">{data.real_opportunities?.open ?? 0}</span><span className="stat-label">Open opportunities</span></div><div><span className="stat-value">{data.real_opportunities?.scholarships ?? 0}</span><span className="stat-label">Scholarships</span></div><div><span className="stat-value">{nodes.length}</span><span className="stat-label">Pathways</span></div></div>
 <RouteAction route="opportunities" onNavigate={onNavigate} /><RouteAction route="scholarships" onNavigate={onNavigate} /><RouteAction route="mela-next" onNavigate={onNavigate} />
 <div className="field"><label htmlFor="pathway-search">Search pathways</label><input id="pathway-search" type="search" value={query} onChange={e => setQuery(e.target.value)} /></div>
 <div className="field"><label htmlFor="pathway-type">Pathway type</label><select id="pathway-type" value={type} onChange={e => setType(e.target.value)}><option value="">All types</option>{Array.from(new Set(nodes.map(n => n.node_type))).map(value => <option key={value} value={value}>{value?.replaceAll('_', ' ')}</option>)}</select></div>
 <p role="status">Showing {filtered.length} of {nodes.length} pathways</p>
 <div className="list-panel">{filtered.map(n => <div className="list-row" key={n.id}><div><h3>{n.title}</h3><p>{n.node_type?.replaceAll('_', ' ')}</p><p>{n.description}</p><RouteAction route={n.route_key} onNavigate={onNavigate} />
 {(data.edges ?? []).filter((e:any) => e.from === n.id).map((e:any, i:number) => <div key={`${e.to}-${i}`}><p><strong>{e.relationship?.replaceAll('_', ' ') ?? 'Connects to'}: {byId.get(e.to)?.title ?? 'Pathway'}</strong></p>{e.rationale && <p>{e.rationale}</p>}<RouteAction route={byId.get(e.to)?.route_key} onNavigate={onNavigate} /></div>)}
 </div></div>)}</div>
 {!filtered.length && <div className="empty-panel">{nodes.length ? 'No pathways match these filters.' : 'No pathways have been published for your education stage yet.'}</div>}
 </div>
}

function Wallet({data,onBack}:{data:any;onBack:()=>void}) {
 return <div className="dash-main"><div className="section-heading"><h1>Mela Wallet</h1><button className="btn btn-secondary" onClick={onBack}>Back</button></div>
 <div className="stat-strip"><div><span className="stat-value">{data.available_balance ?? 0}</span><span className="stat-label">Available ETB</span></div><div><span className="stat-value">{data.pending_earnings ?? 0}</span><span className="stat-label">Pending</span></div><div><span className="stat-value">{data.paid_out ?? 0}</span><span className="stat-label">Paid out</span></div><div><span className="stat-value">{data.lifetime_earned ?? 0}</span><span className="stat-label">Lifetime</span></div></div>
 {data.payouts_enabled ? <div className="banner banner-info">Payouts are enabled for this account.</div> : <div className="banner banner-info">Payout initiation is currently disabled while payout readiness gates are completed.</div>}
 <div className="section-heading"><h2>Recent earnings</h2></div><div className="list-panel">{(data.recent_ledger ?? []).length ? data.recent_ledger.map((x:any)=><div className="list-row" key={x.id}><div><div className="list-row-title">{x.source_type}</div><div className="list-row-meta">{x.status} · {x.occurred_at ? new Date(x.occurred_at).toLocaleDateString() : ''}</div></div><span className="pill">{x.net_amount} {x.currency}</span></div>) : <div className="empty-panel">No earnings have been recorded yet.</div>}</div>
 </div>
}
