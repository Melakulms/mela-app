import { safeExternalUrl } from '../lib/external-url'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

type ReviewMode = 'chapters' | 'questions'
type ChapterDecision = 'approved' | 'needs_changes' | 'blocked_source'
type QuestionDecision = 'approved' | 'changes_required'

type ChapterQueueItem = {
  queue_id: string
  chapter_id: string
  program_key: string
  grade_level: number
  subject_key: string
  chapter_number: number
  chapter_title: string
  source_state: string
  review_type: string
  priority: number
  status: string
  assigned_to_me: boolean
  assigned: boolean
  assigned_at?: string | null
  reviewed_at?: string | null
  reviewer_requirement?: string | null
}

type ChapterDetail = {
  task: ChapterQueueItem & { reviewer_note?: string | null }
  chapter: {
    chapter_key: string
    chapter_number: number
    title: string
    title_local?: string | null
    description: string
    learning_outcomes: unknown
    source_name?: string | null
    source_url?: string | null
    source_kind: string
    source_verified: boolean
    official_alignment_status: string
    status: string
  }
  topics: Array<{
    id: string
    topic_number?: string | null
    title: string
    title_local?: string | null
    description?: string | null
    learning_objectives: unknown
    source_verified: boolean
    status: string
  }>
  materials: Array<{
    id: string
    material_key: string
    material_type: string
    title: string
    summary?: string | null
    pedagogical_role?: string | null
    language_code?: string | null
    access_tier?: string | null
    estimated_minutes?: number | null
    downloadable?: boolean
    low_bandwidth_ready?: boolean
    status: string
    editorial_status?: string | null
  }>
  history: Array<{ decision: string; note: string; reviewed_at: string }>
}

type QuestionSlice = {
  slice_id: number
  program_key: string
  grade_level?: number
  subject_title?: string
  slice_number: number
  question_count: number
  status: string
  assigned_to?: string | null
  reviewed_at?: string | null
}

type Question = {
  id: string
  question_number: number
  question_type: string
  prompt: string
  choices: unknown
  difficulty?: number | null
  cognitive_level?: string | null
  validation_status?: string | null
  machine_quality_score?: number | null
  grading_kind?: string | null
  correct_response: unknown
  accepted_variants: unknown
  tolerance: unknown
  rationale?: string | null
  existing_decision?: QuestionDecision | null
  existing_note?: string | null
}

type QuestionSliceDetail = {
  slice_id: number
  program_key: string
  slice_number: number
  status: string
  questions: Question[]
}

type QuestionReviewDraft = { decision: QuestionDecision | ''; note: string; attempted?: string; checked?: boolean }

const display = (value: unknown) => {
  if (value == null || value === '') return '—'
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}

const errorMessage = (cause: unknown) => {
  const message = cause && typeof cause === 'object' && 'message' in cause ? String(cause.message) : String(cause ?? '')
  if (/verified educator subject access required/i.test(message)) {
    return 'Content review requires a verified, active educator profile linked to a verified education partner and matching subject access.'
  }
  return message || 'The review request could not be completed.'
}

export default function EducatorContentReview() {
  const actionPending = useRef(false)
  const [mode, setMode] = useState<ReviewMode>('chapters')
  const [eligible, setEligible] = useState<boolean | null>(null)
  const [accessError, setAccessError] = useState('')
  const [accessRevision, setAccessRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [revision, setRevision] = useState(0)

  const [chapterStatus, setChapterStatus] = useState('pending')
  const [chapterItems, setChapterItems] = useState<ChapterQueueItem[]>([])
  const [chapterSummary, setChapterSummary] = useState<Record<string, number>>({})
  const [chapterDetail, setChapterDetail] = useState<ChapterDetail | null>(null)
  const [chapterDecision, setChapterDecision] = useState<ChapterDecision | ''>('')
  const [chapterNote, setChapterNote] = useState('')

  const [gradeFilter, setGradeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [pageCursor, setPageCursor] = useState(0)
  const [pageHistory, setPageHistory] = useState<number[]>([])
  const [nextCursor, setNextCursor] = useState<number | null>(null)
  const [queueTotals, setQueueTotals] = useState({slices:0,questions:0})
  const [programFilter, setProgramFilter] = useState('')
  const [programOptions, setProgramOptions] = useState<{program_key: string; subject_title: string; grade_level: number | null}[]>([])
  const [programError, setProgramError] = useState('')
  const [questionSlices, setQuestionSlices] = useState<QuestionSlice[]>([])
  const [questionDetail, setQuestionDetail] = useState<QuestionSliceDetail | null>(null)
  const [questionDrafts, setQuestionDrafts] = useState<Record<string, QuestionReviewDraft>>({})

  useEffect(() => {
    let active = true
    const check = async () => {
      setEligible(null); setAccessError('')
      setChapterDetail(null); setQuestionDetail(null); setQuestionDrafts({})
      try {
        const { data, error } = await supabase.rpc('can_review_questions_v18')
        if (error) throw error
        if (active) setEligible(data === true)
      } catch (cause) {
        if (active) setAccessError(errorMessage(cause))
      }
    }
    void check()
    return () => { active = false }
  }, [accessRevision])

  useEffect(() => {
    if (!eligible) return
    let active = true
    setProgramError('')
    void (async () => {
      try {
        const rows: {program_key: string; subject_title: string; grade_level: number | null}[] = []
        for (let offset = 0; ; offset += 200) {
          const { data, error } = await supabase.from('mela_learning_programs').select('program_key,subject_title,grade_level').eq('active', true).order('program_key').range(offset, offset + 199)
          if (error) throw error
          rows.push(...(data ?? []))
          if (!active) return
          if ((data ?? []).length < 200) break
        }
        if (active) setProgramOptions(rows)
      } catch (cause) { if (active) setProgramError(errorMessage(cause)) }
    })()
    return () => { active = false }
  }, [eligible, revision])

  useEffect(() => {
    if (!eligible) return
    let active = true
    const load = async () => {
      setBusy(true); setError('')
      setChapterItems([]); setChapterSummary({}); setQuestionSlices([])
      try {
        if (mode === 'chapters') {
          const { data, error } = await supabase.rpc('get_chapter_review_queue', {
            p_program_key: null,
            p_status: chapterStatus || null,
            p_limit: 100,
          })
          if (error) throw error
          if (!active) return
          const payload = (data ?? {}) as { items?: ChapterQueueItem[]; summary?: Record<string, number> }
          setChapterItems(Array.isArray(payload.items) ? payload.items : [])
          setChapterSummary(payload.summary ?? {})
        } else {
          const { data, error } = await supabase.rpc('get_question_review_queue_v19', { p_program_key: programFilter || null, p_grade: gradeFilter ? Number(gradeFilter) : null, p_status: statusFilter || null, p_after: pageCursor, p_limit: 50 })
          if (error) throw error
          if (!active) return
          setQuestionSlices(Array.isArray(data?.items) ? data.items as QuestionSlice[] : [])
          setNextCursor(data?.next_after ?? null)
          setQueueTotals({slices:data?.total_slices ?? 0,questions:data?.total_questions ?? 0})
        }
      } catch (cause) { if (active) setError(errorMessage(cause)) }
      finally { if (active) setBusy(false) }
    }
    void load()
    return () => { active = false }
  }, [eligible, mode, chapterStatus, programFilter, gradeFilter, statusFilter, pageCursor, revision])

  const openChapter = async (item: ChapterQueueItem) => {
    if (busy || actionPending.current) return
    actionPending.current = true
    setBusy(true); setError(''); setSuccess('')
    try {
      const { data, error } = await supabase.rpc('get_chapter_review_item', { p_queue_id: item.queue_id })
      if (error) throw error
      setChapterDetail(data as ChapterDetail)
      setChapterDecision('')
      setChapterNote('')
    } catch (cause) { setError(errorMessage(cause)) }
    finally { actionPending.current = false; setBusy(false) }
  }

  const claimChapter = async () => {
    if (!chapterDetail) return
    if (busy || actionPending.current) return
    actionPending.current = true
    setBusy(true); setError(''); setSuccess('')
    try {
      const { error } = await supabase.rpc('claim_chapter_review', { p_queue_id: chapterDetail.task.queue_id })
      if (error) throw error
      const { data, error: detailError } = await supabase.rpc('get_chapter_review_item', { p_queue_id: chapterDetail.task.queue_id })
      if (detailError) throw detailError
      setChapterDetail(data as ChapterDetail)
      setSuccess('This review task is assigned to you.')
      setRevision(value => value + 1)
    } catch (cause) { setError(errorMessage(cause)) }
    finally { actionPending.current = false; setBusy(false) }
  }

  const submitChapter = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!chapterDetail || !chapterDecision || chapterNote.trim().length < 5) return
    if (busy || actionPending.current) return
    actionPending.current = true
    setBusy(true); setError(''); setSuccess('')
    try {
      const { error } = await supabase.rpc('submit_chapter_review', {
        p_queue_id: chapterDetail.task.queue_id,
        p_decision: chapterDecision,
        p_note: chapterNote.trim(),
      })
      if (error) throw error
      setSuccess('Chapter review saved with an audit history.')
      setChapterDetail(null); setChapterDecision(''); setChapterNote('')
      setRevision(value => value + 1)
    } catch (cause) { setError(errorMessage(cause)) }
    finally { actionPending.current = false; setBusy(false) }
  }

  const openQuestionSlice = async (slice: QuestionSlice) => {
    if (busy || actionPending.current) return
    actionPending.current = true
    setBusy(true); setError(''); setSuccess('')
    try {
      const { data, error } = await supabase.rpc('get_question_review_slice_v18', { p_slice_id: slice.slice_id })
      if (error) throw error
      const detail = data as QuestionSliceDetail
      setQuestionDetail(detail)
      setQuestionDrafts(Object.fromEntries((detail.questions ?? []).map(question => [question.id, {
        decision: '',
        note: question.existing_note ?? '',
      }])))
    } catch (cause) { setError(errorMessage(cause)) }
    finally { actionPending.current = false; setBusy(false) }
  }

  const updateQuestion = (id: string, patch: Partial<QuestionReviewDraft>) => {
    setQuestionDrafts(current => ({ ...current, [id]: { ...(current[id] ?? { decision: '', note: '' }), ...patch } }))
  }

  const reviewedCount = useMemo(() => Object.values(questionDrafts).filter(draft => draft.decision).length, [questionDrafts])

  const submitQuestionSlice = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!questionDetail) return
    const decisions = questionDetail.questions.flatMap(question => {
      const draft = questionDrafts[question.id]
      if (!draft?.decision) return []
      if (draft.decision === 'changes_required' && draft.note.trim().length < 5) return []
      return [{ question_id: question.id, decision: draft.decision, note: draft.decision === 'approved' ? (`Teacher test response: ${draft.attempted?.trim()}\nVerification: ${draft.note.trim()}`).slice(0, 2000) : draft.note.trim() || null }]
    })
    if (questionDetail.questions.some(q => { const d = questionDrafts[q.id]; return d?.decision === 'approved' && (!d.attempted?.trim() || !d.checked || d.note.trim().length < 5) })) { setError('For each approval, test the question, check the grading evidence, confirm the review checklist and write a verification note.'); return }
    if (!decisions.length) { setError('Review at least one question before saving.'); return }
    const invalidChanges = questionDetail.questions.some(question => {
      const draft = questionDrafts[question.id]
      return draft?.decision === 'changes_required' && draft.note.trim().length < 5
    })
    if (invalidChanges) { setError('Explain every “changes required” decision with at least 5 characters.'); return }

    if (busy || actionPending.current) return
    actionPending.current = true
    setBusy(true); setError(''); setSuccess('')
    try {
      const { error } = await supabase.rpc('review_question_slice_v18', { p_slice_id: questionDetail.slice_id, p_decisions: decisions })
      if (error) throw error
      setSuccess(`${decisions.length} question review decision${decisions.length === 1 ? '' : 's'} saved.`)
      setQuestionDetail(null); setQuestionDrafts({})
      setRevision(value => value + 1)
    } catch (cause) { setError(errorMessage(cause)) }
    finally { actionPending.current = false; setBusy(false) }
  }

  if (accessError) return <section><h2>Educator content review</h2><p role="alert">Could not check reviewer access: {accessError}</p><button className="btn btn-secondary" onClick={() => setAccessRevision(value => value + 1)}>Retry access check</button></section>

  if (eligible === null) return <section><div className="section-heading"><h2>Educator content review</h2></div><p className="muted">Checking reviewer access…</p></section>

  if (!eligible) return <section>
    <div className="section-heading"><h2>Educator content review</h2></div>
    <div className="empty-panel">
      <strong>Reviewer access is not active for this account.</strong>
      <p className="muted">MELA accepts teacher review decisions only after an administrator verifies the teacher profile and authorises the relevant subjects. Register as a teacher and save your qualifications, institution, subjects and grades first.</p>
      <p>Ask an authorized administrator to open Central Admin → Moderation → Teacher reviewer verification and inspect your qualification, institution, subjects and grade levels. After approval, recheck access below. An administrator account alone does not represent a verified subject teacher.</p>
      <button className="btn btn-secondary" onClick={() => setAccessRevision(value => value + 1)}>Recheck teacher review access</button>
    </div>
  </section>

  return <section aria-label="Educator content review">
    <div className="section-heading"><div><h2>Educator content review</h2><p className="muted">Help clear MELA’s launch content review backlog. Decisions are identity-bound and auditable.</p></div></div>
    <div className="toolbar" role="tablist" aria-label="Content review type">
      <button className={`btn ${mode === 'chapters' ? 'btn-primary' : 'btn-secondary'}`} role="tab" disabled={busy} aria-selected={mode === 'chapters'} onClick={() => { setMode('chapters'); setChapterDetail(null); setQuestionDetail(null); setError(''); setSuccess('') }}>Chapter reviews</button>
      <button className={`btn ${mode === 'questions' ? 'btn-primary' : 'btn-secondary'}`} role="tab" disabled={busy} aria-selected={mode === 'questions'} onClick={() => { setMode('questions'); setChapterDetail(null); setQuestionDetail(null); setError(''); setSuccess('') }}>Question reviews</button>
      <button className="btn btn-secondary" onClick={() => { setAccessRevision(value => value + 1); setRevision(value => value + 1) }} disabled={busy}>Refresh</button>
    </div>
    {error && <div className="banner banner-error" role="alert">{error}</div>}
    {success && <div className="banner banner-info" role="status">{success}</div>}

    {mode === 'chapters' && !chapterDetail && <>
      <div className="stat-strip">
        <div><span className="stat-value">{chapterSummary.eligible_total ?? 0}</span><span className="stat-label">Eligible tasks</span></div>
        <div><span className="stat-value">{chapterSummary.pending ?? 0}</span><span className="stat-label">Pending</span></div>
        <div><span className="stat-value">{chapterSummary.in_progress ?? 0}</span><span className="stat-label">In review</span></div>
        <div><span className="stat-value">{chapterSummary.approved ?? 0}</span><span className="stat-label">Approved</span></div>
      </div>
      <div className="toolbar">
        <label>Show <select value={chapterStatus} onChange={event => setChapterStatus(event.target.value)} disabled={busy}>
          <option value="pending">Pending</option><option value="in_progress">In progress</option><option value="needs_changes">Needs changes</option><option value="blocked_source">Blocked source</option><option value="approved">Approved</option><option value="">All eligible</option>
        </select></label>
      </div>
      {busy ? <p className="muted">Loading chapter reviews…</p> : chapterItems.length === 0 ? <div className="empty-panel">No eligible chapter reviews match this filter.</div> :
        <div className="list-panel">{chapterItems.map(item => <div className="list-row" key={item.queue_id}>
          <div><strong className="list-row-title">Grade {item.grade_level} · {item.chapter_title}</strong><div className="muted">{item.subject_key} · Chapter {item.chapter_number} · {item.source_state} · {item.status.replaceAll('_',' ')}</div></div>
          <button className="btn btn-secondary" onClick={() => void openChapter(item)} disabled={busy}>{item.assigned_to_me ? 'Continue review' : 'Inspect'}</button>
        </div>)}</div>}
    </>}

    {mode === 'chapters' && chapterDetail && <div>
      <button className="btn btn-secondary" onClick={() => setChapterDetail(null)} disabled={busy}>Back to chapter queue</button>
      <div className="section-heading"><div><h3>Grade {chapterDetail.task.grade_level} · {chapterDetail.chapter.title}</h3><p className="muted">{chapterDetail.task.subject_key} · Chapter {chapterDetail.chapter.chapter_number} · {chapterDetail.chapter.official_alignment_status}</p></div></div>
      <div className={`banner ${chapterDetail.chapter.source_verified ? 'banner-info' : 'banner-error'}`} role="status">Source {chapterDetail.chapter.source_verified ? 'verified' : 'not verified'} · {chapterDetail.chapter.source_kind}{chapterDetail.chapter.source_name ? ` · ${chapterDetail.chapter.source_name}` : ''}</div>
      {safeExternalUrl(chapterDetail.chapter.source_url) && <p><a href={safeExternalUrl(chapterDetail.chapter.source_url)!} target="_blank" rel="noreferrer">Open source reference ↗</a></p>}
      <div className="list-panel"><div className="list-row"><div><strong>Description</strong><p>{chapterDetail.chapter.description || 'No description.'}</p></div></div><div className="list-row"><div><strong>Learning outcomes</strong><pre className="review-data">{display(chapterDetail.chapter.learning_outcomes)}</pre></div></div></div>
      <div className="section-heading"><h3>Topics ({chapterDetail.topics.length})</h3></div>
      <div className="list-panel">{chapterDetail.topics.map(topic => <div className="list-row" key={topic.id}><div><strong>{topic.topic_number ? `${topic.topic_number} · ` : ''}{topic.title}</strong><p className="muted">{topic.description || 'No description'} · source {topic.source_verified ? 'verified' : 'unverified'} · {topic.status}</p><pre className="review-data">{display(topic.learning_objectives)}</pre></div></div>)}</div>
      <div className="section-heading"><h3>Materials ({chapterDetail.materials.length})</h3></div>
      <div className="list-panel">{chapterDetail.materials.map(material => <div className="list-row" key={material.id}><div><strong>{material.title}</strong><p className="muted">{material.material_type} · {material.editorial_status ?? material.status} · {material.language_code ?? 'language not set'} · {material.low_bandwidth_ready ? 'low-bandwidth ready' : 'standard bandwidth'}</p><p>{material.summary || 'No summary.'}</p></div></div>)}</div>
      {chapterDetail.history.length > 0 && <><div className="section-heading"><h3>Previous review decisions</h3></div><div className="list-panel">{chapterDetail.history.map((entry, index) => <div className="list-row" key={`${entry.reviewed_at}-${index}`}><div><strong>{entry.decision.replaceAll('_',' ')}</strong><p>{entry.note}</p><span className="muted">{new Date(entry.reviewed_at).toLocaleString()}</span></div></div>)}</div></>}
      {!chapterDetail.task.assigned_to_me ? <button className="btn btn-primary" onClick={() => void claimChapter()} disabled={busy || chapterDetail.task.status === 'approved' || chapterDetail.task.assigned}>Claim this review</button> :
        <form onSubmit={submitChapter} className="review-form"><div className="field"><label htmlFor="chapter-decision">Decision</label><select id="chapter-decision" value={chapterDecision} onChange={event => setChapterDecision(event.target.value as ChapterDecision | '')} required disabled={busy}><option value="">Choose a decision</option><option value="approved">Approve</option><option value="needs_changes">Needs changes</option><option value="blocked_source">Blocked by source</option></select></div><div className="field"><label htmlFor="chapter-note">Review note</label><textarea id="chapter-note" value={chapterNote} onChange={event => setChapterNote(event.target.value)} required minLength={5} maxLength={4000} disabled={busy} placeholder="Record what you checked and why you made this decision." /></div><button className="btn btn-primary" disabled={busy || !chapterDecision || chapterNote.trim().length < 5}>{busy ? 'Saving…' : 'Save chapter review'}</button></form>}
    </div>}

    {mode === 'questions' && !questionDetail && <>
      <label>Review subject / program<select value={programFilter} disabled={busy} onChange={e => {setProgramFilter(e.target.value);setPageCursor(0);setPageHistory([])}}><option value="">All eligible subjects</option>{programOptions.filter(p=>!gradeFilter||p.grade_level===Number(gradeFilter)).map(p => <option key={p.program_key} value={p.program_key}>Grade {p.grade_level ?? '—'} · {p.subject_title} · {p.program_key}</option>)}</select></label>
      {programError && <p role="alert">Subject list unavailable: {programError}</p>}
      <div className="toolbar">
        <label>Grade filter<select value={gradeFilter} disabled={busy} onChange={e=>{setGradeFilter(e.target.value);setProgramFilter('');setPageCursor(0);setPageHistory([])}}><option value="">All eligible grades</option>{Array.from({length:12},(_,i)=>i+1).map(n=><option key={n} value={n}>Grade {n}</option>)}</select></label>
        <label>Review status<select value={statusFilter} disabled={busy} onChange={e=>{setStatusFilter(e.target.value);setPageCursor(0);setPageHistory([])}}><option value="">All statuses</option>{['pending','assigned','in_review','changes_required','approved'].map(v=><option key={v} value={v}>{v.replaceAll('_',' ')}</option>)}</select></label>
      </div>
      <p role="status">{queueTotals.questions.toLocaleString()} questions in {queueTotals.slices.toLocaleString()} eligible review batches. Page {pageHistory.length+1} · {questionSlices.length} batches shown.</p>
      <div className="toolbar"><button className="btn btn-secondary" disabled={busy||!pageHistory.length} onClick={()=>{setPageCursor(pageHistory[pageHistory.length-1]);setPageHistory(h=>h.slice(0,-1))}}>Previous batches</button><button className="btn btn-secondary" disabled={busy||nextCursor===null} onClick={()=>{if(nextCursor!==null){setPageHistory(h=>[...h,pageCursor]);setPageCursor(nextCursor)}}}>Next batches</button></div>
      <p className="muted">Review slices are subject-scoped. Only slices matching your verified educator subject areas are shown.</p>
      {busy ? <p className="muted">Loading question review slices…</p> : questionSlices.length === 0 ? <div className="empty-panel">No eligible question-review slices are available for this educator profile.</div> : <div className="list-panel">{questionSlices.map(slice => <div className="list-row" key={slice.slice_id}><div><strong className="list-row-title">Grade {slice.grade_level ?? '—'} · {slice.subject_title ?? slice.program_key}</strong><div className="muted">Slice {slice.slice_number} · {slice.question_count} questions · {slice.status.replaceAll('_',' ')}</div></div><button className="btn btn-secondary" onClick={() => void openQuestionSlice(slice)} disabled={busy}>Open slice</button></div>)}</div>}
    </>}

    {mode === 'questions' && questionDetail && <form onSubmit={submitQuestionSlice}>
      <button type="button" className="btn btn-secondary" onClick={() => { setQuestionDetail(null); setQuestionDrafts({}) }} disabled={busy}>Back to question slices</button>
      <div className="section-heading"><div><h3>Question review · Slice {questionDetail.slice_number}</h3><p className="muted">{questionDetail.program_key} · {reviewedCount}/{questionDetail.questions.length} decisions prepared. You may save a partial review and continue later.</p></div></div>
      <div className="review-question-list">{questionDetail.questions.map(question => {
        const draft = questionDrafts[question.id] ?? { decision: '', note: '' }
        return <article className="review-question" key={question.id}>
          <div className="section-heading"><h4>Question {question.question_number}</h4><span className="pill-stat">{question.question_type} · quality {question.machine_quality_score ?? '—'}</span></div>
          <p><strong>{question.prompt}</strong></p>{question.existing_decision && <p>Previous decision: {question.existing_decision.replaceAll('_', ' ')}. A new decision requires a fresh human test.</p>}
          {question.choices != null && <><span className="muted">Choices</span><pre className="review-data">{display(question.choices)}</pre></>}
          <label htmlFor={`attempt-${question.id}`}>Test the question yourself before viewing the key</label><textarea id={`attempt-${question.id}`} maxLength={500} disabled={busy} value={draft.attempted ?? ''} onChange={event => updateQuestion(question.id, { attempted: event.target.value, checked: false })} />
          {draft.attempted?.trim() && <details><summary>Show grading evidence</summary><dl className="review-dl"><dt>Grading kind</dt><dd>{display(question.grading_kind)}</dd><dt>Correct response</dt><dd><pre className="review-data">{display(question.correct_response)}</pre></dd><dt>Accepted variants</dt><dd><pre className="review-data">{display(question.accepted_variants)}</pre></dd><dt>Rationale</dt><dd>{question.rationale || '—'}</dd></dl></details>}
          <label><input type="checkbox" disabled={busy || !draft.attempted?.trim()} checked={draft.checked ?? false} onChange={e => updateQuestion(question.id, {checked: e.target.checked})} /> I checked correctness, answer variants, explanation, grade suitability, language, fairness and source rights. This is my own human review.</label>
          <div className="field"><label htmlFor={`decision-${question.id}`}>Decision</label><select id={`decision-${question.id}`} value={draft.decision} onChange={event => updateQuestion(question.id, { decision: event.target.value as QuestionDecision | '' })} disabled={busy}><option value="">Not reviewed yet</option><option value="approved">Approve</option><option value="changes_required">Changes required</option></select></div>
          <div className="field"><label htmlFor={`note-${question.id}`}>Reviewer note (required for every decision)</label><textarea id={`note-${question.id}`} value={draft.note} onChange={event => updateQuestion(question.id, { note: event.target.value })} disabled={busy} maxLength={2000} placeholder="Describe any correction needed or record a useful verification note." /></div>
        </article>
      })}</div>
      <button className="btn btn-primary" disabled={busy || reviewedCount === 0}>{busy ? 'Saving decisions…' : `Save ${reviewedCount} review decision${reviewedCount === 1 ? '' : 's'}`}</button>
    </form>}
  </section>
}
