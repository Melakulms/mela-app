import HostedCompetitions from '../components/HostedCompetitions'
import ArenaPracticeLab, {type ArenaDemoMode} from '../components/ArenaPracticeLab'
import { useI18n } from '../i18n'
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  fetchLeaderboard, joinMatchmaking, cancelMatchmaking, checkMyQueueStatus,
  fetchMatchState, fetchScoreboard, fetchCurrentRoundDetail, submitRound,
  fetchMatchContext, readyForMatch, startMatch, fetchMyRoundResult, advanceMyArenaMatch, fetchMyActiveArenaMatch, type ActiveArenaMatch,
  type LeaderboardRow, type ArenaMode, type MatchState, type ScoreboardRow, type RoundDetail, type RoundResult,
} from '../lib/arena'

const MODES: { value: ArenaMode; label: string; blurb: string }[] = [
  { value: 'quiz_battle', label: 'Quiz Battle', blurb: 'Head-to-head curriculum quiz rounds.' },
  { value: 'speed_quiz', label: 'Speed Quiz', blurb: 'Timed curriculum questions.' },
  { value: 'skill_sprint', label: 'Skill Sprint', blurb: 'Fast rounds on your strongest subjects.' },
  { value: 'interview_practice', label: 'Interview Practice', blurb: 'Simulated interview-style rounds.' },
  { value: 'case_sprint', label: 'Case Sprint', blurb: 'Scenario-based problem solving.' },
]

type QueueState = 'idle' | 'searching' | 'matched'

export default function Arena({ onBack }: { onBack: () => void }) {
  const { t } = useI18n()
  const [hosted, setHosted] = useState<'team_battle' | 'employer_challenge' | 'tournament' | null>(null)
  const [demoMode,setDemoMode] = useState<ArenaDemoMode|null>(null)
  const searchLock = useRef(false)
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[] | null>(null)
  const [error, setError] = useState('')
  const [queueState, setQueueState] = useState<QueueState>('idle')
  const [matchId, setMatchId] = useState<string | null>(null)
  const [resumableMatch,setResumableMatch] = useState<ActiveArenaMatch|null>(null)
  const [resumeLoading,setResumeLoading] = useState(false)
  const [resumeError,setResumeError] = useState('')
  const [busy, setBusy] = useState(false)
  const [assessments, setAssessments] = useState<{ id: string; title: string; question_count: number }[]>([])
  const [assessmentId, setAssessmentId] = useState('')
  const [adultAccess,setAdultAccess] = useState<'checking'|'eligible'|'missing_dob'|'underage'|'school'|'unauthorized'>('checking')
  const [birthDate,setBirthDate] = useState('')
  const [ageSaving,setAgeSaving] = useState(false)
  const [ageError,setAgeError] = useState('')
  const [inviteNotice,setInviteNotice] = useState('')
  const staging = import.meta.env.VITE_MELA_STAGING === 'true'

  useEffect(() => {
    if (!staging) {setAdultAccess('eligible');return}
    let active=true
    void (async()=>{
      try {
        const {data:{user},error:authError}=await supabase.auth.getUser()
        if(authError)throw authError
        if(!user) {if(active)setAdultAccess('unauthorized');return}
        const {data:profile,error:profileError}=await supabase.from('profiles')
          .select('role,education_stage_key,account_status,education_onboarding_completed')
          .eq('id',user.id).maybeSingle()
        if(profileError)throw profileError
        if(profile?.role!=='student'||profile.account_status!=='active'||!profile.education_onboarding_completed) {
          if(active)setAdultAccess('unauthorized');return
        }
        if(!['university','college_tvet'].includes(profile.education_stage_key??'')) {
          if(active)setAdultAccess('school');return
        }
        const {data:details,error:detailsError}=await supabase.from('student_profiles')
          .select('date_of_birth').eq('user_id',user.id).maybeSingle()
        if(detailsError)throw detailsError
        if(active){
          const dob=details?.date_of_birth??null
          const cutoff=new Date()
          cutoff.setUTCFullYear(cutoff.getUTCFullYear()-18)
          const cutoffStr=cutoff.toISOString().slice(0,10)
          const century=new Date()
          century.setUTCFullYear(century.getUTCFullYear()-120)
          setAdultAccess(!dob?'missing_dob':dob>cutoffStr||dob<century.toISOString().slice(0,10)?'underage':'eligible')
        }
      } catch(cause){
        if(active){setAdultAccess('unauthorized');setAgeError(cause instanceof Error?cause.message:'Unable to verify your staging account')}
      }
    })()
    return()=>{active=false}
  },[staging])

  const saveAdultBetaDate=async()=>{
    if(ageSaving || !birthDate)return
    setAgeSaving(true);setAgeError('')
    try {
      const cutoff=new Date()
      cutoff.setUTCFullYear(cutoff.getUTCFullYear()-18)
      const oldest=new Date()
      oldest.setUTCFullYear(oldest.getUTCFullYear()-120)
      if(birthDate<oldest.toISOString().slice(0,10))throw new Error('Enter a valid adult birth date for the beta account.')
      if(birthDate>cutoff.toISOString().slice(0,10))throw new Error('Open Arena matchmaking is restricted to adults age 18 or older.')
      const {data:{user},error:authError}=await supabase.auth.getUser()
      if(authError)throw authError
      if(!user)throw new Error('Sign in first')
      const {error:saveError}=await supabase.from('student_profiles').upsert(
        {user_id:user.id,date_of_birth:birthDate},{onConflict:'user_id'})
      if(saveError)throw saveError
      setAdultAccess('eligible')
      setBirthDate('')
    } catch(cause){setAgeError(cause instanceof Error?cause.message:'Could not save staging date of birth')}
    finally{setAgeSaving(false)}
  }
  useEffect(() => {
    supabase.from('skill_assessments').select('id,title,question_count').eq('status','published').gte('question_count',8).order('title').then(({ data, error }) => {
      if (error) { setError(error.message); return }
      setAssessments((data ?? []) as { id: string; title: string; question_count: number }[])
      if (data?.[0]) setAssessmentId(data[0].id)
    })
    fetchLeaderboard().then(setLeaderboard).catch((e) => setError(e.message ?? 'Could not load the leaderboard.'))
    checkMyQueueStatus().then((q) => {
      if (q?.status === 'matched' && q.matched_match_id) { setMatchId(q.matched_match_id); setQueueState('matched') }
      else if (q?.status === 'waiting') setQueueState('searching')
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (queueState !== 'searching') return
    let active = true
    let checking = false
    const check = async () => {
      if (checking) return
      checking = true
      try {
        const q = await checkMyQueueStatus()
        if (!active) return
        if (q?.status === 'matched' && q.matched_match_id) {
          setMatchId(q.matched_match_id); setQueueState('matched')
        } else if (!q || ['cancelled', 'expired'].includes(q.status)) {
          setQueueState('idle'); setError('Your search ended. Start a new search to find an opponent.')
        }
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Could not check matchmaking.') }
      finally { checking = false }
    }
    void check()
    const timer = window.setInterval(() => void check(), 5000)
    return () => { active = false; window.clearInterval(timer) }
  }, [queueState])

  const shareArenaTest = async () => {
    const url=new URL(window.location.href)
    url.pathname='/';url.search='?view=arena';url.hash=''
    const message='Join me in MELA Arena adult staging. Sign into your own eligible beta account, open Quiz Battle, select the same MELA STAGING DEMO assessment, and tap Search for opponent. This is an unrated test, with no prizes.'
    try {
      if(navigator.share) {
        await navigator.share({title:'MELA Arena staging competition',text:message,url:url.toString()})
        setInviteNotice('Testing instructions shared. Each player needs their own eligible account.')
      }else if(navigator.clipboard?.writeText){
        await navigator.clipboard.writeText(message+' '+url.toString())
        setInviteNotice('Testing instructions copied. Send them to another adult beta tester.')
      }else setInviteNotice('Share this staging Arena link with the other adult beta tester: '+url.toString())
    }catch(cause){
      if(cause instanceof Error && cause.name==='AbortError')return
      setInviteNotice('Share from your browser address bar: '+url.toString())
    }
  }
  const reloadResumeMatch = async () => {
    setResumeLoading(true);setResumeError('')
    try {
      const current=await fetchMyActiveArenaMatch()
      setResumableMatch(current)
    }catch(cause){
      setResumeError(cause instanceof Error?cause.message:'Could not retrieve your ongoing Arena match.')
    }finally{setResumeLoading(false)}
  }
  useEffect(()=>{
    if(queueState!=='idle')return
    let active=true
    void fetchMyActiveArenaMatch().then(match=>{
      if(active)setResumableMatch(match)
    }).catch(cause=>{
      if(active)setResumeError(cause instanceof Error?cause.message:'Could not load your ongoing match.')
    })
    return()=>{active=false}
  },[queueState])

  const startSearching = async (mode: ArenaMode) => {
    if (searchLock.current) return
    searchLock.current = true
    setBusy(true)
    setError('')
    try {
      if(staging && adultAccess!=='eligible')throw new Error('Complete adult beta eligibility before entering matchmaking.')
      if (['quiz_battle', 'speed_quiz'].includes(mode) && !assessmentId) throw new Error('Select a quiz assessment first.')
      await joinMatchmaking(mode, ['quiz_battle', 'speed_quiz'].includes(mode) ? assessmentId : null)
      setQueueState('searching')
    } catch (e: any) {
      setError(e.message ?? 'Could not join matchmaking.')
    } finally {
      searchLock.current = false
      setBusy(false)
    }
  }

  const stopSearching = async () => {
    setBusy(true)
    try {
      await cancelMatchmaking()
      setQueueState('idle')
    } catch (e: any) {
      setError(e.message ?? 'Could not cancel matchmaking.')
    } finally {
      setBusy(false)
    }
  }

  const recheck = async () => {
    setBusy(true)
    setError('')
    try {
      const q = await checkMyQueueStatus()
      if (q?.status === 'matched' && q.matched_match_id) { setMatchId(q.matched_match_id); setQueueState('matched') }
      else setError('Still searching — no opponent found yet. Try again in a moment.')
    } catch (e: any) {
      setError(e.message ?? 'Could not check matchmaking status.')
    } finally {
      setBusy(false)
    }
  }

  if (queueState === 'matched' && matchId) {
    return <LiveMatch matchId={matchId} onLeave={() => { setMatchId(null); setQueueState('idle');void reloadResumeMatch() }} onBack={onBack} />
  }

  if (demoMode && staging) return <ArenaPracticeLab mode={demoMode} onBack={()=>setDemoMode(null)}/>

  if (hosted) return <HostedCompetitions kind={hosted} canEnter={!staging||adultAccess==='eligible'} onBack={() => setHosted(null)} onMatch={id => { setHosted(null); setMatchId(id); setQueueState('matched') }} />

  return (
    <div className="dash-main">
      <div className="section-heading">
        <h1>{t('arena')}</h1>
        <button className="btn btn-secondary" onClick={onBack}>{t('back')}</button>
      </div>
      {error && <div className="banner banner-error" role="alert">{error}</div>}
      {staging && <section className="banner banner-info" aria-label="Arena beta safety" style={{marginBottom:14}}>
        <strong>MELA ARENA · STAGING ADULT DEMO · 24 OCT 2026</strong>
        <p>Eight interactive, local-only practice experiences are available without another player. Real competition is different: two quiz modes support automatic grading with demo questions; Skill Sprint, Interview Practice and Case Sprint need an independent judge for verified results. All five matchmaking modes are testing-only and unrated. Team, employer and tournament entry is available only when an approved organizer publishes a public event; the server enforces adult participation. No such event is currently published on staging.</p>
        <p><strong>Adult competition access:</strong> {adultAccess==='checking'?'Checking your student profile…':
          adultAccess==='eligible'?'Account passes the current staging adult-profile check (self-reported age; not independent identity verification).':
          adultAccess==='missing_dob'?'Date of birth is missing from your staging student profile.':
          adultAccess==='underage'?'Your current date of birth does not pass the 18+ check.':
          adultAccess==='school'?'Open opponent matchmaking is unavailable for school-stage learners.':
          'Your staging student account could not be verified.'}</p>
        {adultAccess==='missing_dob' && <div className="field" style={{maxWidth:420}}>
          <label htmlFor="arena-dob">Date of birth for adult beta test account (do not enter a real child's information)</label>
          <input id="arena-dob" type="date" value={birthDate} onChange={e=>setBirthDate(e.target.value)}/>
          <p className="muted">A self-reported date establishes test eligibility only, not verified identity or eligibility for money prizes.</p>
          <button className="btn btn-primary" disabled={!birthDate||ageSaving} onClick={()=>void saveAdultBetaDate()}>
            {ageSaving?'Saving…':'Save beta age information'}
          </button>
        </div>}
        {ageError && <p role="alert">{ageError}</p>}
      </section>}

      {queueState === 'idle' && (
        <>
          <section className="list-panel" aria-label="Resume own competition">
            <h2>Your ongoing Arena match</h2>
            {resumableMatch ? <>
              <p><strong>{resumableMatch.title}</strong> · {resumableMatch.status}</p>
              <button className="btn btn-primary" onClick={()=>{
                setMatchId(resumableMatch.id);setQueueState('matched')
              }}>Resume my match</button>
            </> : <p className="muted">No active competition found in your account. You can join one below or try any of the eight practice activities.</p>}
            <button className="btn btn-secondary" onClick={()=>void reloadResumeMatch()} disabled={resumeLoading}>
              {resumeLoading?'Checking…':'Refresh my matches'}
            </button>
            {resumeError&&<p role="alert" className="banner banner-error">{resumeError}</p>}
          </section>
          <div className="section-heading"><h2>Eight ways to compete</h2></div>
          {staging&&<section className="banner banner-info" aria-label="Arena opponent testing">
            <strong>How to start a real two-player beta match</strong>
            <p>Two different adult student accounts must sign in from separate phone/browser sessions. Both select the same demo assessment and Quiz Battle or Speed Quiz, then search for an opponent. Both tap I'm ready once matched. Either can start after both are ready.</p>
            <button type="button" className="btn btn-secondary" onClick={()=>void shareArenaTest()}>
              Share Arena beta testing instructions
            </button>
            {inviteNotice&&<p role="status">{inviteNotice}</p>}
          </section>}
          <div className="field" style={{ maxWidth: 520 }}>
            <label htmlFor="arena-assessment">Assessment for quiz competitions</label>
            {!assessments.length&&<p className="muted">No Arena demo assessment is published or available to your account.</p>}
            <select id="arena-assessment" value={assessmentId} onChange={e => setAssessmentId(e.target.value)}>
              {assessments.map(a => <option key={a.id} value={a.id}>{a.title} · {a.question_count} questions</option>)}
            </select>
          </div>
          <div className="module-grid">
            {MODES.map((m) => (
              <div className="module-card" key={m.value}>
                <h3>{m.label}</h3>
                <p>{m.blurb}</p>
                <button className="btn btn-primary" onClick={() => startSearching(m.value)} disabled={busy || (staging && adultAccess!=='eligible') || (['quiz_battle', 'speed_quiz'].includes(m.value) && !assessmentId)}>Search for opponent</button>
                {staging && <button type="button" className="btn btn-secondary" onClick={()=>setDemoMode(m.value)}>
                  Try interactive practice
                </button>}
              </div>
            ))}
            {([['team_battle', 'Team Battle', 'Join an organized team competition.'], ['employer_challenge', 'Employer Challenge', 'Demonstrate skills in organizer-led challenges.'], ['tournament', 'Tournaments', 'Explore multi-match competitions.']] as const).map(([kind, label, description]) => <div className="module-card" key={kind}><h3>{label}</h3><p>{description}</p><button className="btn btn-primary" disabled={busy} onClick={() => setHosted(kind)}>Browse {label}</button>
              {staging&&<button type="button" className="btn btn-secondary" onClick={()=>setDemoMode(kind)}>
                Try interactive practice
              </button>}</div>)}
          </div>
          <p className="banner banner-info">Learn and compete without betting. Cash earning and payouts remain unavailable. Ratings and learning progress are not money; no prize or income is guaranteed. Written-answer modes need an organizer’s judge.</p>
        </>
      )}

      {queueState === 'searching' && (
        <div className="banner banner-info">
          Searching for an opponent…
          <div style={{ marginTop: '0.7rem', display: 'flex', gap: '0.6rem' }}>
            <button className="btn btn-secondary" onClick={recheck} disabled={busy}>Check now</button>
            <button className="btn btn-secondary" onClick={stopSearching} disabled={busy}>Cancel</button>
          </div>
        </div>
      )}

      <div className="section-heading"><h2>Leaderboard</h2></div>
      {!leaderboard && <p className="muted">Loading…</p>}
      {leaderboard && leaderboard.length === 0 && (
        <div className="empty-panel">No ranked matches have been played yet — be the first.</div>
      )}
      {leaderboard && leaderboard.length > 0 && (
        <div className="list-panel">
          {leaderboard.map((row) => (
            <div className="list-row" key={row.user_id}>
              <div>
                <div className="list-row-title">#{row.rank} {row.full_name ?? 'Player'}</div>
                <div className="list-row-meta">{row.wins} wins · {row.matches_played} matches</div>
              </div>
              <span className="pill">{row.rating} rating</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function LiveMatch({ matchId, onLeave, onBack }: { matchId: string; onLeave: () => void; onBack: () => void }) {
  const { t } = useI18n()
  const [state, setState] = useState<MatchState | null>(null)
  const [remainingSecondsNow,setRemainingSecondsNow]=useState(()=>Date.now())
  const [round, setRound] = useState<RoundDetail | null>(null)
  const [scoreboard, setScoreboard] = useState<ScoreboardRow[]>([])
  const [context, setContext] = useState<{ userId: string; isCreator: boolean } | null>(null)
  const [serverResult, setServerResult] = useState<RoundResult | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const active = useRef(false)
  const fetching = useRef(false)

  const load = useCallback(async () => {
    if (fetching.current) return
    fetching.current = true
    try {
      const [s, c] = await Promise.all([fetchMatchState(matchId), fetchMatchContext(matchId)])
      const [board, r] = await Promise.all([
        fetchScoreboard(matchId),
        s.current_round ? fetchCurrentRoundDetail(matchId, s.current_round.round_order) : Promise.resolve(null),
      ])
      const submission = r ? await fetchMyRoundResult(r.id, c.userId) : null
      if (!active.current) return
      setState(s); setContext(c); setScoreboard(board); setRound(r); setServerResult(submission); setError('')
    } catch (cause) {
      if (active.current) setError(cause instanceof Error ? cause.message : 'Could not load the match.')
    } finally { fetching.current = false }
  }, [matchId])

  useEffect(() => {
    active.current = true
    void load()
    const timer = window.setInterval(() => void load(), 5000)
    const clock = window.setInterval(() => setRemainingSecondsNow(Date.now()),1000)
    return () => { active.current = false; window.clearInterval(timer); window.clearInterval(clock) }
  }, [load])

  const prepare = async (start: boolean) => {
    if (busy) return
    setBusy(true); setError('')
    try {
      if (start) await startMatch(matchId)
      else await readyForMatch(matchId)
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not prepare the match.') }
    finally { setBusy(false) }
  }

  const deadline=state?.current_round?.ends_at
  const secondsLeft=deadline?Math.max(0,Math.ceil((Date.parse(deadline)-remainingSecondsNow)/1000)):null

  if (!state) return <div className="dash-main">
    <h1>Arena match</h1>
    {error ? <><div className="banner banner-error" role="alert">{error}</div><button className="btn btn-primary" onClick={() => void load()}>Retry</button></> : <p role="status">Loading match…</p>}
    <button className="btn btn-secondary" onClick={onBack}>{t('back')}</button>
  </div>

  return <div className="dash-main">
    <div className="section-heading"><h1>{state.title}</h1><button className="btn btn-secondary" onClick={onBack}>{t('back')}</button></div>
    {error && <div className="banner banner-error" role="alert">{error}</div>}
    <p className="muted">{state.participant_count} players · status: {state.status}</p>
    {state.status==='live'&&state.current_round?.state==='open'&&secondsLeft!==null&&
      <p role="timer" className="banner banner-info">
        <strong>Round {state.current_round.round_order} · {secondsLeft} seconds remaining</strong>
        {secondsLeft===0&&' — deadline reached; syncing the next round with the server.'}
      </p>}
    {['open', 'ready'].includes(state.status) ? <div className="banner banner-info">
      <p>All participants must press Ready first. In private, unrated staging matchmaking, either player can start once both are ready.</p>
      <button className="btn btn-primary" disabled={busy} onClick={() => void prepare(false)}>I'm ready</button>
      {context?.isCreator && <button className="btn btn-primary" disabled={busy || state.status !== 'ready'} onClick={() => void prepare(true)}>Start match</button>}
      <button className="btn btn-secondary" disabled={busy} onClick={() => void load()}>Refresh match</button>
    </div> : state.status === 'completed' ? <div className="banner banner-info">
          {['quiz_battle','speed_quiz'].includes(state.arena_type)
            ? (scoreboard.length>1 && scoreboard[0].score===scoreboard[1].score
                ? 'The demo match ended in a draw: the top players have equal points. No extra points or prizes are awarded.'
                : 'Demo match completed. Scores are practice results only; no prizes or rated achievements.')
            : 'This match has ended. Written answers without independent judge review are not verified results.'}
        </div>
      : state.status === 'cancelled' ? <div className="banner banner-info">This match was cancelled.</div>
      : round && state.current_round?.state === 'open' ? <RoundPanel key={round.id} round={round} order={state.current_round.round_order} serverResult={serverResult} onSubmitted={() => {
          void advanceMyArenaMatch(matchId).then(()=>load()).catch(cause=>setError(cause instanceof Error?cause.message:'Could not advance Arena match'))
        }} />
      : state.current_round?.state === 'closed' ? <div className="banner banner-info">
          All rounds are closed. Written answers awaiting authorized human judging do not yet have final results. Match and scores refresh automatically.
        </div>
      : <div className="banner banner-info">Waiting for the next round to open. The match refreshes automatically.</div>}
    <div className="section-heading"><h2>{state.arena_type==='quiz_battle'||state.arena_type==='speed_quiz'?'Demo Scoreboard':'Provisional Scores — Human Judge Required'}</h2></div>
    {!scoreboard.length ? <div className="empty-panel">Scores will appear once the match is underway.</div> : <div className="list-panel">
      {scoreboard.map(row => <div className="list-row" key={row.user_id}><div className="list-row-title">#{row.rank} {row.full_name ?? 'Player'}</div><span className="pill">{row.score} pts</span></div>)}
    </div>}
    <button className="btn btn-secondary" onClick={onLeave}>Leave match view</button>
  </div>
}

function RoundPanel({ round, order, serverResult, onSubmitted }: { round: RoundDetail; order: number; serverResult: RoundResult | null; onSubmitted: () => void }) {
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<RoundResult | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const submitted = result ?? serverResult
  const submit = async () => {
    if (submitting.current || submitted || !answer.trim()) return
    submitting.current = true; setBusy(true); setError('')
    try { setResult(await submitRound(round.id, answer)); onSubmitted() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not submit that answer.') }
    finally { submitting.current = false; setBusy(false) }
  }
  return <>
    <h2>Round {order}</h2><p>{round.prompt}</p>
    {error && <div className="banner banner-error" role="alert">{error}</div>}
    {round.config?.choices?.length ? <div className="list-panel">
      {round.config.choices.map(choice => <button key={choice.id} className="list-row" style={{ width: '100%', textAlign: 'left', background: answer === choice.id ? 'var(--gold-soft)' : 'transparent' }} disabled={busy || !!submitted} onClick={() => setAnswer(choice.id)}>{choice.text}</button>)}
    </div> : <div className="field"><label htmlFor="arena-answer">Your written response</label>
      <textarea id="arena-answer" rows={6} style={{width:'100%',maxWidth:'100%'}}
        placeholder="Give a structured answer with your reasoning, steps and conclusion."
        value={answer} onChange={e => setAnswer(e.target.value)} disabled={busy || !!submitted} />
      <p className="muted">Written answers are reviewed by an independent judge. They are not automatically graded and do not produce verified scores until review.</p>
    </div>}
    {submitted ? <div className="banner banner-info" role="status">
      {submitted.score == null ? 'Answer submitted. Awaiting review.' : `Answer submitted. Score: ${submitted.score} / ${round.max_points}.`} {submitted.feedback}
      <p>The next round will appear automatically.</p>
    </div> : <button className="btn btn-primary" disabled={busy || !answer.trim()} onClick={() => void submit()}>{busy ? 'Submitting…' : 'Submit answer'}</button>}
  </>
}
