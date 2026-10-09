import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useI18n } from '../i18n'

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
  choices: (string | { id: string; text: string })[] | null
  question_type: string
}

export default function QuestionBank({ onBack }: { onBack: () => void }) {
  const { t } = useI18n()
  const [programs, setPrograms] = useState<Program[]>([])
  const [grade, setGrade] = useState<number | null>(null)
  const [program, setProgram] = useState('')
  const [track, setTrack] = useState('common')
  const [chapters, setChapters] = useState<{ chapter_id: string; chapter_title: string; mastery_count: number; topics: { topic_id: string; topic_title: string; mastery_count: number }[] }[]>([])
  const [chapter, setChapter] = useState('')
  const [topic, setTopic] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [inventory, setInventory] = useState<{ mastery_count: number; review_required_count: number } | null>(null)
  const requestLock = useRef(false)
  const visiblePrograms = programs.filter(p => p.track_key === track)

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
        if (!Number.isInteger(profile.grade_level) || profile.grade_level < 1 || profile.grade_level > 12 || !String(profile.education_stage_key).startsWith('school_')) throw new Error('Complete your school grade in Profile to access the curriculum Question Bank.')
        let query = supabase.from('mela_learning_programs')
          .select('program_key,subject_title,grade_level,track_key,stage_key')
          .eq('active', true).eq('stage_key', profile.education_stage_key)
        if (profile.grade_level) query = query.eq('grade_level', profile.grade_level)
        const { data, error } = await query.order('subject_title')
        if (error) throw error
        if (!active) return
        const rows = (data ?? []) as Program[]
        setGrade(profile.grade_level); setPrograms(rows); setTrack(rows[0]?.track_key ?? 'common'); setProgram(rows[0]?.program_key ?? '')
      } catch (error) {
        if (active) setError(error instanceof Error ? error.message : 'Could not load your subjects. Please try again.')
      } finally { if (active) setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [revision])

  useEffect(() => {
    let active = true
    setChapter(''); setTopic(''); setChapters([]); setInventory(null); setDetailError('')
    if (!program) return
    setDetailLoading(true)
    Promise.resolve(supabase.rpc('get_question_subject_detail_v18', { p_program_key: program })).then(({ data, error }) => {
      if (!active) return
      if (error) setDetailError(error.message)
      else { setChapters(data?.chapters ?? []); setInventory(data?.program ?? null) }
      setDetailLoading(false)
    }).catch((e: Error) => { if (active) { setDetailError(e.message); setDetailLoading(false) } })
    return () => { active = false }
  }, [program, revision])

  const start = async () => {
    if (!program || requestLock.current || detailLoading || detailError) return
    requestLock.current = true
    setBusy(true); setError(''); setResult(null); setAnswers({})
    try {
      const { data, error } = await supabase.rpc('start_mela_filtered_question_session_v18', {
        p_program_key: program, p_chapter_id: chapter || null, p_topic_id: topic || null, p_count: count, p_difficulty: difficulty ? Number(difficulty) : null, p_practice_mode: 'mastery',
      })
      if (error) throw error
      if (!data?.session_id || !data.questions?.length) throw new Error('No questions are available for this subject yet. Choose another subject.')
      setSessionId(data.session_id)
      setQuestions((data.questions ?? []) as Question[])
    } catch (e: any) {
      setError(e.message ?? 'Could not start the question session.')
    } finally { requestLock.current = false; setBusy(false) }
  }

  const submit = async () => {
    if (!sessionId || requestLock.current || questions.length === 0 || answeredCount < questions.length) return
    requestLock.current = true
    setBusy(true); setError('')
    try {
      const { data, error } = await supabase.rpc('submit_mela_question_session_v12', {
        p_session_id: sessionId, p_answers: questions.map(q => ({ question_id: q.id, response: answers[q.id] })),
      })
      if (error) throw error
      setResult(data)
    } catch (e: any) {
      setError(e.message ?? 'Could not submit the session.')
    } finally { requestLock.current = false; setBusy(false) }
  }

  if (result) {
    return (
      <div className="dash-main">
        <div className="section-heading"><h1>Question Bank Result</h1><button className="btn btn-secondary" onClick={onBack}>{t('back')}</button></div>
        <div className="stat-strip">
          <div><span className="stat-value">{result.score_percent ?? result.score ?? '—'}</span><span className="stat-label">Score (%)</span></div>
          <div><span className="stat-value">{result.correct_count ?? '—'}</span><span className="stat-label">Correct</span></div>
        </div>
        {(result.details ?? []).map((detail: { question_id: string; correct: boolean; rationale: string }, index: number) => <div className="list-panel question-card" key={detail.question_id}><h2>Question {index + 1}: {detail.correct ? 'Correct' : 'Review'}</h2><p>{detail.rationale}</p></div>)}
        <button className="btn btn-primary" onClick={() => { setResult(null); setSessionId(null); setQuestions([]); setAnswers({}) }}>Start another session</button>
      </div>
    )
  }

  return (
    <div className="dash-main">
      <div className="section-heading"><h1>{t('questionBank')}</h1><button className="btn btn-secondary" onClick={onBack}>{t('back')}</button></div>
      <p className="muted">Practice at your own pace with questions matched to your {grade ? `Grade ${grade}` : "education"} curriculum.</p>
      {error && <div className="banner banner-error" role="alert">{error}</div>}

      {loading && <p role="status">Loading your subjects…</p>}
      {!loading && !sessionId && error && <button className="btn btn-secondary" onClick={() => setRevision(value => value + 1)}>Reload subjects</button>}
      {!loading && !error && programs.length === 0 && <div className="empty-panel">No subjects are available for your curriculum yet. Check back soon or update your education details in Profile.</div>}
      {!sessionId ? (
        <>
          {grade && grade >= 11 && <div className="field"><label htmlFor="track">Academic track</label><select id="track" disabled={busy} value={track} onChange={e => { const next = e.target.value; setTrack(next); setProgram(programs.find(p => p.track_key === next)?.program_key ?? '') }}>{[...new Set(programs.map(p => p.track_key))].map(key => <option key={key} value={key}>{key.replaceAll('_', ' ')}</option>)}</select></div>}
          <div className="field">
            <label htmlFor="program">Subject</label>
            <select disabled={loading || busy || !programs.length} id="program" value={program} onChange={e => setProgram(e.target.value)}>
              {visiblePrograms.map(p => <option key={p.program_key} value={p.program_key}>{p.subject_title}</option>)}
            </select>
          </div>
          {detailLoading && <p role="status">Loading chapters…</p>}
          {detailError && <div role="alert">{detailError}<button className="btn btn-secondary" onClick={() => setRevision(v => v + 1)}>Reload subjects</button></div>}
          {inventory && <p className="muted">{inventory.mastery_count} validated questions; {inventory.review_required_count} awaiting review. Availability depends on language and access.</p>}
          <div className="field"><label htmlFor="chapter">Chapter</label><select id="chapter" disabled={busy || detailLoading} value={chapter} onChange={e => { setChapter(e.target.value); setTopic('') }}><option value="">All chapters</option>{chapters.map(c => <option key={c.chapter_id} value={c.chapter_id}>{c.chapter_title} ({c.mastery_count} validated)</option>)}</select></div>
          <div className="field"><label htmlFor="topic">Topic</label><select id="topic" disabled={busy || !chapter} value={topic} onChange={e => setTopic(e.target.value)}><option value="">All topics</option>{(chapters.find(c => c.chapter_id === chapter)?.topics ?? []).map(t => <option key={t.topic_id} value={t.topic_id}>{t.topic_title} ({t.mastery_count} validated)</option>)}</select></div>
          <div className="field"><label htmlFor="difficulty">Difficulty</label><select id="difficulty" disabled={busy} value={difficulty} onChange={e => setDifficulty(e.target.value)}><option value="">All levels</option>{[1,2,3,4,5].map(n => <option key={n} value={n}>Level {n}</option>)}</select></div>
          <div className="field">
            <label htmlFor="count">Questions per session</label>
            <select disabled={busy} id="count" value={count} onChange={e => setCount(Number(e.target.value))}>
              {[5,8,10,15,20,30].map(n => <option key={n} value={n}>{n} questions</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={start} disabled={busy || !program || detailLoading || !!detailError || loading}>{busy ? 'Loading questions…' : 'Start practice'}</button>
        </>
      ) : (
        <>
          <div className="section-heading"><h2>{questions.length} Questions</h2><span role="status">{answeredCount} of {questions.length} answered</span></div><progress className="answer-progress" value={answeredCount} max={questions.length} aria-label="Questions answered" />
          {questions.map((q, i) => (
            <div className="list-panel question-card" key={q.id} style={{ marginBottom: '1rem' }}>
              <div className="list-row-title">Question {i + 1}</div>
              <p className="question-prompt" id={`question-${q.id}`}>{q.prompt}</p>
              {(q.choices ?? []).map(rawChoice => { const choice = typeof rawChoice === 'string' ? rawChoice : rawChoice.id; const label = typeof rawChoice === 'string' ? rawChoice : rawChoice.text; return (
                <button
                  key={choice}
                  className="answer-choice"
                  aria-pressed={answers[q.id] === choice}
                  disabled={busy}
                  onClick={() => setAnswers(a => ({ ...a, [q.id]: choice }))}
                >{label}</button>
              )})}
              {!(q.choices?.length) && (
                <input className="written-answer" type={q.question_type === 'numeric' ? 'number' : 'text'} step="any" aria-labelledby={`question-${q.id}`} disabled={busy} value={answers[q.id] ?? ''} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} placeholder="Your answer" />
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
