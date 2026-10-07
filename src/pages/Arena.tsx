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
  { value: 'speed_quiz', label: '8-Question Quiz Battle', blurb: 'Head-to-head: exactly 8 curriculum questions.' },
  { value: 'skill_sprint', label: 'Skill Sprint', blurb: 'Fast rounds on your strongest subjects.' },
  { value: 'interview_practice', label: 'Interview Practice', blurb: 'Simulated interview-style rounds.' },
  { value: 'case_sprint', label: 'Case Sprint', blurb: 'Scenario-based problem solving.' },
]

type QueueState = 'idle' | 'searching' | 'matched'

export default function Arena({ onBack }: { onBack: () => void }) {
  const { t } = useI18n()
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

  const startSearching = async (mode: ArenaMode) => {
    setBusy(true)
    setError('')
    try {
      if (mode === 'speed_quiz' && !assessmentId) throw new Error('Select a quiz assessment first.')
      await joinMatchmaking(mode, mode === 'speed_quiz' ? assessmentId : null)
      setQueueState('searching')
    } catch (e: any) {
      setError(e.message ?? 'Could not join matchmaking.')
    } finally {
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

  return (
    <div className="dash-main">
      <div className="section-heading">
        <h1>{t('arena')}</h1>
        <button className="btn btn-secondary" onClick={onBack}>{t('back')}</button>
      </div>
      {error && <div className="banner banner-error">{error}</div>}

      {queueState === 'idle' && (
        <>
          <div className="section-heading"><h2>Find a match</h2></div>
          <div className="field" style={{ maxWidth: 520 }}>
            <label htmlFor="arena-assessment">Quiz assessment for the 8-question battle</label>
            <select id="arena-assessment" value={assessmentId} onChange={e => setAssessmentId(e.target.value)}>
              {assessments.map(a => <option key={a.id} value={a.id}>{a.title} · {a.question_count} questions</option>)}
            </select>
          </div>
          <div className="module-grid">
            {MODES.map((m) => (
              <div className="module-card" key={m.value}>
                <h3>{m.label}</h3>
                <p>{m.blurb}</p>
                <button className="btn btn-primary" onClick={() => startSearching(m.value)} disabled={busy || (m.value === 'speed_quiz' && !assessmentId)}>Search for opponent</button>
              </div>
            ))}
          </div>
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
      <p>Both players must be ready before the match creator can start.</p>
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
