import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withdrawMyProposal } from '../lib/contracts'
import ContractDisputes from '../components/ContractDisputes'
import MembershipAndReferrals from '../components/MembershipAndReferrals'

type Task = {
  id: string; title: string; description: string | null; task_type: string | null;
  budget_amount: number | null; reward_coins: number | null; currency: string | null;
  deadline: string | null; status: string; skills_required: string[] | null
}
type Proposal = {
  id: string; task_id: string; status: string; proposal_text: string | null;
  proposed_amount: number | null; estimated_days: number | null; submitted_at: string | null; currency?: string | null
}
type Section = 'browse' | 'proposals' | 'contracts' | 'rewards'

function displayReward(task: Task) {
  if (task.budget_amount != null && task.currency) return `${task.budget_amount} ${task.currency} proposed budget — not a guaranteed earning`
  if (task.reward_coins) return `${task.reward_coins} learning coins — not redeemable cash`
  return 'Budget not specified'
}

export default function EarnWork({ onBack, stageKey }: { onBack: () => void; stageKey?: string | null }) {
  const [section, setSection] = useState<Section>('browse')
  const [tasks, setTasks] = useState<Task[]>([])
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null)
  const [userId, setUserId] = useState('')
  const [workEnabled, setWorkEnabled] = useState(false)
  const [featureAvailable, setFeatureAvailable] = useState(false)
  const [eligibilityStatus, setEligibilityStatus] = useState('not_requested')
  const [canRequest, setCanRequest] = useState(false)
  const [policyAccepted, setPolicyAccepted] = useState(false)
  const [adultDeclaration, setAdultDeclaration] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [proposal, setProposal] = useState('')
  const [amount, setAmount] = useState('')
  const [days, setDays] = useState('')
  const lock = useRef(false)
  const schoolLearner = stageKey?.startsWith('school_') ?? false
  const selectedTask = tasks.find(task => task.id === selectedTaskId)
  const selectedProposal = proposals.find(row => row.id === selectedProposalId)
  const appliedIds = new Set(proposals.map(row => row.task_id))

  useEffect(() => {
    let active = true
    setLoaded(false); setError('')
    void (async () => {
      try {
        // Authenticate first so My proposals cannot include other team members'
        // rows in an account with multiple approved roles.
        const auth = await supabase.auth.getUser()
        if (auth.error) throw auth.error
        if (!auth.data.user) throw new Error('Please sign in to view your work.')
        const [flag, available, mine, eligibility] = await Promise.all([
          supabase.rpc('mela_earn_work_readiness_v1'),
          supabase.from('marketplace_tasks')
            .select('id,title,description,task_type,budget_amount,reward_coins,currency,deadline,status,skills_required')
            .eq('status', 'open').order('deadline', { ascending: true }).limit(100),
          supabase.from('marketplace_submissions')
            .select('id,task_id,status,proposal_text,proposed_amount,estimated_days,submitted_at,currency')
            .eq('user_id', auth.data.user.id).order('submitted_at', { ascending: false }).limit(100),
          supabase.rpc('mela_work_eligibility_status_v1'),
        ])
        if (available.error) throw available.error
        if (mine.error) throw mine.error
        if (!active) return
        setUserId(auth.data.user.id)
        // Fail closed: unavailable or invalid configuration never opens paid work.
        const availableForWork = !flag.error && flag.data?.enabled === true
        const eligible = !eligibility.error && eligibility.data?.can_apply === true
        setFeatureAvailable(availableForWork)
        setEligibilityStatus(!eligibility.error ? String(eligibility.data?.status ?? 'not_requested') : 'unavailable')
        setCanRequest(!eligibility.error && eligibility.data?.can_request === true)
        setPolicyAccepted(!eligibility.error && eligibility.data?.policy_accepted === true)
        setWorkEnabled(availableForWork && eligible && !schoolLearner && flag.data?.school_learner !== true)
        setTasks((available.data ?? []) as Task[])
        setProposals((mine.data ?? []) as Proposal[])
      } catch (cause) {
        if (active) { setWorkEnabled(false); setError(cause instanceof Error ? cause.message : 'Earn & Work is unavailable.') }
      } finally { if (active) setLoaded(true) }
    })()
    return () => { active = false }
  }, [revision])

  const reload = () => setRevision(value => value + 1)
  const requestReview = async () => {
    if (lock.current || schoolLearner || !canRequest || eligibilityStatus === 'approved' || eligibilityStatus === 'pending') return
    if (!policyAccepted && !adultDeclaration) {
      setError('Confirm that you are 18 or older and accept the adult-work policy before requesting verification.')
      return
    }
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try {
      if (!policyAccepted) {
        const result = await supabase.rpc('record_my_policy_acknowledgement', {
          p_policy_key: 'adult_work_eligibility', p_accept: true,
          p_metadata: { source: 'earn_work', adult_age_self_declared: true },
        })
        if (result.error || result.data?.accepted !== true)
          throw result.error ?? new Error('Your adult-work policy acknowledgement could not be confirmed.')
      }
      const result = await supabase.rpc('mela_request_work_eligibility_v1')
      if (result.error || !['pending','approved'].includes(result.data?.status))
        throw result.error ?? new Error('The independent eligibility review request was not recorded.')
      setNotice('Request received. MELA staff must verify adult identity independently. You cannot start paid work until approved and real work is enabled.')
      setAdultDeclaration(false)
      reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Eligibility review request failed.')
    } finally { lock.current = false; setBusy(false) }
  }
  const changeSection = (next: Section) => {
    setSection(next); setSelectedTaskId(null); setSelectedProposalId(null); setError(''); setNotice('')
  }
  const openTask = (task: Task) => {
    setSelectedTaskId(task.id); setAmount(task.budget_amount == null ? '' : String(task.budget_amount))
    setDays(''); setProposal(''); setError(''); setNotice('')
  }
  const saveProposal = async () => {
    if (lock.current || !selectedTask || !workEnabled || schoolLearner || appliedIds.has(selectedTask.id)) return
    const price = amount.trim()
    const estimate = days.trim()
    if (proposal.trim().length < 20 || proposal.trim().length > 2000) { setError('Write a proposal of 20–2000 characters.'); return }
    if (price && (!/^\d+(\.\d{1,2})?$/.test(price) || Number(price) <= 0 || Number(price) > 10000000)) {
      setError('Enter a valid positive amount, with up to two decimal places.'); return
    }
    if (estimate && (!/^\d+$/.test(estimate) || Number(estimate) < 1 || Number(estimate) > 365)) {
      setError('Enter a whole number from 1 to 365 days.'); return
    }
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const { error: insertError } = await supabase.from('marketplace_submissions').insert({
        task_id: selectedTask.id, user_id: userId, status: 'pending',
        proposal_text: proposal.trim(), proposed_amount: price ? Number(price) : null,
        estimated_days: estimate ? Number(estimate) : null, currency: selectedTask.currency ?? 'ETB',
      })
      if (insertError) throw insertError
      setNotice('Your proposal was recorded. It is not an awarded contract or a payment.')
      setSelectedTaskId(null); setSection('proposals'); setProposal(''); reload()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your proposal. You can retry.') }
    finally { lock.current = false; setBusy(false) }
  }
  const withdraw = async (row: Proposal) => {
    if (lock.current || row.status !== 'pending') return
    if (!window.confirm('Withdraw this proposal? This cannot be undone.')) return
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try { await withdrawMyProposal(row.id); setNotice('Proposal withdrawn.'); setSelectedProposalId(null); reload() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Withdrawal could not be verified.') }
    finally { lock.current = false; setBusy(false) }
  }

  return <div className="dash-main">
    <div className="section-heading"><h1>Earn & Work</h1><button className="btn btn-secondary" type="button" onClick={onBack}>Back to MELA Home</button></div>
    <p className="muted">Find verified employer tasks, track your applications, and follow existing contracts in one place.</p>
    {!loaded && <p role="status">Checking work opportunities and your private records…</p>}
    {loaded && !featureAvailable && <div className="banner banner-info" role="status">New paid work is currently paused by MELA. You can view existing proposals and contracts or report an issue. Do not pay an advance fee or start work based only on a listing.</div>}
    {schoolLearner && <div className="banner banner-info" role="status">Paid freelance work requires verified adult eligibility. School learners cannot apply here; learning and Career Passport tools remain available.</div>}
    <p className="field-hint">MELA coins, proposal budgets and unverified escrow are not withdrawable money. No payout is promised by applying.</p>
    {loaded && !schoolLearner && <section className="list-panel" aria-label="Paid work identity eligibility">
      <h2>Adult work eligibility</h2>
      <p><strong>Review status:</strong> {eligibilityStatus.replace(/_/g, ' ')}</p>
      {eligibilityStatus === 'approved'
        ? <p>Your adult eligibility was reviewed. Applications remain subject to available verified jobs and MELA's work controls.</p>
        : eligibilityStatus === 'pending'
        ? <p>A MELA administrator must check your adult identity before you can apply for paid work. Do not submit identity documents in public messages.</p>
        : eligibilityStatus === 'rejected'
        ? <p>Your eligibility request was not approved. Contact MELA support for review; do not create another account to bypass restrictions.</p>
        : canRequest ? <>
          <p>Real-money freelance work is for independently verified adults aged 18 or older. Verification is not a payment, job offer, or approval to start work. No advance fee should ever be paid to an employer.</p>
          {!policyAccepted && <label className="field"><input type="checkbox" checked={adultDeclaration} onChange={e => setAdultDeclaration(e.target.checked)} />
            I am at least 18 and agree to MELA's adult-work eligibility policy. My declaration will be independently reviewed.</label>}
          <button type="button" className="btn btn-secondary" disabled={busy || (!policyAccepted && !adultDeclaration)} onClick={() => void requestReview()}>Request adult work verification</button>
        </> : <p>Paid work eligibility is unavailable to this account. Complete the appropriate profile or contact support.</p>}
    </section>}
    <div className="module-grid" role="group" aria-label="Earn & Work sections">
      <button type="button" className="btn btn-secondary" aria-pressed={section==='browse'} onClick={() => changeSection('browse')}>Available work</button>
      <button type="button" className="btn btn-secondary" aria-pressed={section==='proposals'} onClick={() => changeSection('proposals')}>My proposals ({proposals.length})</button>
      <button type="button" className="btn btn-secondary" aria-pressed={section==='contracts'} onClick={() => changeSection('contracts')}>My contracts</button>
      <button type="button" className="btn btn-secondary" aria-pressed={section==='rewards'} onClick={() => changeSection('rewards')}>Membership & referral earnings</button>
    </div>
    {error && <div className="banner banner-error" role="alert">{error}<button type="button" className="btn btn-secondary" onClick={reload} disabled={busy}>Retry</button></div>}
    {notice && <p role="status">{notice}</p>}
    {section === 'browse' && loaded && (selectedTask ? <section className="list-panel" aria-label="Selected work task">
      <button className="btn btn-secondary" type="button" onClick={() => {setSelectedTaskId(null);setError('')}}>Back to available work</button>
      <h2>{selectedTask.title}</h2>
      <p>{selectedTask.description}</p>
      <p><strong>Budget:</strong> {displayReward(selectedTask)}</p>
      {selectedTask.skills_required?.length ? <p><strong>Skills:</strong> {selectedTask.skills_required.join(', ')}</p> : null}
      {selectedTask.deadline && <p><strong>Deadline:</strong> {new Date(selectedTask.deadline).toLocaleDateString()}</p>}
      {appliedIds.has(selectedTask.id) ? <p>Your proposal is already recorded. Check My proposals for its status.</p>
        : !workEnabled || schoolLearner ? <p>Applications for this task are not available to your account.</p>
        : <>
          <div className="field"><label htmlFor="work-proposal">How will you complete this task? (20–2000 characters)</label>
            <textarea id="work-proposal" value={proposal} maxLength={2000} rows={5} onChange={e => setProposal(e.target.value)} /></div>
          <div className="field"><label htmlFor="work-amount">Your proposed amount ({selectedTask.currency ?? 'ETB'})</label>
            <input id="work-amount" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} /></div>
          <div className="field"><label htmlFor="work-days">Estimated days</label>
            <input id="work-days" inputMode="numeric" value={days} onChange={e => setDays(e.target.value)} /></div>
          <button type="button" className="btn btn-primary" disabled={busy || proposal.trim().length < 20} onClick={() => void saveProposal()}>{busy ? 'Saving…' : 'Send proposal'}</button>
        </>}
    </section> : <>
      <h2>Available work</h2>
      {!tasks.length ? <p className="empty-panel">No open employer tasks are available right now.</p> :
        <div className="list-panel">{tasks.map(task => <div className="list-row" key={task.id}>
          <div><strong>{task.title}</strong><p>{displayReward(task)}</p>
            {task.deadline && <p className="field-hint">Deadline: {new Date(task.deadline).toLocaleDateString()}</p>}</div>
          <button className="btn btn-secondary" type="button" onClick={() => openTask(task)}>{appliedIds.has(task.id) ? 'View task' : 'View details'}</button>
        </div>)}</div>}
    </>)}
    {section === 'proposals' && loaded && (selectedProposal ? <section className="list-panel">
      <button type="button" className="btn btn-secondary" onClick={() => setSelectedProposalId(null)}>Back to my proposals</button>
      <h2>My proposal</h2>
      <p><strong>Status:</strong> {selectedProposal.status}</p>
      <p>{selectedProposal.proposal_text}</p>
      <p><strong>Proposed amount:</strong> {selectedProposal.proposed_amount ?? 'Unspecified'} {selectedProposal.currency ?? 'ETB'} · <strong>Estimated days:</strong> {selectedProposal.estimated_days ?? 'Unspecified'}</p>
      <p>A shortlisted or accepted proposal is not the same as a funded contract. Confirm details in My contracts before starting work.</p>
      {selectedProposal.status === 'pending' && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void withdraw(selectedProposal)}>Withdraw proposal</button>}
    </section> : <>
      <h2>My proposals</h2>
      {!proposals.length ? <p className="empty-panel">You have not submitted any work proposals yet.</p> :
        <div className="list-panel">{proposals.map(row => <div className="list-row" key={row.id}>
          <div><strong>{tasks.find(task => task.id === row.task_id)?.title ?? 'Work proposal'}</strong>
            <p>{row.status} · {row.submitted_at ? new Date(row.submitted_at).toLocaleDateString() : 'Date unavailable'}</p></div>
          <button type="button" className="btn btn-secondary" onClick={() => {setSelectedProposalId(row.id);setError('')}}>View proposal</button>
        </div>)}</div>}
    </>)}
    {section === 'contracts' && loaded && userId && <ContractDisputes currentUserId={userId} workEnabled={workEnabled && !schoolLearner} />}
    {section === 'rewards' && loaded && userId && <>
      <p className="field-hint">Referral commission is recorded only after an eligible, independently verified first Pro (50 ETB) or Premium (100 ETB) subscription payment. A registration, proposal, or contract budget is not withdrawable cash.</p>
      <MembershipAndReferrals userId={userId} />
    </>}
    {loaded && <button type="button" className="btn btn-secondary" onClick={reload} disabled={busy}>Refresh Earn & Work</button>}
  </div>
}
