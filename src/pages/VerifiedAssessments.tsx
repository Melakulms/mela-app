import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useI18n } from '../i18n'

type Assessment = {
  id: string
  title: string
  description: string | null
  instructions: string | null
  duration_minutes: number
  pass_score: number
  question_count: number
  max_attempts: number
  is_proctored: boolean
}

type Attempt = {
  id: string
  assessment_id: string
  attempt_no: number
  status: string
  started_at: string
  submitted_at: string | null
  duration_seconds: number | null
  score: number | null
  passed: boolean | null
  proctored: boolean
  proctor_status: string
}

type Question = {
  question_id?: string
  id?: string
  prompt?: string
  question_text?: string
  text?: string
  choices?: unknown[]
  options?: unknown[]
}

type SubmissionResult = {
  id: string
  status: string
  score: number | null
  passed: boolean | null
  proctor_status: string | null
  duration_seconds: number | null
  submitted_at: string | null
}

const errorMessage = (cause: unknown, fallback: string) => cause instanceof Error ? cause.message : fallback

function attemptLabel(attempt: Attempt) {
  if (attempt.status === 'review_required') return attempt.passed ? `Passed ${attempt.score ?? 0}% · review pending` : `Score ${attempt.score ?? 0}% · review pending`
  if (attempt.status === 'void') return 'Void'
  if (attempt.status === 'graded') return attempt.passed ? `Passed ${attempt.score ?? 0}%` : `Score ${attempt.score ?? 0}%`
  if (attempt.status === 'in_progress') return 'In progress'
  return attempt.status.replaceAll('_', ' ')
}

function formatRemaining(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

async function checkCameraPermission() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access is not supported by this browser. Use a modern browser with camera permission to take a verified assessment.')
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
  stream.getTracks().forEach(track => track.stop())
}

async function sendProctorEvent(attemptId: string, eventType: string, details: Record<string, unknown> = {}) {
  try {
    await supabase.functions.invoke('mela-proctor', {
      body: { action: 'event', attempt_id: attemptId, event_type: eventType, details },
    })
  } catch {
    // Integrity telemetry is best-effort. Submission/grading remains server-authoritative.
  }
}

export default function VerifiedAssessments({ onBack }: { onBack: () => void }) {
  const { t } = useI18n()
  const [assessments, setAssessments] = useState<Assessment[] | null>(null)
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [selected, setSelected] = useState<Assessment | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    setError('')
    setAssessments(null)
    void (async () => {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        if (!auth.user) throw new Error('Please sign in again.')
        const [catalog, history] = await Promise.all([
          supabase.from('skill_assessments')
            .select('id,title,description,instructions,duration_minutes,pass_score,question_count,max_attempts,is_proctored')
            .eq('status', 'published').order('created_at', { ascending: false }),
          supabase.from('assessment_attempts')
            .select('id,assessment_id,attempt_no,status,started_at,submitted_at,duration_seconds,score,passed,proctored,proctor_status')
            .eq('user_id', auth.user.id).order('started_at', { ascending: false }),
        ])
        if (catalog.error) throw catalog.error
        if (history.error) throw history.error
        if (!active) return
        setAssessments((catalog.data ?? []) as Assessment[])
        setAttempts((history.data ?? []) as Attempt[])
      } catch (cause) {
        if (active) setError(errorMessage(cause, 'Could not load verified assessments.'))
      }
    })()
    return () => { active = false }
  }, [revision])

  if (selected) {
    return <AssessmentSession
      assessment={selected}
      priorAttempts={attempts.filter(attempt => attempt.assessment_id === selected.id)}
      onBack={() => setSelected(null)}
      onFinished={() => { setSelected(null); setRevision(value => value + 1) }}
    />
  }

  return <div className="dash-main">
    <div className="section-heading"><h1>{t('verifiedAssessments')}</h1><button className="btn btn-secondary" onClick={onBack}>{t('back')}</button></div>
    <p className="muted">Verified assessments use server-side scoring and integrity controls. Proctored results become verified Career Passport evidence only after integrity review clears the attempt.</p>
    {error && <div className="banner banner-error" role="alert">{error}<button className="btn btn-secondary" onClick={() => setRevision(value => value + 1)}>Retry</button></div>}
    {!assessments && !error && <div className="centered-loading" role="status">Loading verified assessments…</div>}
    {assessments?.length === 0 && <div className="empty-panel">No verified assessments are published right now.</div>}
    {assessments && assessments.length > 0 && <div className="list-panel">
      {assessments.map(assessment => {
        const own = attempts.filter(attempt => attempt.assessment_id === assessment.id)
        const inProgress = own.find(attempt => attempt.status === 'in_progress')
        const attemptsUsed = own.length
        return <div className="list-row" key={assessment.id}>
          <div>
            <div className="list-row-title">{assessment.title}</div>
            <div className="list-row-meta">{assessment.question_count} questions · {assessment.duration_minutes} min · pass {assessment.pass_score}% · {attemptsUsed}/{assessment.max_attempts} attempts used</div>
            {assessment.is_proctored && <div className="list-row-meta">Proctored · explicit consent and camera permission required · no video is recorded by this assessment screen</div>}
            {assessment.description && <p className="muted">{assessment.description}</p>}
          </div>
          <button className="btn btn-primary" onClick={() => setSelected(assessment)} disabled={!inProgress && attemptsUsed >= assessment.max_attempts}>
            {inProgress ? 'Resume' : attemptsUsed >= assessment.max_attempts ? 'Attempts used' : 'Open'}
          </button>
        </div>
      })}
    </div>}

    {attempts.length > 0 && <>
      <div className="section-heading"><h2>My assessment history</h2></div>
      <div className="list-panel">
        {attempts.slice(0, 20).map(attempt => {
          const title = assessments?.find(item => item.id === attempt.assessment_id)?.title ?? 'Assessment'
          return <div className="list-row" key={attempt.id}>
            <div><div className="list-row-title">{title}</div><div className="list-row-meta">Attempt {attempt.attempt_no} · {new Date(attempt.started_at).toLocaleString()}</div></div>
            <span className="pill">{attemptLabel(attempt)}</span>
          </div>
        })}
      </div>
    </>}
  </div>
}

function AssessmentSession({ assessment, priorAttempts, onBack, onFinished }: {
  assessment: Assessment
  priorAttempts: Attempt[]
  onBack: () => void
  onFinished: () => void
}) {
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [consentChecked, setConsentChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<SubmissionResult | null>(null)
  const [now, setNow] = useState(Date.now())
  const lock = useRef(false)

  const remainingMs = useMemo(() => {
    if (!attempt) return assessment.duration_minutes * 60_000
    const started = new Date(attempt.started_at).getTime()
    return Math.max(0, started + assessment.duration_minutes * 60_000 - now)
  }, [attempt, assessment.duration_minutes, now])

  useEffect(() => {
    if (!attempt || result) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [attempt, result])

  useEffect(() => {
    if (!attempt?.proctored || result) return
    const visibility = () => void sendProctorEvent(attempt.id, document.hidden ? 'tab_hidden' : 'tab_visible', { hidden: document.hidden })
    const blur = () => void sendProctorEvent(attempt.id, 'window_blur')
    const focus = () => void sendProctorEvent(attempt.id, 'window_focus')
    const online = () => void sendProctorEvent(attempt.id, 'network_change', { online: true })
    const offline = () => void sendProctorEvent(attempt.id, 'network_change', { online: false })
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('blur', blur)
    window.addEventListener('focus', focus)
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    return () => {
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('blur', blur)
      window.removeEventListener('focus', focus)
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  }, [attempt, result])

  const persistAnswer = useCallback(async (questionId: string, response: unknown) => {
    if (!attempt) return
    const { error: saveError } = await supabase.from('assessment_responses').upsert(
      { attempt_id: attempt.id, question_id: questionId, response },
      { onConflict: 'attempt_id,question_id' },
    )
    if (saveError) setError('Your answer could not be autosaved. It will be retried when you submit.')
  }, [attempt])

  const openAttempt = async () => {
    if (lock.current) return
    if (assessment.is_proctored && !consentChecked) {
      setError('Confirm the proctoring consent before starting or resuming this verified assessment.')
      return
    }
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!auth.user) throw new Error('Please sign in again.')

      if (assessment.is_proctored) {
        const { data: acknowledged, error: checkError } = await supabase.rpc('has_current_policy_acknowledgement', { p_policy_key: 'proctoring' })
        if (checkError) throw checkError
        if (!acknowledged) {
          const { error: consentError } = await supabase.rpc('record_my_policy_acknowledgement', {
            p_policy_key: 'proctoring',
            p_accept: true,
            p_metadata: { source: 'learner_assessment_ui' },
          })
          if (consentError) throw consentError
        }
        try {
          await checkCameraPermission()
        } catch (cause) {
          throw new Error(`Camera permission is required for this proctored assessment. ${errorMessage(cause, 'Allow camera access and retry.')}`)
        }
      }

      const { data: existing, error: attemptsError } = await supabase.from('assessment_attempts')
        .select('id,assessment_id,attempt_no,status,started_at,submitted_at,duration_seconds,score,passed,proctored,proctor_status')
        .eq('assessment_id', assessment.id).eq('user_id', auth.user.id).order('attempt_no', { ascending: false })
      if (attemptsError) throw attemptsError

      let current = ((existing ?? []) as Attempt[]).find(row => row.status === 'in_progress') ?? null
      if (!current) {
        if ((existing ?? []).length >= assessment.max_attempts) throw new Error('You have reached the maximum number of attempts for this assessment.')
        const { data: created, error: createError } = await supabase.from('assessment_attempts')
          .insert({ assessment_id: assessment.id, user_id: auth.user.id })
          .select('id,assessment_id,attempt_no,status,started_at,submitted_at,duration_seconds,score,passed,proctored,proctor_status').single()
        if (createError) throw createError
        current = created as Attempt
      }
      if (!current) throw new Error('The assessment attempt could not be opened.')

      if (assessment.is_proctored) {
        void sendProctorEvent(current.id, 'camera_permission', { granted: true, source: 'permission_check' })
      }

      const [questionResponse, savedResponse] = await Promise.all([
        supabase.rpc('get_assessment_attempt_questions_localized', { p_attempt_id: current.id }),
        supabase.from('assessment_responses').select('question_id,response').eq('attempt_id', current.id),
      ])
      if (questionResponse.error) throw questionResponse.error
      if (savedResponse.error) throw savedResponse.error
      const rows = (Array.isArray(questionResponse.data) ? questionResponse.data : questionResponse.data?.questions ?? []) as Question[]
      if (!rows.length) throw new Error('No assessment questions are available. Retry or contact support.')

      setAttempt(current)
      setQuestions(rows)
      setAnswers(Object.fromEntries((savedResponse.data ?? []).map(row => [row.question_id, row.response])))
      setNow(Date.now())
    } catch (cause) {
      setError(errorMessage(cause, 'Could not open this assessment. Retry to resume your attempt.'))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  const submit = async () => {
    if (!attempt || lock.current) return
    const expired = remainingMs <= 0
    if (!expired && questions.some(question => {
      const id = question.question_id ?? question.id ?? ''
      const value = answers[id]
      return value == null || String(value).trim() === ''
    })) {
      setError('Answer every question before submitting.')
      return
    }

    lock.current = true
    setBusy(true)
    setError('')
    try {
      for (const [questionId, response] of Object.entries(answers)) {
        const { error: saveError } = await supabase.from('assessment_responses').upsert(
          { attempt_id: attempt.id, question_id: questionId, response },
          { onConflict: 'attempt_id,question_id' },
        )
        if (saveError) throw saveError
      }
      const { data, error: submitError } = await supabase.rpc('submit_my_assessment_attempt', { p_attempt_id: attempt.id })
      if (submitError) throw submitError
      const submitted = data as SubmissionResult
      setResult(submitted)
      if (submitted.status === 'review_required') {
        void supabase.functions.invoke('mela-proctor', { body: { action: 'status', attempt_id: attempt.id } }).catch(() => {})
      }
    } catch (cause) {
      setError(errorMessage(cause, 'Could not submit. Your saved answers remain available to retry.'))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  if (result) {
    const message = result.status === 'review_required'
      ? `Submitted with score ${result.score ?? 0}%. Proctor review is pending. A verified skill is issued only if the review clears this attempt.`
      : result.status === 'void'
        ? 'This attempt was finalized as void because the server time limit was exceeded. No score or verified skill was issued.'
        : result.passed
          ? `Passed with ${result.score ?? 0}%. Your verified assessment evidence has been processed.`
          : `Submitted with score ${result.score ?? 0}%. This attempt did not meet the passing score.`
    return <div className="dash-main">
      <div className="section-heading"><h1>{assessment.title}</h1></div>
      <div className={result.status === 'void' ? 'banner banner-error' : 'banner banner-info'} role="status">{message}</div>
      <button className="btn btn-primary" onClick={onFinished}>Return to assessments</button>
    </div>
  }

  if (!attempt) {
    return <div className="dash-main">
      <div className="section-heading"><h1>{assessment.title}</h1><button className="btn btn-secondary" onClick={onBack}>{t('back')}</button></div>
      <p className="muted">{assessment.instructions ?? assessment.description}</p>
      <div className="stat-strip">
        <div><span className="stat-value">{assessment.question_count}</span><span className="stat-label">Questions</span></div>
        <div><span className="stat-value">{assessment.duration_minutes}</span><span className="stat-label">Minutes</span></div>
        <div><span className="stat-value">{assessment.max_attempts}</span><span className="stat-label">Attempts</span></div>
      </div>
      {assessment.is_proctored && <div className="banner banner-info">
        <strong>Proctored assessment.</strong> MELA will ask for camera permission as an integrity readiness check and record assessment activity signals such as tab/window visibility and network changes. This screen stops the camera stream immediately after the permission check and does not record video. Passing scores become verified skills only after proctor review clears the attempt.
      </div>}
      {assessment.is_proctored && <label style={{ display: 'flex', gap: '.65rem', alignItems: 'flex-start', margin: '1rem 0' }}>
        <input type="checkbox" checked={consentChecked} onChange={event => setConsentChecked(event.target.checked)} disabled={busy} />
        <span>I consent to the current MELA Assessment & Proctoring policy for this verified assessment.</span>
      </label>}
      {error && <div className="banner banner-error" role="alert">{error}</div>}
      <button className="btn btn-primary" onClick={openAttempt} disabled={busy || (assessment.is_proctored && !consentChecked)}>
        {busy ? 'Preparing assessment…' : priorAttempts.some(item => item.status === 'in_progress') ? 'Resume assessment' : 'Start assessment'}
      </button>
    </div>
  }

  const expired = remainingMs <= 0
  return <div className="dash-main">
    <div className="section-heading">
      <h1>{assessment.title}</h1>
      <button className="btn btn-secondary" disabled={busy} onClick={onBack}>Save & exit</button>
    </div>
    <div className={expired ? 'banner banner-error' : 'banner banner-info'} role="status">
      {expired ? 'Time has expired. Finalize the attempt now; the server will mark it void.' : `Time remaining: ${formatRemaining(remainingMs)}`}
    </div>
    {attempt.proctored && <p className="muted">Integrity monitoring is active for tab/window visibility and network changes. Verification remains pending until proctor review clears the submitted attempt.</p>}
    {error && <div className="banner banner-error" role="alert">{error}</div>}
    <div className="list-panel">
      {questions.map((question, index) => {
        const id = question.question_id ?? question.id ?? `question-${index}`
        const choices = question.choices ?? question.options ?? []
        return <div className="list-row" key={id}>
          <div style={{ width: '100%' }}>
            <div className="list-row-title">{index + 1}. {question.prompt ?? question.question_text ?? question.text}</div>
            <div className="field">
              {Array.isArray(choices) && choices.length > 0 ? choices.map((choice, choiceIndex) => {
                const item = choice as any
                const value = typeof choice === 'string' ? choice : item.id ?? item.value ?? item.text
                const label = typeof choice === 'string' ? choice : item.text ?? item.label ?? String(value)
                return <label key={`${id}-${choiceIndex}`} style={{ display: 'block', margin: '.45rem 0' }}>
                  <input
                    disabled={busy || expired}
                    type="radio"
                    name={id}
                    checked={answers[id] === value}
                    onChange={() => {
                      setAnswers(previous => ({ ...previous, [id]: value }))
                      void persistAnswer(id, value)
                    }}
                  /> {label}
                </label>
              }) : <textarea
                aria-label={`Answer question ${index + 1}`}
                disabled={busy || expired}
                value={String(answers[id] ?? '')}
                onChange={event => setAnswers(previous => ({ ...previous, [id]: event.target.value }))}
                onBlur={() => void persistAnswer(id, answers[id] ?? '')}
              />}
            </div>
          </div>
        </div>
      })}
    </div>
    <button className="btn btn-primary" onClick={submit} disabled={busy}>
      {busy ? 'Submitting…' : expired ? 'Finalize expired attempt' : 'Submit assessment'}
    </button>
  </div>
}
