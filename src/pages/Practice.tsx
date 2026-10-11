import { useI18n } from '../i18n'
import { useEffect, useRef, useState } from 'react'
import {
  fetchTopics, startSession, fetchSessionQuestions, submitResponse, completeSession,
  type PracticeTopic, type PracticeQuestion, type SubmitResult, type SessionSummary,
} from '../lib/practice'
import { fetchDashboard, type PracticeRecommendation } from '../lib/dashboard'
import { recommendPracticeTopics } from '../lib/personal-learning'
import type { StudentAudience } from '../lib/feature-audience'

type View =
  | { stage: 'topics' }
  | { stage: 'loading_session' }
  | { stage: 'in_session'; sessionId: string; questions: PracticeQuestion[]; index: number; questionStartedAt: number; result: SubmitResult | null; selected: string | null }
  | { stage: 'complete'; summary: SessionSummary }

export default function Practice({ onBack, onOpenQuestionBank, audience = { stage: null, grade: null } }: { onBack: () => void; onOpenQuestionBank?: () => void; audience?: StudentAudience }) {
  const { t } = useI18n()
  const [topics, setTopics] = useState<PracticeTopic[] | null>(null)
  const [recommendations, setRecommendations] = useState<PracticeRecommendation[]>([])
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [textAnswer, setTextAnswer] = useState('')
  const submitting = useRef(false)
  const [view, setView] = useState<View>({ stage: 'topics' })

  useEffect(() => {
    fetchTopics().then(setTopics).catch((e) => setError(e.message ?? 'Could not load topics.'))
    fetchDashboard().then((d) => setRecommendations(d.practice.recommendations)).catch(() => {})
  }, [])

  useEffect(() => {
    let active = true
    void import('../lib/learner-discovery').then(async ({ fetchLearnerDiscoveryProfile, fetchGradePrograms }) => {
      const settings = await fetchLearnerDiscoveryProfile()
      if (!settings.enable_suggestions || !audience.stage?.startsWith('school_') || !audience.grade) return
      const tracks = audience.grade >= 11 ? ['natural_sciences', 'social_sciences'] : ['common']
      const programs = (await Promise.all(tracks.map(track => fetchGradePrograms(audience.grade!, track)))).flat()
      const titles = programs.filter(program => settings.preferred_program_keys.includes(program.program_key)).map(program => program.subject_title)
      if (active) setSelectedSubjects(titles)
    }).catch(() => {
      // Server recommendations and grade-filtered practice remain available independently.
    })
    return () => { active = false }
  }, [audience.stage, audience.grade])

  const rankedTopics = recommendPracticeTopics(topics ?? [], selectedSubjects, recommendations.map(item => item.topic_id))
  const preferredTopics = rankedTopics.filter(row => row.score > 0)

  const beginTopic = async (topicId: string) => {
    setError('')
    setView({ stage: 'loading_session' })
    try {
      const sessionId = await startSession(topicId)
      const questions = await fetchSessionQuestions(sessionId)
      if (questions.length === 0) {
        setError('No questions are available for this topic yet.')
        setView({ stage: 'topics' })
        return
      }
      setView({ stage: 'in_session', sessionId, questions, index: 0, questionStartedAt: Date.now(), result: null, selected: null })
    } catch (e: any) {
      setError(e.message ?? 'Could not start a practice session.')
      setView({ stage: 'topics' })
    }
  }

  const pickAnswer = async (choice: string) => {
    if (view.stage !== 'in_session' || view.result || submitting.current || !choice.trim()) return
    submitting.current = true
    setBusy(true)
    setError('')
    const current = view.questions[view.index]
    const timeSpent = Math.round((Date.now() - view.questionStartedAt) / 1000)
    setView({ ...view, selected: choice })
    try {
      const result = await submitResponse(view.sessionId, current.question_id, choice, timeSpent)
      setView((v) => (v.stage === 'in_session' ? { ...v, result, selected: choice } : v))
    } catch (e: any) {
      setError(e.message ?? 'Could not submit that answer.')
    } finally { submitting.current = false; setBusy(false) }
  }

  const nextQuestion = async () => {
    if (view.stage !== 'in_session' || !view.result || submitting.current) return
    setError('')
    setTextAnswer('')
    const isLast = view.index + 1 >= view.questions.length
    if (isLast) {
      submitting.current = true; setBusy(true)
      try {
        const summary = await completeSession(view.sessionId)
        setView({ stage: 'complete', summary })
      } catch (e: any) {
        setError(e.message ?? 'Could not finish the session.')
      } finally { submitting.current = false; setBusy(false) }
      return
    }
    setView({ ...view, index: view.index + 1, questionStartedAt: Date.now(), result: null, selected: null })
  }

  if (view.stage === 'topics') {
    return (
      <div className="dash-main">
        <div className="section-heading">
          <h1>{t('practice')}</h1>
          <button className="btn btn-secondary" onClick={onBack}>{t('back')}</button>
        </div>
        {onOpenQuestionBank && <div className="list-panel question-card"><p>School learners: practice by grade, subject, chapter, and topic in the curriculum Question Bank.</p><button className="btn btn-primary" onClick={onOpenQuestionBank}>Open curriculum Question Bank</button></div>}
        {error && <div className="banner banner-error">{error}</div>}

        {preferredTopics.length > 0 && (
          <>
            <div className="section-heading"><h2>Recommended for you</h2></div>
            <div className="list-panel">
              {preferredTopics.map(({ topic: r, reasons }) => (
                <div className="list-row" key={r.id}>
                  <div>
                    <div className="list-row-title">{r.topic}</div>
                    <div className="list-row-meta">{r.subject} · {reasons.join(' · ')}</div>
                  </div>
                  <button className="btn btn-primary" onClick={() => beginTopic(r.id)}>Start</button>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="section-heading"><h2>All topics</h2></div>
        {!topics && !error && <p className="muted">Loading topics…</p>}
        {topics && topics.length === 0 && <div className="empty-panel">No additional practice topics are available for your education level. School curriculum practice is available in the Question Bank.</div>}
        {topics && topics.length > 0 && (
          <div className="list-panel">
            {rankedTopics.map(({ topic: t }) => (
              <div className="list-row" key={t.id}>
                <div>
                  <div className="list-row-title">{t.topic}</div>
                  <div className="list-row-meta">{t.subject}{t.grade_level === 'career' ? ' · Career skills' : t.grade_level ? ` · Grade ${t.grade_level}` : ''}</div>
                </div>
                <button className="btn btn-primary" onClick={() => beginTopic(t.id)}>Start</button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (view.stage === 'loading_session') {
    return <div className="centered-loading">Setting up your practice session…</div>
  }

  if (view.stage === 'in_session') {
    const q = view.questions[view.index]
    return (
      <div className="dash-main">
        <div className="section-heading">
          <h2>Question {view.index + 1} of {view.questions.length}</h2>
        </div>
        {error && <div className="banner banner-error">{error}</div>}
        <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{q.question}</p>
        <div className="list-panel">
          {(q.choices ?? []).map((choice) => {
            const isPicked = view.selected === choice
            const showResult = view.result && isPicked
            return (
              <button
                key={choice}
                className="list-row"
                style={{ width: '100%', border: 'none', textAlign: 'left', cursor: view.result ? 'default' : 'pointer', background: showResult ? (view.result?.is_correct ? '#eaf5ee' : '#fbeceb') : 'transparent' }}
                onClick={() => pickAnswer(choice)}
                disabled={busy || !!view.result}
              >
                <span className="list-row-title">{choice}</span>
              </button>
            )
          })}
        </div>
        {!q.choices?.length && <div className="field">
          <label htmlFor="practice-answer">Your answer</label>
          <input id="practice-answer" value={textAnswer} onChange={event => setTextAnswer(event.target.value)} disabled={busy || !!view.result} />
          {!view.result && <button className="btn btn-primary" disabled={busy || !textAnswer.trim()} onClick={() => void pickAnswer(textAnswer)}>Submit answer</button>}
        </div>}
        {busy && <p role="status">Saving…</p>}
        {view.result && (
          <div className={`banner ${view.result.is_correct ? 'banner-info' : 'banner-error'}`}>
            {view.result.is_correct == null ? 'Answer submitted.' : view.result.is_correct ? 'Correct.' : 'Not quite.'} {view.result.feedback}
          </div>
        )}
        {view.result && (
          <button className="btn btn-primary" onClick={nextQuestion} disabled={busy}>
            {view.index + 1 >= view.questions.length ? 'Finish session' : 'Next question'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="dash-main">
      <h1>Session complete</h1>
      <div className="stat-strip">
        <div><span className="stat-value">{Math.round(view.summary.score_percent)}%</span><span className="stat-label">Score</span></div>
        <div><span className="stat-value">{view.summary.correct}/{view.summary.answered}</span><span className="stat-label">Correct</span></div>
        <div><span className="stat-value">{view.summary.topic_mastery[0]?.mastery_level ?? '—'}</span><span className="stat-label">Mastery</span></div>
      </div>
      <button className="btn btn-primary" onClick={onBack}>{t('back')}</button>
    </div>
  )
}
