import ContractDisputes from '../components/ContractDisputes'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

type View = 'challenges' | 'assessments' | 'earn'

export default function LearnerSubsections({ view, onBack }: { view: View; onBack: () => void }) {
  const [rows, setRows] = useState<any[]>([])
  const [mine, setMine] = useState<any[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any | null>(null)

  const load = async () => {
    setLoading(true); setError('')
    try {
      if (view === 'challenges') {
        const { data, error } = await supabase.from('sponsored_challenges')
          .select('id,sponsor_name,title,description,prize_amount_etb,starts_at,ends_at,status,challenge_type,team_mode')
          .in('status', ['published','active']).order('starts_at', { ascending: true })
        if (error) throw error
        setRows(data ?? [])
        const { data: cp, error: cpError } = await supabase.from('challenge_participants')
          .select('challenge_id,status,joined_at').order('joined_at', { ascending: false })
        if (cpError) throw cpError
        setMine(cp ?? [])
      } else if (view === 'assessments') {
        const { data, error } = await supabase.from('skill_assessments')
          .select('id,title,description,duration_minutes,pass_score,question_count,is_proctored,status,max_attempts,instructions')
          .eq('status', 'published').order('created_at', { ascending: false })
        if (error) throw error
        setRows(data ?? [])
        const { data: sr, error: srError } = await supabase.from('skill_assessment_results')
          .select('id,score,level,created_at').order('created_at', { ascending: false })
        if (srError) throw srError
        setMine(sr ?? [])
      } else {
        const { data, error } = await supabase.from('marketplace_tasks')
          .select('id,title,description,task_type,budget_amount,currency,reward_coins,deadline,status,skills_required')
          .in('status', ['open','published']).order('deadline', { ascending: true })
        if (error) throw error
        setRows(data ?? [])
        const { data: proposals, error: proposalError } = await supabase.from('marketplace_submissions')
          .select('id,task_id,status,proposed_amount,estimated_days,proposal_text,submitted_at')
          .order('submitted_at', { ascending: false })
        if (proposalError) throw proposalError
        setMine(proposals ?? [])
      }
    } catch (e: any) {
      setError(e.message ?? 'Could not load this section.')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [view])

  const title = view === 'challenges' ? 'Sponsored Challenges' : view === 'assessments' ? 'Verified Assessments' : 'Earn & Work'

  if (selected && view === 'challenges') return <ChallengeDetail challenge={selected} onBack={() => setSelected(null)} onChanged={load} />
  if (selected && view === 'assessments') return <AssessmentRunner assessment={selected} onBack={() => setSelected(null)} onChanged={load} />
  if (selected && view === 'earn') return <TaskDetail existing={mine.find(row => row.task_id === selected.id)} task={selected} onBack={() => setSelected(null)} onChanged={load} />

  return <div className="dash-main">
    <div className="section-heading"><h1>{title}</h1><button className="btn btn-secondary" onClick={onBack}>Back</button></div>
    {error && <div className="banner banner-error" role="alert">{error}<button className="btn btn-secondary" onClick={load} disabled={loading}>Retry</button></div>}
    {view === 'earn' && <ContractDisputes />}
    {loading ? <div className="centered-loading">Loading {title}…</div> : <>
      <div className="section-heading"><h2>{view === 'assessments' ? 'Published assessments' : view === 'challenges' ? 'Open challenges' : 'Available work'}</h2></div>
      {rows.length === 0 ? <div className="empty-panel">Nothing is available in this section right now. Check back after content is published.</div> :
        <div className="list-panel">{rows.map(x => {
          const joined = view === 'challenges' && mine.some(m => m.challenge_id === x.id)
          const proposed = view === 'earn' && mine.some(m => m.task_id === x.id)
          return <div className="list-row" key={x.id}>
            <div><div className="list-row-title">{x.title}</div>
              <div className="list-row-meta">
                {view === 'challenges' ? `${x.sponsor_name ?? 'MELA'} · ${x.challenge_type ?? 'challenge'} · ${x.prize_amount_etb ?? 0} ETB · ${x.status}`
                : view === 'assessments' ? `${x.question_count ?? 0} questions · ${x.duration_minutes ?? 0} min · pass ${x.pass_score ?? 0}%`
                : `${x.task_type ?? 'task'} · ${x.budget_amount ?? x.reward_coins ?? 0} ${x.currency ?? 'ETB'} · deadline ${x.deadline ?? '—'}`}
              </div>
              {x.description && <p className="muted">{x.description}</p>}
            </div>
            <button className="btn btn-primary" onClick={() => setSelected(x)}>
              {view === 'challenges' ? (joined ? 'View / Submit' : 'Join') : view === 'assessments' ? 'Start' : (proposed ? 'View proposal' : 'Apply')}
            </button>
          </div>
        })}</div>}
      {mine.length > 0 && <><div className="section-heading"><h2>{view === 'assessments' ? 'My results' : view === 'challenges' ? 'My challenge activity' : 'My proposals'}</h2></div>
        <div className="list-panel">{mine.map((x, i) => <div className="list-row" key={x.id ?? i}>
          <span className="list-row-title">{x.title ?? x.level ?? x.proposal_text?.slice(0, 60) ?? 'Activity'}</span>
          <span className="pill">{x.status ?? x.score ?? ''}</span>
        </div>)}</div></>}
    </>}
  </div>
}

function ChallengeDetail({ challenge, onBack, onChanged }: any) {
  const [joined, setJoined] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [title, setTitle] = useState(''), [text, setText] = useState(''), [url, setUrl] = useState('')
  const [success,setSuccess]=useState(''), [checking,setChecking]=useState(true), [revision,setRevision]=useState(0)
  const lock=useRef(false)
  useEffect(() => {
    let active=true;setChecking(true);setError('')
    void (async()=>{try{
      const {data:auth,error:authError}=await supabase.auth.getUser()
      if(authError)throw authError
      if(!auth.user)throw new Error('Please sign in again.')
      const {data,error}=await supabase.from('challenge_participants').select('challenge_id,status').eq('challenge_id',challenge.id).eq('user_id',auth.user.id).maybeSingle()
      if(error)throw error
      if(active)setJoined(!!data)
    }catch(cause:any){if(active)setError(cause?.message??'Could not check participation.')}
    finally{if(active)setChecking(false)}})()
    return()=>{active=false}
  },[challenge.id,revision])
  const join = async () => {
    if(lock.current||checking)return
    lock.current=true;setBusy(true);setError('')
    try{
      const {error}=await supabase.rpc('join_sponsored_challenge',{p_challenge_id:challenge.id})
      if(error)throw error
      setJoined(true);onChanged()
    }catch(cause:any){setError(cause?.message??'Could not join. Please retry.')}
    finally{lock.current=false;setBusy(false)}
  }
  const submit = async () => {
    if(lock.current||!title.trim()||!text.trim())return
    if(url.trim()) {try{if(!['https:','http:'].includes(new URL(url.trim()).protocol))throw new Error()}catch{setError('Enter a valid HTTP or HTTPS submission URL.');return}}
    lock.current=true;setBusy(true);setError('');setSuccess('')
    try{
      const {error}=await supabase.rpc('submit_challenge_entry',{p_challenge_id:challenge.id,p_title:title.trim(),p_submission_text:text.trim(),p_submission_url:url.trim()||null,p_attachment_path:null})
      if(error)throw error
      setTitle('');setText('');setUrl('');setSuccess('Your entry was submitted successfully.');onChanged()
    }catch(cause:any){setError(cause?.message??'Could not submit. Your entry is preserved for retry.')}
    finally{lock.current=false;setBusy(false)}
  }
  return <div className="dash-main"><div className="section-heading"><h1>{challenge.title}</h1><button className="btn btn-secondary" onClick={onBack}>Back</button></div>
    <p className="muted">{challenge.description}</p><div className="stat-strip"><div><span className="stat-value">{challenge.prize_amount_etb ?? 0}</span><span className="stat-label">Prize ETB</span></div><div><span className="stat-value">{challenge.team_mode ? 'Team' : 'Individual'}</span><span className="stat-label">Mode</span></div></div>
    {error && <div className="banner banner-error" role="alert">{error}<button className="btn btn-secondary" disabled={busy || checking} onClick={()=>setRevision(value=>value+1)}>Check participation again</button></div>}
    {success && <p role="status">{success}</p>}
    {checking ? <p role="status">Checking participation…</p> : !joined ? <button className="btn btn-primary" onClick={join} disabled={busy || checking}>{busy ? 'Joining…' : 'Join challenge'}</button> :
      <><div className="banner banner-info">You are participating. Submit your entry before the challenge closes.</div>
      <div className="field"><label>Submission title</label><input value={title} onChange={e => setTitle(e.target.value)} /></div>
      <div className="field"><label>Submission</label><textarea value={text} onChange={e => setText(e.target.value)} rows={6} /></div>
      <div className="field"><label>Optional URL</label><input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" /></div>
      <button className="btn btn-primary" onClick={submit} disabled={busy || !title.trim() || !text.trim()}>{busy ? 'Submitting…' : 'Submit entry'}</button></>}
  </div>
}

export function AssessmentRunner({ assessment, onBack, onChanged }: any) {
  const [attempt, setAttempt] = useState<any>(null), [questions, setQuestions] = useState<any[]>([]), [answers, setAnswers] = useState<Record<string, any>>({})
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const lock = useRef(false)
  const start = async () => {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      const { data: userData, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!userData.user) throw new Error('Please sign in again.')
      const { data: existing, error: attemptsError } = await supabase.from('assessment_attempts')
        .select('id,attempt_no,status').eq('assessment_id', assessment.id).eq('user_id', userData.user.id)
      if (attemptsError) throw attemptsError
      let current = (existing ?? []).find(row => row.status === 'in_progress')
      if (!current) {
        if ((existing ?? []).length >= Number(assessment.max_attempts ?? 1)) throw new Error('You have reached the maximum number of attempts for this assessment.')
        const { data, error } = await supabase.from('assessment_attempts').insert({assessment_id:assessment.id,user_id:userData.user.id}).select('id,attempt_no,status').single()
        if (error) throw error
        current = data
      }
      if (!current) throw new Error('The assessment attempt could not be opened.')
      const [q, saved] = await Promise.all([
        supabase.rpc('get_assessment_attempt_questions_localized', {p_attempt_id:current.id}),
        supabase.from('assessment_responses').select('question_id,response').eq('attempt_id',current.id),
      ])
      if (q.error) throw q.error
      if (saved.error) throw saved.error
      const rows = Array.isArray(q.data) ? q.data : q.data?.questions ?? []
      if (!rows.length) throw new Error('No assessment questions are available. Retry or contact support.')
      setAttempt(current); setQuestions(rows)
      setAnswers(Object.fromEntries((saved.data ?? []).map(row => [row.question_id,row.response])))
    } catch (cause: any) { setError(cause?.message ?? 'Could not open this assessment. Retry to resume your attempt.') }
    finally { lock.current = false; setBusy(false) }
  }
  const submit = async () => {
    if (!attempt || lock.current) return
    if (questions.some(q => answers[q.question_id ?? q.id] == null || String(answers[q.question_id ?? q.id]).trim() === '')) {
      setError('Answer every question before submitting.'); return
    }
    lock.current = true; setBusy(true); setError('')
    try {
      for (const [questionId, response] of Object.entries(answers)) {
        const { error } = await supabase.from('assessment_responses').upsert({attempt_id:attempt.id,question_id:questionId,response},{onConflict:'attempt_id,question_id'})
        if (error) throw error
      }
      const { data, error } = await supabase.from('assessment_attempts').update({status:'submitted',submitted_at:new Date().toISOString()})
        .eq('id',attempt.id).eq('status','in_progress').select('id').single()
      if (error) throw error
      if (!data) throw new Error('The attempt was not submitted. Refresh its status before retrying.')
      onChanged(); onBack()
    } catch (cause: any) { setError(cause?.message ?? 'Could not submit. Your answers remain available to retry.') }
    finally { lock.current = false; setBusy(false) }
  }
  if (!attempt) return <div className="dash-main"><div className="section-heading"><h1>{assessment.title}</h1><button className="btn btn-secondary" onClick={onBack}>Back</button></div>
    <p className="muted">{assessment.instructions ?? assessment.description}</p><div className="stat-strip"><div><span className="stat-value">{assessment.question_count}</span><span className="stat-label">Questions</span></div><div><span className="stat-value">{assessment.duration_minutes}</span><span className="stat-label">Minutes</span></div><div><span className="stat-value">{assessment.max_attempts}</span><span className="stat-label">Attempts</span></div></div>
    {error && <div className="banner banner-error">{error}</div>}<button className="btn btn-primary" onClick={start} disabled={busy}>{busy ? 'Starting…' : 'Start or resume assessment'}</button></div>
  return <div className="dash-main"><div className="section-heading"><h1>{assessment.title}</h1><button className="btn btn-secondary" disabled={busy} onClick={onBack}>Exit</button></div>
    {error && <div className="banner banner-error">{error}</div>}<div className="list-panel">{questions.map((q:any, i) => {
      const id = q.question_id ?? q.id
      const choices = q.choices ?? q.options ?? []
      return <div className="list-row" key={id ?? i}><div><div className="list-row-title">{i + 1}. {q.prompt ?? q.question_text ?? q.text}</div>
        <div className="field">{Array.isArray(choices) && choices.length ? choices.map((choice:any, j:number) => { const value = typeof choice === 'string' ? choice : choice.id ?? choice.value ?? choice.text; return <label key={j}><input disabled={busy} type="radio" name={id} checked={answers[id] === value} onChange={() => setAnswers(a => ({...a, [id]: value}))} /> {typeof choice === 'string' ? choice : choice.text ?? choice.label ?? value}</label> }) : <textarea aria-label={`Answer question ${i + 1}`} disabled={busy} value={answers[id] ?? ''} onChange={event => setAnswers(previous => ({...previous,[id]:event.target.value}))} />}</div>
      </div></div>})}</div>
    <button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? 'Submitting…' : 'Submit assessment'}</button></div>
}

function TaskDetail({ task, existing, onBack, onChanged }: any) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [proposal, setProposal] = useState(''), [amount, setAmount] = useState(task.budget_amount?.toString() ?? ''), [days, setDays] = useState('')
  const lock = useRef(false)
  const submit = async () => {
    if (lock.current || existing || !proposal.trim()) return
    if ((amount && (!Number.isFinite(Number(amount)) || Number(amount) < 0)) || (days && (!Number.isInteger(Number(days)) || Number(days) < 1))) {
      setError('Use a non-negative amount and a whole number of days greater than zero.'); return
    }
    lock.current = true; setBusy(true); setError('')
    try {
      const { data: userData, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!userData.user) throw new Error('Please sign in again.')
      const { error } = await supabase.from('marketplace_submissions').insert({
        task_id:task.id,user_id:userData.user.id,status:'pending',proposal_text:proposal.trim(),
        proposed_amount:amount ? Number(amount) : null,estimated_days:days ? Number(days) : null,currency:task.currency ?? 'ETB',
      })
      if (error) throw error
      onChanged(); onBack()
    } catch (cause: any) { setError(cause?.message ?? 'Could not send your proposal. Please retry.') }
    finally { lock.current = false; setBusy(false) }
  }
  if (existing) return <div className="dash-main"><div className="section-heading"><h1>{task.title}</h1><button className="btn btn-secondary" onClick={onBack}>Back</button></div><h2>Your proposal</h2><p>{existing.proposal_text}</p><p>{existing.proposed_amount ?? 'Not specified'} {task.currency ?? 'ETB'} · {existing.estimated_days ?? 'Unspecified'} days</p><p>Status: {existing.status}</p></div>
  return <div className="dash-main"><div className="section-heading"><h1>{task.title}</h1><button className="btn btn-secondary" onClick={onBack}>Back</button></div>
    <p className="muted">{task.description}</p><div className="stat-strip"><div><span className="stat-value">{task.budget_amount ?? task.reward_coins ?? 0}</span><span className="stat-label">{task.currency ?? 'ETB'}</span></div><div><span className="stat-value">{task.deadline ?? '—'}</span><span className="stat-label">Deadline</span></div></div>
    {error && <div className="banner banner-error">{error}</div>}
    <div className="field"><label>Proposal</label><textarea value={proposal} onChange={e => setProposal(e.target.value)} rows={6} placeholder="Explain how you will complete this task." /></div>
    <div className="field"><label>Proposed amount</label><input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} /></div>
    <div className="field"><label>Estimated days</label><input type="number" min="1" value={days} onChange={e => setDays(e.target.value)} /></div>
    <button className="btn btn-primary" onClick={submit} disabled={busy || !proposal.trim()}>{busy ? 'Submitting…' : 'Send proposal'}</button>
  </div>
}
