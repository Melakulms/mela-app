import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  fetchLeaderboard, joinMatchmaking, cancelMatchmaking, checkMyQueueStatus,
  fetchMatchState, fetchScoreboard, fetchCurrentRoundDetail, submitRound,
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
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[] | null>(null)
  const [error, setError] = useState('')
  const [queueState, setQueueState] = useState<QueueState>('idle')
  const [matchId, setMatchId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [assessments, setAssessments] = useState<{ id: string; title: string; question_count: number }[]>([])
  const [assessmentId, setAssessmentId] = useState('')

  useEffect(() => {
    supabase.from('skill_assessments').select('id,title,question_count').eq('status','published').gte('question_count',8).order('title').then(({ data }) => {
      setAssessments((data ?? []) as { id: string; title: string; question_count: number }[])
      if (data?.[0]) setAssessmentId(data[0].id)
    })
    fetchLeaderboard().then(setLeaderboard).catch((e) => setError(e.message ?? 'Could not load the leaderboard.'))
    checkMyQueueStatus().then((q) => {
      if (q?.matched_match_id) { setMatchId(q.matched_match_id); setQueueState('matched') }
      else if (q?.status === 'waiting') setQueueState('searching')
    }).catch(() => {})
  }, [])

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
      if (q?.matched_match_id) { setMatchId(q.matched_match_id); setQueueState('matched') }
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
        <h1>Arena</h1>
        <button className="btn btn-secondary" onClick={onBack}>Back</button>
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
                <button className="btn btn-primary" onClick={() => startSearching(m.value)} disabled={busy}>Search for opponent</button>
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

function LiveMatch({ matchId, onLeave, onBack }: { matchId: string; onLeave: () => void; onBack: () => void }) {
  const [state, setState] = useState<MatchState | null>(null)
  const [round, setRound] = useState<RoundDetail | null>(null)
  const [scoreboard, setScoreboard] = useState<ScoreboardRow[]>([])
  const [error, setError] = useState('')
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<RoundResult | null>(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setError('')
    try {
      const s = await fetchMatchState(matchId)
      setState(s)
      const board = await fetchScoreboard(matchId).catch(() => [])
      setScoreboard(board)
      if (s.current_round) {
        const r = await fetchCurrentRoundDetail(matchId, s.current_round.round_order)
        setRound(r)
      } else {
        setRound(null)
      }
    } catch (e: any) {
      setError(e.message ?? 'Could not load the match.')
    }
  }

  useEffect(() => { load() }, [matchId])

  const submit = async () => {
    if (!round || !answer.trim()) return
    setBusy(true)
    setError('')
    try {
      const r = await submitRound(round.id, answer)
      setResult(r)
    } catch (e: any) {
      setError(e.message ?? 'Could not submit that answer.')
    } finally {
      setBusy(false)
    }
  }

  const refresh = () => { setResult(null); setAnswer(''); load() }

  if (!state) {
    return <div className="centered-loading">Loading match…</div>
  }

  return (
    <div className="dash-main">
      <div className="section-heading">
        <h1>{state.title}</h1>
        <button className="btn btn-secondary" onClick={onBack}>Back to dashboard</button>
      </div>
      {error && <div className="banner banner-error">{error}</div>}
      <p className="muted">{state.participant_count} players · status: {state.status}</p>

      {state.status === 'completed' ? (
        <div className="banner banner-info">This match has ended.</div>
      ) : round ? (
        <>
          <div className="section-heading"><h2>Round {state.current_round?.round_order}</h2></div>
          <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{round.prompt}</p>

          {round.config?.choices ? (
            <div className="list-panel">
              {round.config.choices.map((choice) => (
                <button
                  key={choice}
                  className="list-row"
                  style={{ width: '100%', border: 'none', textAlign: 'left', cursor: result ? 'default' : 'pointer', background: answer === choice ? 'var(--gold-soft)' : 'transparent' }}
                  onClick={() => !result && setAnswer(choice)}
                  disabled={!!result}
                >
                  <span className="list-row-title">{choice}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="field">
              <input value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={!!result} placeholder="Your answer" />
            </div>
          )}

          {!result ? (
            <button className="btn btn-primary" onClick={submit} disabled={busy || !answer.trim()}>Submit answer</button>
          ) : (
            <>
              <div className={`banner ${result.is_correct ? 'banner-info' : 'banner-error'}`}>
                {result.is_correct === null ? 'Answer submitted.' : result.is_correct ? 'Correct.' : 'Not quite.'} {result.feedback}
              </div>
              <button className="btn btn-primary" onClick={refresh}>Check for next round</button>
            </>
          )}
        </>
      ) : (
        <div className="banner banner-info">
          Waiting for the next round to open.
          <div style={{ marginTop: '0.6rem' }}>
            <button className="btn btn-secondary" onClick={refresh}>Refresh</button>
          </div>
        </div>
      )}

      <div className="section-heading"><h2>Scoreboard</h2></div>
      {scoreboard.length === 0 ? (
        <div className="empty-panel">Scores will appear once the match is underway.</div>
      ) : (
        <div className="list-panel">
          {scoreboard.map((row) => (
            <div className="list-row" key={row.user_id}>
              <div className="list-row-title">#{row.rank} {row.full_name ?? 'Player'}</div>
              <span className="pill">{row.score} pts</span>
            </div>
          ))}
        </div>
      )}

      <button className="btn btn-secondary" onClick={onLeave}>Leave match view</button>
    </div>
  )
}
