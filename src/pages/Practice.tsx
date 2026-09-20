import { useEffect, useState } from 'react'
import {
  fetchTopics, startSession, fetchSessionQuestions, submitResponse, completeSession,
  type PracticeTopic, type PracticeQuestion, type SubmitResult, type SessionSummary,
} from '../lib/practice'

type View =
  | { stage: 'topics' }
  | { stage: 'loading_session' }
  | { stage: 'in_session'; sessionId: string; questions: PracticeQuestion[]; index: number; questionStartedAt: number; result: SubmitResult | null; selected: string | null }
  | { stage: 'complete'; summary: SessionSummary }

export default function Practice({ onBack }: { onBack: () => void }) {
  const [topics, setTopics] = useState<PracticeTopic[] | null>(null)
  const [error, setError] = useState('')
  const [view, setView] = useState<View>({ stage: 'topics' })

  useEffect(() => {
    fetchTopics().then(setTopics).catch((e) => setError(e.message ?? 'Could not load topics.'))
  }, [])

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
    if (view.stage !== 'in_session' || view.result) return
    const current = view.questions[view.index]
    const timeSpent = Math.round((Date.now() - view.questionStartedAt) / 1000)
    setView({ ...view, selected: choice })
    try {
      const result = await submitResponse(view.sessionId, current.question_id, choice, timeSpent)
      setView((v) => (v.stage === 'in_session' ? { ...v, result, selected: choice } : v))
    } catch (e: any) {
      setError(e.message ?? 'Could not submit that answer.')
    }
  }

  const nextQuestion = async () => {
    if (view.stage !== 'in_session') return
    const isLast = view.index + 1 >= view.questions.length
    if (isLast) {
      try {
        const summary = await completeSession(view.sessionId)
        setView({ stage: 'complete', summary })
      } catch (e: any) {
        setError(e.message ?? 'Could not finish the session.')
      }
      return
    }
    setView({ ...view, index: view.index + 1, questionStartedAt: Date.now(), result: null, selected: null })
  }

  if (view.stage === 'topics') {
    return (
      <div className="dash-main">
        <div className="section-heading">
          <h1>Practice</h1>
          <button className="btn btn-secondary" onClick={onBack}>Back to dashboard</button>
        </div>
        {error && <div className="banner banner-error">{error}</div>}
        {!topics && !error && <p className="muted">Loading topics…</p>}
        {topics && topics.length === 0 && <div className="empty-panel">No practice topics are published yet.</div>}
        {topics && topics.length > 0 && (
          <div className="list-panel">
            {topics.map((t) => (
              <div className="list-row" key={t.id}>
                <div>
                  <div className="list-row-title">{t.topic}</div>
                  <div className="list-row-meta">{t.subject}{t.grade_level ? ` · Grade ${t.grade_level}` : ''}</div>
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
                disabled={!!view.result}
              >
                <span className="list-row-title">{choice}</span>
              </button>
            )
          })}
        </div>
        {view.result && (
          <div className={`banner ${view.result.is_correct ? 'banner-info' : 'banner-error'}`}>
            {view.result.is_correct ? 'Correct.' : 'Not quite.'} {view.result.feedback}
          </div>
        )}
        {view.result && (
          <button className="btn btn-primary" onClick={nextQuestion}>
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
      <button className="btn btn-primary" onClick={onBack}>Back to dashboard</button>
    </div>
  )
}
