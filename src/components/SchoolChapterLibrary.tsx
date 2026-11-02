import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { educationStageFor } from '../lib/education-profile'

type Resource = {
  material_key: string
  title: string
  material_type: string
  summary: string | null
}
type Content = {
  material_key: string
  title: string
  content_markdown: string | null
  locked: boolean
  grade_level: number | null
  stage_key: string
  chapter_title: string
  source_verified?: boolean
  official_alignment_status?: string | null
}

type Chapter = { id: string; chapter_number: number; title: string }

/** Free supplemental material paired to the same chapter as the question session.
 * This never grants an entitlement or presents draft content as teacher-approved.
 */
export function ChapterStudyResources({ chapterId, chapterTitle, grade, stageKey }: {
  chapterId: string
  chapterTitle: string
  grade: number
  stageKey: string
}) {
  const [resources, setResources] = useState<Resource[]>([])
  const [content, setContent] = useState<Content | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const valid = educationStageFor('school', grade) === stageKey

  useEffect(() => {
    let active = true
    setResources([]); setContent(null); setError(''); setLoading(true)
    if (!valid) { setError('School grade and stage do not match.'); setLoading(false); return () => { active = false } }
    const load = async () => {
      try {
        const { data, error: cause } = await supabase.from('mela_learning_chapter_materials')
          .select('material_key,title,material_type,summary')
          .eq('chapter_id', chapterId).eq('status', 'published').eq('access_tier', 'free')
          .order('display_order')
        if (cause) throw cause
        if (active) setResources((data ?? []) as Resource[])
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load chapter resources.')
      } finally { if (active) setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [chapterId, valid])

  const open = async (key: string) => {
    if (busy || !resources.some(r => r.material_key === key)) return
    setBusy(true); setError(''); setContent(null)
    try {
      const { data, error: cause } = await supabase.rpc('get_mela_chapter_material', { p_material_key: key })
      if (cause) throw cause
      if (!data || data.material_key !== key || data.grade_level !== grade ||
          data.stage_key !== stageKey || data.chapter_title !== chapterTitle) {
        throw new Error('The chapter material did not match your saved grade. Nothing was opened.')
      }
      setContent(data as Content)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open this material.') }
    finally { setBusy(false) }
  }

  return <section className="list-panel" aria-label={`Grade ${grade} chapter materials`}>
    <h3>Study this chapter: {chapterTitle}</h3>
    <p className="field-hint">Grade {grade} supplemental lessons, worked practice and checkpoints. Materials are not verified textbook reproductions or teacher-approved curriculum.</p>
    {loading && <p role="status">Loading free chapter materials…</p>}
    {error && <div className="banner banner-error" role="alert">{error}</div>}
    {!loading && !error && !resources.length && <p>No free chapter materials are currently available.</p>}
    {!content && resources.map(r => <div className="list-row" key={r.material_key}>
      <div><strong>{r.title}</strong><p className="muted">{r.material_type.replaceAll('_', ' ')}</p></div>
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void open(r.material_key)}>Read</button>
    </div>)}
    {content && <article aria-label="Opened supplemental chapter material" className="question-card" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',lineHeight:1.6}}>
      <h4>{content.title}</h4>
      {content.locked || !content.content_markdown
        ? <p>Content is unavailable under your current access.</p>
        : <p>{content.content_markdown}</p>}
      <p className="field-hint">Supplemental content — educator review and textbook alignment still need confirmation.</p>
      <button className="btn btn-secondary" type="button" onClick={() => setContent(null)}>Back to chapter materials</button>
    </article>}
  </section>
}

/** Chapter navigation for the Study Materials module; never switches grade. */
export default function SchoolChapterLibrary({ programKey, grade, stageKey, onOpenPractice }: {
  programKey: string
  grade: number
  stageKey: string
  onOpenPractice?: () => void
}) {
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [selected, setSelected] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const valid = educationStageFor('school', grade) === stageKey
  useEffect(() => {
    let active = true
    setChapters([]); setSelected(''); setError(''); setLoading(true)
    if (!valid) { setError('School grade and stage do not match.'); setLoading(false); return () => { active = false } }
    const load = async () => {
      try {
        const { data, error: cause } = await supabase.from('mela_learning_chapters')
          .select('id,chapter_number,title').eq('program_key', programKey).eq('status','published')
          .order('chapter_number')
        if (cause) throw cause
        if (active) setChapters((data ?? []) as Chapter[])
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Could not load chapters.') }
      finally { if (active) setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [programKey,valid])
  const chapter = chapters.find(c => c.id === selected)
  return <section aria-label="Grade-specific chapters and materials" className="list-panel">
    <h3>{chapter ? `Chapter ${chapter.chapter_number}: ${chapter.title}` : `Grade ${grade} chapter lessons and guided practice`}</h3>
    {chapter && <button className="btn btn-secondary" type="button" onClick={() => setSelected('')}>Back to chapters</button>}
    {loading && <p role="status">Loading chapters…</p>}
    {error && <p role="alert">{error}</p>}
    {!loading && !error && !chapters.length && <p>Chapter materials are being reviewed for this subject.</p>}
    {chapters.length > 0 && !chapter && <div className="field">
      <label htmlFor="school-chapter-select">Choose a chapter to study</label>
      <select id="school-chapter-select" value={selected} onChange={e=>setSelected(e.target.value)}>
        <option value="">Select chapter</option>
        {chapters.map(c=><option value={c.id} key={c.id}>Chapter {c.chapter_number}: {c.title}</option>)}
      </select>
    </div>}
    {chapter && <ChapterStudyResources chapterId={chapter.id} chapterTitle={chapter.title} grade={grade} stageKey={stageKey} />}
    {onOpenPractice && <button type="button" className="btn btn-primary" onClick={onOpenPractice}>Practice my registered grade's questions</button>}
  </section>
}
