import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

type Assignment = { id: string; assessment_id: string; assessment_title: string; category?: string; language_code: string; status: string; reviewer_notes?: string | null; assigned_at?: string; submitted_at?: string | null }
type ReviewQuestion = { question_id: string; question_order: number; source_prompt: string; source_choices: unknown; source_competency?: string | null; source_version: number; translated_prompt?: string | null; translated_choices?: unknown; translated_competency?: string | null; translation_status?: string | null; translation_model?: string | null }
type ReviewDetail = { assessment?: { title?: string; category?: string }; language_code: string; assignment?: Assignment | null; certification?: { status?: string } | null; questions: ReviewQuestion[] }

const labels: Record<string,string> = { am: 'Amharic', om: 'Afaan Oromo', ti: 'Tigrinya', so: 'Somali' }
const pretty = (value: unknown) => value == null ? '—' : typeof value === 'string' ? value : JSON.stringify(value, null, 2)

export default function AssessmentLanguageReview() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [detail, setDetail] = useState<ReviewDetail | null>(null)
  const [decision, setDecision] = useState<'approved' | 'changes_required' | ''>('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    const load = async () => {
      setBusy(true); setError('')
      try {
        const { data, error } = await supabase.rpc('get_my_assessment_language_review_assignments')
        if (error) throw error
        if (active) setAssignments(Array.isArray(data) ? data as Assignment[] : [])
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Language review assignments could not be loaded.') }
      finally { if (active) { setBusy(false); setLoaded(true) } }
    }
    void load()
    return () => { active = false }
  }, [revision])

  const open = async (assignment: Assignment) => {
    setBusy(true); setError(''); setSuccess('')
    try {
      const { data, error } = await supabase.rpc('get_my_assessment_language_review', { p_assessment_id: assignment.assessment_id, p_language_code: assignment.language_code })
      if (error) throw error
      setDetail(data as ReviewDetail)
      setDecision('')
      setNote(assignment.reviewer_notes ?? '')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Assessment language review could not be opened.') }
    finally { setBusy(false) }
  }

  const completeness = useMemo(() => {
    const questions = detail?.questions ?? []
    const complete = questions.filter(q => q.translated_prompt && q.translated_choices != null && q.source_version > 0).length
    return { complete, total: questions.length, ready: questions.length > 0 && complete === questions.length }
  }, [detail])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!detail?.assignment || !decision || note.trim().length < 5) return
    setBusy(true); setError(''); setSuccess('')
    try {
      const { error } = await supabase.rpc('submit_assessment_language_review', {
        p_assessment_id: detail.assignment.assessment_id,
        p_language_code: detail.language_code,
        p_decision: decision,
        p_notes: note.trim(),
      })
      if (error) throw error
      setSuccess(decision === 'approved' ? 'Your independent language review was approved and recorded.' : 'Changes required were recorded for this translation bundle.')
      setDetail(null); setDecision(''); setNote(''); setRevision(v => v + 1)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Language review could not be submitted.') }
    finally { setBusy(false) }
  }

  if (loaded && !error && assignments.length === 0) return null

  return <section aria-label="Assessment language review">
    <div className="section-heading"><div><h2>Assessment language review</h2><p className="muted">Independent bilingual review for translated credential assessments. Certification requires two qualified reviewers.</p></div></div>
    {error && <div className="banner banner-error" role="alert">{error}</div>}
    {success && <div className="banner banner-info" role="status">{success}</div>}
    {!detail ? <>{busy && !loaded ? <p className="muted">Loading language review assignments…</p> : <div className="list-panel">{assignments.map(a => <div className="list-row" key={a.id}><div><strong className="list-row-title">{a.assessment_title} · {labels[a.language_code] || a.language_code}</strong><div className="muted">{a.category || 'Assessment'} · {a.status.replaceAll('_',' ')}{a.submitted_at ? ` · submitted ${new Date(a.submitted_at).toLocaleDateString()}` : ''}</div></div><button className="btn btn-secondary" disabled={busy} onClick={() => void open(a)}>{a.status === 'assigned' ? 'Start review' : 'Open review'}</button></div>)}</div>}</> : <form onSubmit={submit}>
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => { setDetail(null); setDecision(''); setNote('') }}>Back to assignments</button>
      <div className="section-heading"><div><h3>{detail.assessment?.title || detail.assignment?.assessment_title} · {labels[detail.language_code] || detail.language_code}</h3><p className="muted">Translation bundle: {completeness.complete}/{completeness.total} questions complete · certification {detail.certification?.status || 'draft'}</p></div></div>
      {!completeness.ready && <div className="banner banner-error" role="alert">This translation bundle is incomplete. Do not approve it. Ask the administrator to finish the draft translations first.</div>}
      <div className="review-question-list">{(detail.questions ?? []).map(q => <article className="review-question" key={q.question_id}>
        <div className="section-heading"><h4>Question {q.question_order}</h4><span className="pill-stat">{q.translation_status || 'missing'}{q.translation_model ? ` · ${q.translation_model}` : ''}</span></div>
        <div className="detail-grid"><div className="detail-card"><strong>English source</strong><p>{q.source_prompt}</p><span className="muted">Choices</span><pre className="review-data">{pretty(q.source_choices)}</pre><span className="muted">Competency</span><p>{q.source_competency || '—'}</p></div><div className="detail-card"><strong>{labels[detail.language_code] || detail.language_code} translation</strong><p>{q.translated_prompt || 'Missing translation'}</p><span className="muted">Choices</span><pre className="review-data">{pretty(q.translated_choices)}</pre><span className="muted">Competency</span><p>{q.translated_competency || '—'}</p></div></div>
      </article>)}</div>
      <div className="field"><label htmlFor="translation-decision">Decision</label><select id="translation-decision" value={decision} onChange={e => setDecision(e.target.value as 'approved' | 'changes_required' | '')} required disabled={busy}><option value="">Choose decision</option><option value="approved" disabled={!completeness.ready}>Approve complete translation</option><option value="changes_required">Changes required</option></select></div>
      <div className="field"><label htmlFor="translation-note">Independent reviewer note</label><textarea id="translation-note" value={note} onChange={e => setNote(e.target.value)} minLength={5} maxLength={4000} required disabled={busy} placeholder="Record accuracy, terminology, clarity and any corrections required." /></div>
      <button className="btn btn-primary" disabled={busy || !decision || note.trim().length < 5 || (decision === 'approved' && !completeness.ready)}>{busy ? 'Saving review…' : 'Submit independent language review'}</button>
    </form>}
  </section>
}
