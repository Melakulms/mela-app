import HostedCompetitions from '../components/HostedCompetitions'
import ArenaPracticeLab, {type ArenaDemoMode} from '../components/ArenaPracticeLab'
import { useI18n } from '../i18n'
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  fetchLeaderboard, joinMatchmaking, cancelMatchmaking, checkMyQueueStatus,
  fetchMatchState, fetchScoreboard, fetchCurrentRoundDetail, submitRound,
  fetchMatchContext, readyForMatch, startMatch, fetchMyRoundResult,
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

export default function Arena({ onBack, stageKey }: { onBack: () => void; stageKey?: string | null }) {
  const { t } = useI18n()
  // School learners can use all eight local drills, but must not enter live
  // matchmaking or organizer-led competitions through this screen.
  // The backend must independently enforce its own safeguarding policies.
  const schoolPracticeOnly = stageKey?.startsWith('school_') ?? false
  const [hosted, setHosted] = useState<'team_battle' | 'employer_challenge' | 'tournament' | null>(null)
  const [practiceMode,setPracticeMode]=useState<ArenaDemoMode|null>(null)
  const searchLock = useRef(false)
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[] | null>(null)
  const [error, setError] = useState('')
  const [queueState, setQueueState] = useState<QueueState>('idle')
  const [matchId, setMatchId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [assessments, setAssessments] = useState<{ id: string; title: string; question_count: number }[]>([])
  const [assessmentId, setAssessmentId] = useState('')

  useEffect(() => {
    supabase.from('skill_assessments').select('id,title,question_count').eq('status','published').gte('question_count',8).order('title').then(({ data, error }) => {
      if (error) { setError(error.message); return }
      setAssessments((data ?? []) as { id: string; title: string; question_count: number }[])
      if (data?.[0]) setAssessmentId(data[0].id)
    })
    fetchLeaderboard().then(setLeaderboard).catch((e) => {
      setLeaderboard([])
      setError(e.message ?? 'Could not load the leaderboard. Please try again later.')
    })
    if (!schoolPracticeOnly) checkMyQueueStatus().then((q) => {
      if (q?.status === 'matched' && q.matched_match_id) { setMatchId(q.matched_match_id); setQueueState('matched') }
      else if (q?.status === 'waiting') setQueueState('searching')
    }).catch(() => {})
  }, [schoolPracticeOnly])

  useEffect(() => {
    if (schoolPracticeOnly || queueState !== 'searching') return
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
  }, [queueState, schoolPracticeOnly])

  const startSearching = async (mode: ArenaMode) => {
    if (schoolPracticeOnly) {
      setError('Live matchmaking is unavailable for school learners. Choose Try interactive practice instead.')
      return
    }
    if (searchLock.current) return
    searchLock.current = true
    setBusy(true)
    setError('')
    try {
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
    return <LiveMatch matchId={matchId} onLeave={() => { setMatchId(null); setQueueState('idle') }} onBack={onBack} />
  }

  if (practiceMode) return <ArenaPracticeLab mode={practiceMode} onBack={()=>setPracticeMode(null)} />
  if (hosted) return <HostedCompetitions kind={hosted} onBack={() => setHosted(null)} onMatch={id => { setHosted(null); setMatchId(id); setQueueState('matched') }} />

  return (
    <div className="dash-main">
      <div className="section-heading">
        <h1>{t('arena')}</h1>
        <button className="btn btn-secondary" onClick={onBack}>{t('back')}</button>
      </div>
      {error && <div className="banner banner-error">{error}</div>}

      {queueState === 'idle' && (
        <>
          {schoolPracticeOnly && <section className="banner banner-info" role="status">
            <strong>School-safe Arena</strong>
            <p>All eight interactive practice modes are available. Live opponents and organizer-led competitions require separate safeguarding and are not available in school accounts.</p>
          </section>}
          <section className="banner banner-info" aria-label="Arena practice and real competition status">
            <strong>Eight practice activities available · Real competitions have separate requirements</strong>
            <p>Practice is a learning simulation without real opponents, verified employers, prizes or rankings. Official employer, team and tournament registration stays paused until organizer safeguarding is verified.</p>
          </section>
          <div className="section-heading"><h2>Eight ways to compete</h2></div>
          <div className="field" style={{ maxWidth: 520 }}>
            <label htmlFor="arena-assessment">Assessment for quiz competitions</label>
            <select id="arena-assessment" value={assessmentId} onChange={e => setAssessmentId(e.target.value)}>
              {assessments.map(a => <option key={a.id} value={a.id}>{a.title} · {a.question_count} questions</option>)}
            </select>
          </div>
          <div className="module-grid">
            {MODES.map((m) => (
              <div className="module-card" key={m.value}>
                <h3>{m.label}</h3>
                <p>{m.blurb}</p>
                <button className="btn btn-primary" onClick={() => startSearching(m.value)} disabled={busy || schoolPracticeOnly || (['quiz_battle', 'speed_quiz'].includes(m.value) && !assessmentId)}>Search for opponent</button>
                <button type="button" className="btn btn-secondary" onClick={()=>setPracticeMode(m.value)}>Try interactive practice</button>
              </div>
            ))}
            {([['team_battle', 'Team Battle', 'Join an organized team competition.'], ['employer_challenge', 'Employer Challenge', 'Demonstrate skills in organizer-led challenges.'], ['tournament', 'Tournaments', 'Explore multi-match competitions.']] as const).map(([kind, label, description]) => <div className="module-card" key={kind}><h3>{label}</h3><p>{description}</p><button className="btn btn-primary" disabled={busy || schoolPracticeOnly} onClick={() => setHosted(kind)}>Browse {label}</button><button type="button" className="btn btn-secondary" onClick={()=>setPracticeMode(kind)}>Try interactive practice</button></div>)}
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
    return () => { active.current = false; window.clearInterval(timer) }
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

  if (!state) return <div className="dash-main">
    <h1>Arena match</h1>
    {error ? <><div className="banner banner-error" role="alert">{error}</div><button className="btn btn-primary" onClick={() => void load()}>Retry</button></> : <p role="status">Loading match…</p>}
    <button className="btn btn-secondary" onClick={onBack}>{t('back')}</button>
  </div>

  return <div className="dash-main">
    <div className="section-heading"><h1>{state.title}</h1><button className="btn btn-secondary" onClick={onBack}>{t('back')}</button></div>
    {error && <div className="banner banner-error" role="alert">{error}</div>}
    <p className="muted">{state.participant_count} players · status: {state.status}</p>
    {['open', 'ready'].includes(state.status) ? <div className="banner banner-info">
      <p>Required participants must be ready before the match creator can start.</p>
      <button className="btn btn-primary" disabled={busy} onClick={() => void prepare(false)}>I'm ready</button>
      {context?.isCreator && <button className="btn btn-primary" disabled={busy || state.status !== 'ready'} onClick={() => void prepare(true)}>Start match</button>}
      <button className="btn btn-secondary" disabled={busy} onClick={() => void load()}>Refresh match</button>
    </div> : state.status === 'completed' ? <div className="banner banner-info">This match has ended.</div>
      : state.status === 'cancelled' ? <div className="banner banner-info">This match was cancelled.</div>
      : round && state.current_round?.state === 'open' ? <RoundPanel key={round.id} round={round} order={state.current_round.round_order} serverResult={serverResult} onSubmitted={() => void load()} />
      : <div className="banner banner-info">Waiting for the next round to open. The match refreshes automatically.</div>}
    <div className="section-heading"><h2>Scoreboard</h2></div>
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
    </div> : <div className="field"><label htmlFor="arena-answer">Your answer</label><input id="arena-answer" value={answer} onChange={e => setAnswer(e.target.value)} disabled={busy || !!submitted} /></div>}
    {submitted ? <div className="banner banner-info" role="status">
      {submitted.score == null ? 'Answer submitted. Awaiting review.' : `Answer submitted. Score: ${submitted.score} / ${round.max_points}.`} {submitted.feedback}
      <p>The next round will appear automatically.</p>
    </div> : <button className="btn btn-primary" disabled={busy || !answer.trim()} onClick={() => void submit()}>{busy ? 'Submitting…' : 'Submit answer'}</button>}
  </>
}
