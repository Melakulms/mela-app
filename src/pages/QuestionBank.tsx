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
  const [grade, setGrade] = useState<number | null>(null)
  const [program, setProgram] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)
  const [count, setCount] = useState(10)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const answeredCount = questions.filter(q => answers[q.id]?.trim()).length

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true); setError('')
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        if (!auth.user) throw new Error('Please sign in again to load your subjects.')
        const { data: profile, error: profileError } = await supabase.from('profiles').select('education_stage_key,grade_level').eq('id', auth.user.id).maybeSingle()
        if (profileError) throw profileError
        if (!profile?.education_stage_key) throw new Error('Complete your education profile to see your subjects.')
        let query = supabase.from('mela_learning_programs')
          .select('program_key,subject_title,grade_level,track_key,stage_key')
          .eq('active', true).eq('stage_key', profile.education_stage_key).order('subject_title')
        if (profile.grade_level) query = query.eq('grade_level', profile.grade_level)
        const { data, error } = await query
        if (error) throw error
        if (!active) return
        const rows = (data ?? []) as Program[]
        setGrade(profile.grade_level ?? null); setPrograms(rows); setProgram(rows[0]?.program_key ?? '')
      } catch (error) {
        if (active) setError(error instanceof Error ? error.message : 'Could not load your subjects. Please try again.')
      } finally { if (active) setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [revision])

  const start = async () => {
    if (!program || busy) return
    setBusy(true); setError(''); setResult(null); setAnswers({})
    try {
      const { data, error } = await supabase.rpc('start_mela_question_session', {
        p_program_key: program, p_count: count, p_difficulty: null, p_seed: null,
      })
      if (error) throw error
      if (!data?.session_id || !data.questions?.length) throw new Error('No questions are available for this subject yet. Choose another subject.')
      setSessionId(data.session_id)
      setQuestions((data.questions ?? []) as Question[])
    } catch (e: any) {
      setError(e.message ?? 'Could not start the question session.')
    } finally { setBusy(false) }
  }

  const submit = async () => {
    if (!sessionId || busy || questions.length === 0 || answeredCount < questions.length) return
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
      <p className="muted">Practice at your own pace with questions matched to your {grade ? `Grade ${grade}` : "education"} curriculum.</p>
      {error && <div className="banner banner-error" role="alert">{error}</div>}

      {loading && <p role="status">Loading your subjects…</p>}
      {!loading && !sessionId && error && <button className="btn btn-secondary" onClick={() => setRevision(value => value + 1)}>Reload subjects</button>}
      {!loading && !error && programs.length === 0 && <div className="empty-panel">No subjects are available for your curriculum yet. Check back soon or update your education details in Profile.</div>}
      {!sessionId ? (
        <>
          <div className="field">
            <label htmlFor="program">Subject</label>
            <select disabled={loading || busy || !programs.length} id="program" value={program} onChange={e => setProgram(e.target.value)}>
              {programs.map(p => <option key={p.program_key} value={p.program_key}>{p.subject_title}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="count">Questions per session</label>
            <select disabled={busy} id="count" value={count} onChange={e => setCount(Number(e.target.value))}>
              {[8,10,15,20,30].map(n => <option key={n} value={n}>{n} questions</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={start} disabled={busy || !program}>{busy ? 'Loading questions…' : 'Start practice'}</button>
        </>
      ) : (
        <>
          <div className="section-heading"><h2>{questions.length} Questions</h2><span role="status">{answeredCount} of {questions.length} answered</span></div><progress className="answer-progress" value={answeredCount} max={questions.length} aria-label="Questions answered" />
          {questions.map((q, i) => (
            <div className="list-panel question-card" key={q.id} style={{ marginBottom: '1rem' }}>
              <div className="list-row-title">Question {i + 1}</div>
              <p className="question-prompt" id={`question-${q.id}`}>{q.prompt}</p>
              {(q.choices ?? []).map(choice => (
                <button
                  key={choice}
                  className="answer-choice"
                  aria-pressed={answers[q.id] === choice}
                  disabled={busy}
                  onClick={() => setAnswers(a => ({ ...a, [q.id]: choice }))}
                >{choice}</button>
              ))}
              {!(q.choices?.length) && (
                <input className="written-answer" aria-labelledby={`question-${q.id}`} disabled={busy} value={answers[q.id] ?? ''} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} placeholder="Your answer" />
              )}
            </div>
          ))}
          <button className="btn btn-primary" onClick={submit} disabled={busy || answeredCount < questions.length}>
            {busy ? 'Submitting…' : 'Submit session'}
          </button>
        </>
      )}
    </div>
  )
}
