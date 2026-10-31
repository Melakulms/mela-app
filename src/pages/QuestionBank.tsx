import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useI18n } from '../i18n'
import { educationStageFor } from '../lib/education-profile'
import { ChapterStudyResources } from '../components/SchoolChapterLibrary'
import { eligibleSchoolPrograms, type CurriculumSubject } from '../lib/curriculum-access'
import { explainQuestionSessionError, isQuestionAvailabilityError } from '../lib/question-practice-ui'
import SchoolPracticeHistory from '../components/SchoolPracticeHistory'

type Program = {
  program_key: string
  subject_title: string
  subject_key: string
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

export default function QuestionBank({ onBack, onOpenProfile, workspace = false }: { onBack: () => void; onOpenProfile?: () => void; workspace?: boolean }) {
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
  const [layout, setLayout] = useState<'worksheet' | 'focus'>('worksheet')
  const [activeQuestion, setActiveQuestion] = useState(0)
  const [flagged, setFlagged] = useState<string[]>([])
  const [reviewOnly, setReviewOnly] = useState(false)
  const [chapterSearch, setChapterSearch] = useState('')
  const [completedRounds, setCompletedRounds] = useState(0)
  const [completedQuestions, setCompletedQuestions] = useState(0)
  const resetSession = () => { setResult(null); setSessionId(null); setQuestions([]); setAnswers({}); setFlagged([]); setActiveQuestion(0); setReviewOnly(false); setError('') }
  const leave = () => { if (!busy && (!sessionId || result || window.confirm('Leave this practice session? Unsubmitted answers will be lost.'))) onBack() }

  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const answeredCount = questions.filter(q => answers[q.id]?.trim()).length
  const noAccessibleQuestions = isQuestionAvailabilityError(error)
  const selectedChapter = chapters.find(c => c.chapter_id === chapter)
  const selectedTopic = selectedChapter?.topics.find(t => t.topic_id === topic)
  const candidateCount = topic ? selectedTopic?.mastery_count : chapter ? selectedChapter?.mastery_count : inventory?.mastery_count
  const hasOptionalFilters = Boolean(chapter || topic || difficulty)
  const [availableCount, setAvailableCount] = useState<number | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)


  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true); setError(''); setGrade(null); setPrograms([]); setProgram('')
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        if (!auth.user) throw new Error('Please sign in again to load your subjects.')
        const { data: profile, error: profileError } = await supabase.from('profiles').select('education_stage_key,grade_level').eq('id', auth.user.id).maybeSingle()
        if (profileError) throw profileError
        if (!profile?.education_stage_key) throw new Error('Complete your education profile to see your subjects.')
        const gradeFromProfile = profile.grade_level
        const stageForGrade = educationStageFor('school', gradeFromProfile)
        if (!stageForGrade || stageForGrade !== profile.education_stage_key) {
          throw new Error('Your saved school grade and education stage are missing or inconsistent. Complete or correct your education profile before using the curriculum Question Bank.')
        }
        const { data: learner, error: learnerError } = await supabase.from('student_profiles')
          .select('subjects').eq('user_id', auth.user.id).maybeSingle()
        if (learnerError) throw learnerError
        const enrolled = Array.isArray(learner?.subjects) ? learner.subjects as string[] : []
        if (enrolled.length === 0) throw new Error('Complete your curriculum subject enrollment in your education profile before practicing.')
        const { data: catalog, error: catalogError } = await supabase.from('mela_national_subject_catalog')
          .select('stage_key,track_key,subject_key,optional')
          .eq('stage_key', stageForGrade).eq('active', true)
        if (catalogError) throw catalogError
        let query = supabase.from('mela_learning_programs')
          .select('program_key,subject_key,subject_title,grade_level,track_key,stage_key')
          .eq('active', true).eq('stage_key', stageForGrade)
          .eq('grade_level', gradeFromProfile)
        const { data, error } = await query.order('subject_title')
        if (error) throw error
        if (!active) return
        const rows = (data ?? []) as Program[]
        if (rows.some(row => row.stage_key !== stageForGrade || row.grade_level !== gradeFromProfile)) {
          throw new Error('MELA received a curriculum outside your saved grade. No questions were loaded; contact support.')
        }
        const eligible = eligibleSchoolPrograms(rows, (catalog ?? []) as CurriculumSubject[], gradeFromProfile, stageForGrade, enrolled)
        if (!eligible.length) throw new Error('None of your Grade ' + gradeFromProfile + ' curriculum subjects are available for your enrolled subjects or academic stream. Review your education profile or ask verified MELA support to correct it.')
        setGrade(gradeFromProfile); setPrograms(eligible); setTrack(eligible[0]?.track_key ?? 'common'); setProgram(eligible[0]?.program_key ?? '')
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

  const start = async (wholeSubject = false) => {
    if (!program || !programs.some(p => p.program_key === program && p.track_key === track) || requestLock.current || detailLoading || detailError) return
    requestLock.current = true
    setBusy(true); setError(''); setResult(null); setAnswers({}); setFlagged([]); setActiveQuestion(0); setReviewOnly(false); setAvailableCount(null); setExpiresAt(null)
    if (wholeSubject) { setChapter(''); setTopic(''); setDifficulty('') }
    try {
      const { data, error } = await supabase.rpc('start_mela_filtered_question_session_v18', {
        p_program_key: program, p_chapter_id: wholeSubject ? null : chapter || null, p_topic_id: wholeSubject ? null : topic || null, p_count: count, p_difficulty: wholeSubject ? null : difficulty ? Number(difficulty) : null, p_practice_mode: 'mastery',
      })
      if (error) throw error
      if (!data?.session_id || !data.questions?.length) throw new Error('No questions are available for this subject yet. Choose another subject.')
      setAvailableCount(typeof data.available_count === 'number' ? data.available_count : null)
      setExpiresAt(typeof data.expires_at === 'string' && Number.isFinite(Date.parse(data.expires_at)) ? data.expires_at : null)
      setSessionId(data.session_id)
      setQuestions((data.questions ?? []) as Question[])
    } catch (e: any) {
      const message = e instanceof Error ? e.message : String(e?.message ?? 'Could not start the question session.')
      setError(explainQuestionSessionError(message))
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
      if (!data || typeof data !== 'object' || (!('score_percent' in data) && !('score' in data))) throw new Error('The server did not confirm your result. Please retry submitting.')
      setResult(data)
      setCompletedRounds(n => n + 1)
      setCompletedQuestions(n => n + questions.length)
    } catch (e: any) {
      setError(e.message ?? 'Could not submit the session.')
    } finally { requestLock.current = false; setBusy(false) }
  }

  if (result) {
    return (
      <div className="dash-main">
        <div className="section-heading"><h1>Question Bank Result</h1><button className="btn btn-secondary" onClick={leave}>{t('back')}</button></div>
        <div className="stat-strip">
          <div><span className="stat-value">{result.score_percent ?? result.score ?? '—'}</span><span className="stat-label">Score (%)</span></div>
          <div><span className="stat-value">{result.correct_count ?? '—'}</span><span className="stat-label">Correct</span></div>
        </div>
        <p role="status">{completedRounds} completed session{completedRounds === 1 ? '' : 's'} · {completedQuestions} questions submitted during this visit</p>
        <label><input type="checkbox" checked={reviewOnly} onChange={e => setReviewOnly(e.target.checked)} /> Show mistakes and flagged questions only</label>
        {(result.details ?? []).filter((detail: { question_id: string; correct: boolean }) => !reviewOnly || !detail.correct || flagged.includes(detail.question_id)).map((detail: { question_id: string; correct: boolean; rationale: string }, index: number) => <div className="list-panel question-card" key={detail.question_id}><h2>Question {questions.findIndex(q => q.id === detail.question_id) + 1 || index + 1}: {detail.correct ? 'Correct' : 'Review'}</h2><p>{questions.find(q => q.id === detail.question_id)?.prompt}</p><p>Your answer: {answers[detail.question_id]}</p><p>{detail.rationale}</p></div>)}
        <button className="btn btn-primary" onClick={resetSession}>Start another session</button>
        <button className="btn btn-secondary" disabled={busy} onClick={() => { setSessionId(null); setQuestions([]); void start() }}>Continue with the same subject and filters</button>
        <p className="field-hint">Each round is scored separately. New rounds may include questions you have seen before.</p>
      </div>
    )
  }

  return (
    <div className="dash-main">
      <div className="section-heading"><h1>{workspace ? 'Practice workspace' : t('questionBank')}</h1><button className="btn btn-secondary" onClick={leave}>{t('back')}</button></div>
      {grade !== null ? <p role="status" className="banner banner-info"><strong>Grade {grade} curriculum.</strong> MELA loaded your saved grade and enrolled subjects. Only subjects from your registered grade and academic stream are shown; grade changes require verified correction.</p> :
        <p className="muted">Your school grade must be saved in your education profile before curriculum questions are available.</p>}
      {error && <div className="banner banner-error" role="alert">{error}</div>}
      {!loading && grade === null && onOpenProfile && <button className="btn btn-primary" type="button" onClick={onOpenProfile}>Complete or correct my education profile</button>}
      {noAccessibleQuestions && !sessionId && hasOptionalFilters && <button type="button" className="btn btn-primary" disabled={busy || detailLoading || !!detailError} onClick={() => void start(true)}>Practise across this subject instead</button>}
      {noAccessibleQuestions && !sessionId && chapter && <p className="field-hint">You can still read this chapter's published study resources below while more questions are reviewed.</p>}
      {noAccessibleQuestions && (chapter || topic || difficulty) && !sessionId && (
        <button className="btn btn-secondary" type="button" onClick={() => { setChapter(''); setTopic(''); setDifficulty(''); setError('') }}>
          Clear chapter, topic and difficulty filters
        </button>
      )}

      {loading && <p role="status">Loading your subjects…</p>}
      {!loading && !sessionId && error && <button className="btn btn-secondary" onClick={() => setRevision(value => value + 1)}>Reload subjects</button>}
      {!loading && !error && programs.length === 0 && <div className="empty-panel">No subjects are available for your curriculum yet. Check back soon or update your education details in Profile.</div>}
      {!sessionId ? (
        <>
          <section className="list-panel question-card" aria-label="Practice guide"><h2>Learn, practise, review, repeat</h2><p>Explore your subjects and chapters, read the lesson, then practise at any available difficulty. Use focused questions or a full worksheet, flag questions to revisit, and review explanations after submission.</p><p>{programs.length} enrolled subject programs · {chapters.length} chapters in this subject</p></section>
          {grade !== null && programs.length > 0 && <SchoolPracticeHistory programs={programs} />}
          {grade && grade >= 11 && <div className="field"><label htmlFor="track">Enrolled academic stream</label><select id="track" disabled={busy} value={track} onChange={e => { const next = e.target.value; setTrack(next); setProgram(programs.find(p => p.track_key === next)?.program_key ?? ''); setError('') }}>{[...new Set(programs.map(p => p.track_key))].map(key => <option key={key} value={key}>{key.replaceAll('_', ' ')}</option>)}</select><p className="field-hint">Your enrolled subjects determine your stream. A stream correction needs verified MELA support.</p></div>}
          <div className="field">
            <label htmlFor="program">Subject</label>
            <select disabled={loading || busy || !programs.length} id="program" value={program} onChange={e => { setProgram(e.target.value); setError('') }}>
              {visiblePrograms.map(p => <option key={p.program_key} value={p.program_key}>{p.subject_title}</option>)}
            </select>
          </div>
          {visiblePrograms.length > 1 && <div aria-label="Explore subjects" style={{display:'flex', flexWrap:'wrap', gap:8, marginBottom:16}}>{visiblePrograms.map(p => <button type="button" key={p.program_key} className="btn btn-secondary" disabled={busy} aria-pressed={program === p.program_key} onClick={() => { setProgram(p.program_key); setError('') }}>{p.subject_title}</button>)}</div>}
          {detailLoading && <p role="status">Loading chapters…</p>}
          {detailError && <div role="alert">{detailError}<button className="btn btn-secondary" onClick={() => setRevision(v => v + 1)}>Reload subjects</button></div>}
          {inventory && <p className="muted">{inventory.mastery_count} automatically validated or educator-verified candidates; {inventory.review_required_count} awaiting review. Some questions require an entitlement, and automated validation is not professional teacher approval.</p>}
          <div className="field"><label htmlFor="chapter">Chapter</label><select id="chapter" disabled={busy || detailLoading} value={chapter} onChange={e => { setChapter(e.target.value); setTopic(''); setError('') }}><option value="">All chapters</option>{chapters.map(c => <option key={c.chapter_id} value={c.chapter_id}>{c.chapter_title} ({c.mastery_count} validated)</option>)}</select></div>
          {chapter && grade !== null && chapters.some(c => c.chapter_id === chapter) && <ChapterStudyResources
            chapterId={chapter}
            chapterTitle={chapters.find(c => c.chapter_id === chapter)!.chapter_title}
            grade={grade}
            stageKey={educationStageFor('school', grade)!}
          />}
          <div className="field"><label htmlFor="topic">Topic</label><select id="topic" disabled={busy || !chapter} value={topic} onChange={e => { setTopic(e.target.value); setError('') }}><option value="">All topics</option>{(chapters.find(c => c.chapter_id === chapter)?.topics ?? []).map(t => <option key={t.topic_id} value={t.topic_id}>{t.topic_title} ({t.mastery_count} validated)</option>)}</select></div>
          <div className="field"><label htmlFor="difficulty">Difficulty</label><select id="difficulty" disabled={busy} value={difficulty} onChange={e => { setDifficulty(e.target.value); setError('') }}><option value="">All levels</option>{[1,2,3,4,5].map(n => <option key={n} value={n}>Level {n}</option>)}</select></div>
          <div className="field"><label htmlFor="practice-layout">Practice layout</label><select id="practice-layout" value={layout} onChange={e => setLayout(e.target.value as 'worksheet' | 'focus')} disabled={busy}><option value="worksheet">Full worksheet — all questions</option><option value="focus">Focus — one question at a time</option></select></div>
          <div className="field">
            <label htmlFor="count">Questions per session</label>
            <select disabled={busy} id="count" value={count} onChange={e => setCount(Number(e.target.value))}>
              {[5,8,10,15,20,30].map(n => <option key={n} value={n}>{n} questions</option>)}
            </select>
          </div>
          {candidateCount != null && <p role="status" className="banner banner-info">{candidateCount} validated question candidates in {topic ? 'this topic' : chapter ? 'this chapter' : 'this subject'} before language, difficulty and access checks.{candidateCount < 5 ? ' A scored session needs at least five accessible questions. Try the whole subject or read the chapter resources.' : ' The session will use up to your requested number of accessible questions.'}</p>}
          {hasOptionalFilters && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => { setChapter(''); setTopic(''); setDifficulty(''); setError('') }}>Use all chapters, topics and difficulties</button>}
          <p className="field-hint">Sessions contain up to 30 questions. Continue with another round after reviewing your results to practise for longer.</p>
          {chapter && <p className="field-hint">This practice session uses the selected chapter. Read the free lesson and guided practice first. Question availability and entitlements remain checked by the server.</p>}
          <button className="btn btn-primary" onClick={() => void start()} disabled={busy || !program || detailLoading || !!detailError || loading}>{busy ? 'Loading questions…' : 'Start practice'}</button>
          {chapters.length > 0 && <section aria-label="Explore chapters" className="list-panel question-card">
            <h2>Explore every chapter</h2><div className="field"><label htmlFor="chapter-search">Find a chapter</label><input type="search" id="chapter-search" value={chapterSearch} onChange={e => setChapterSearch(e.target.value)} /></div>
            {chapters.filter(c => c.chapter_title.toLowerCase().includes(chapterSearch.toLowerCase().trim())).map(c => <div key={c.chapter_id} className="list-row"><div><strong>{c.chapter_title}</strong><p>{c.topics.length} topics · {c.mastery_count} validated candidates</p></div><button type="button" className="btn btn-secondary" disabled={busy} aria-pressed={chapter === c.chapter_id} onClick={() => { setChapter(c.chapter_id); setTopic(''); setError(''); document.getElementById('chapter')?.focus() }}>Study and practise</button></div>)}
            {!chapters.some(c => c.chapter_title.toLowerCase().includes(chapterSearch.toLowerCase().trim())) && <p role="status">No chapters match your search.</p>}
          </section>}
        </>
      ) : (
        <>
          <div className="section-heading"><h2>{questions.length} Questions</h2><span role="status">{answeredCount} of {questions.length} answered</span></div><progress className="answer-progress" value={answeredCount} max={questions.length} aria-label="Questions answered" />
          {availableCount !== null && <p role="status">{questions.length} questions selected from {availableCount} accessible questions matching your selection.</p>}
          {questions.length < count && <p className="field-hint">You requested {count}; this round contains the {questions.length} questions available for this selection.</p>}
          {expiresAt && <p className="field-hint">Submit before {new Date(expiresAt).toLocaleString()} (your device time zone). The server checks session expiry.</p>}
          <p className="muted">A score is saved only after you submit all answers. Leaving now will discard unsubmitted answers.</p>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => { if (window.confirm('Leave this practice session? Unsubmitted answers will be lost.')) { resetSession() } }}>Leave session</button>
          <nav aria-label="Question navigator" style={{display:'flex',flexWrap:'wrap',gap:8,margin:'16px 0'}}>{questions.map((q,i) => <button type="button" className="btn btn-secondary" key={q.id} disabled={busy} aria-current={activeQuestion === i ? 'step' : undefined} aria-label={`Question ${i+1}${answers[q.id]?.trim() ? ', answered' : ', unanswered'}${flagged.includes(q.id) ? ', flagged' : ''}`} onClick={() => { setActiveQuestion(i); if (layout === 'worksheet') document.getElementById(`card-${q.id}`)?.scrollIntoView?.({block:'center'}) }}>{i+1}{flagged.includes(q.id) ? ' ★' : answers[q.id]?.trim() ? ' ✓' : ''}</button>)}</nav>
          <button type="button" className="btn btn-secondary" disabled={busy || answeredCount === questions.length} onClick={() => { const i = questions.findIndex(q => !answers[q.id]?.trim()); if (i >= 0) { setActiveQuestion(i); if (layout === 'worksheet') document.getElementById(`card-${questions[i].id}`)?.scrollIntoView?.({block:'center'}) } }}>Go to first unanswered</button>
          {questions.map((q, i) => layout === 'focus' && i !== activeQuestion ? null : (

            <div className="list-panel question-card" id={`card-${q.id}`} key={q.id} style={{ marginBottom: '1rem' }}>
              <div className="list-row-title">Question {i + 1}</div>
              <button type="button" className="btn btn-secondary" disabled={busy} aria-pressed={flagged.includes(q.id)} onClick={() => setFlagged(ids => ids.includes(q.id) ? ids.filter(id => id !== q.id) : [...ids,q.id])}>{flagged.includes(q.id) ? 'Unflag question' : 'Flag for review'}</button>
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
          {layout === 'focus' && <div className="section-heading"><button type="button" className="btn btn-secondary" disabled={busy || activeQuestion === 0} onClick={() => setActiveQuestion(i => i-1)}>Previous question</button><button type="button" className="btn btn-secondary" disabled={busy || activeQuestion >= questions.length-1} onClick={() => setActiveQuestion(i => i+1)}>Next question</button></div>}
          <p role="status">{flagged.length} flagged for review. You can change any answer before submitting.</p>
          <button className="btn btn-primary" onClick={submit} disabled={busy || answeredCount < questions.length}>
            {busy ? 'Submitting…' : 'Submit session'}
          </button>
        </>
      )}
    </div>
  )
}
