import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Program = {
  program_key: string
  subject_title: string
  grade_level: number | null
  track_key: string
  stage_key: string
}

type Question = {
  id: string
  question_number: number
  prompt: string
  choices: string[] | null
  question_type: string
}

export default function QuestionBank({ onBack }: { onBack: () => void }) {
  const [programs, setPrograms] = useState<Program[]>([])
  const [program, setProgram] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)
  const [count, setCount] = useState(10)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) return
      const { data: profile } = await supabase.from('profiles').select('education_stage_key,grade_level').eq('id', auth.user.id).maybeSingle()
      if (!profile?.education_stage_key) return
      let query = supabase
        .from('mela_learning_programs')
        .select('program_key,subject_title,grade_level,track_key,stage_key')
        .eq('active', true)
        .eq('stage_key', profile.education_stage_key)
        .order('subject_title')
      if (profile.grade_level) query = query.eq('grade_level', profile.grade_level)
      const { data, error } = await query
      if (error) { setError(error.message); return }
      const rows = (data ?? []) as Program[]
      setPrograms(rows)
      if (rows[0]) setProgram(rows[0].program_key)
    }
    load()
  }, [])

  const start = async () => {
    if (!program) return
    setBusy(true); setError(''); setResult(null); setAnswers({})
    try {
      const { data, error } = await supabase.rpc('start_mela_question_session', {
        p_program_key: program, p_count: count, p_difficulty: null, p_seed: null,
      })
      if (error) throw error
      setSessionId(data.session_id)
      setQuestions((data.questions ?? []) as Question[])
    } catch (e: any) {
      setError(e.message ?? 'Could not start the question session.')
    } finally { setBusy(false) }
  }

  const submit = async () => {
    if (!sessionId || questions.length === 0) return
    setBusy(true); setError('')
    try {
      const { data, error } = await supabase.rpc('submit_mela_question_session', {
        p_session_id: sessionId, p_answers: answers,
      })
      if (error) throw error
      setResult(data)
    } catch (e: any) {
      setError(e.message ?? 'Could not submit the session.')
    } finally { setBusy(false) }
  }

  if (result) {
    return (
      <div className="dash-main">
        <div className="section-heading"><h1>Question Bank Result</h1><button className="btn btn-secondary" onClick={onBack}>Back</button></div>
        <div className="stat-strip">
          <div><span className="stat-value">{result.score_percent ?? result.score ?? '—'}</span><span className="stat-label">Score</span></div>
          <div><span className="stat-value">{result.correct ?? '—'}</span><span className="stat-label">Correct</span></div>
        </div>
        <button className="btn btn-primary" onClick={() => { setResult(null); setSessionId(null); setQuestions([]); setAnswers({}) }}>Start another session</button>
      </div>
    )
  }

  return (
    <div className="dash-main">
      <div className="section-heading"><h1>Curriculum Question Bank</h1><button className="btn btn-secondary" onClick={onBack}>Back</button></div>
      <p className="muted">These sessions use the production MELA question bank, filtered to your grade and curriculum program.</p>
      {error && <div className="banner banner-error">{error}</div>}

      {!sessionId ? (
        <>
          <div className="field">
            <label htmlFor="program">Subject</label>
            <select id="program" value={program} onChange={e => setProgram(e.target.value)}>
              {programs.map(p => <option key={p.program_key} value={p.program_key}>{p.subject_title}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="count">Questions per session</label>
            <select id="count" value={count} onChange={e => setCount(Number(e.target.value))}>
              {[8,10,15,20,30].map(n => <option key={n} value={n}>{n} questions</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={start} disabled={busy || !program}>{busy ? 'Loading questions…' : 'Start practice'}</button>
        </>
      ) : (
        <>
          <div className="section-heading"><h2>{questions.length} Questions</h2></div>
          {questions.map((q, i) => (
            <div className="list-panel" key={q.id} style={{ marginBottom: '1rem' }}>
              <div className="list-row-title">Question {i + 1}</div>
              <p>{q.prompt}</p>
              {(q.choices ?? []).map(choice => (
                <button
                  key={choice}
                  className="list-row"
                  style={{ width: '100%', textAlign: 'left', border: 'none', background: answers[q.id] === choice ? 'var(--gold-soft)' : 'transparent' }}
                  onClick={() => setAnswers(a => ({ ...a, [q.id]: choice }))}
                >{choice}</button>
              ))}
              {!(q.choices?.length) && (
                <input value={answers[q.id] ?? ''} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} placeholder="Your answer" />
              )}
            </div>
          ))}
          <button className="btn btn-primary" onClick={submit} disabled={busy || Object.keys(answers).length < questions.length}>
            {busy ? 'Submitting…' : 'Submit session'}
          </button>
        </>
      )}
    </div>
  )
}
