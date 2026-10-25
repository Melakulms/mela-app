import { useEffect, useState } from 'react'
import { fetchLearningLibrary, fetchLearningMaterial, type MaterialContent, type LearningProgram } from '../lib/materials'
import { useI18n } from '../i18n'
import SchoolChapterLibrary from '../components/SchoolChapterLibrary'
import { educationStageFor } from '../lib/education-profile'

export default function StudyMaterials({ stageKey, gradeLevel, onBack, onOpenQuestionBank }: { stageKey: string | null; gradeLevel: number | null; onBack: () => void; onOpenQuestionBank?: () => void }) {
  const { t } = useI18n()
  const [programs, setPrograms] = useState<LearningProgram[] | null>(null)
  const [error, setError] = useState('')
  const [material, setMaterial] = useState<MaterialContent | null>(null)
  const [busy, setBusy] = useState(false)
  const [openProgram, setOpenProgram] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setPrograms(null); setMaterial(null); setOpenProgram(null); setError('')
    if (!stageKey) {
      setError("We don't know your education stage yet, so we can't load the right materials for you.")
      return
    }
    fetchLearningLibrary(stageKey, gradeLevel)
      .then(lib => {if(active)setPrograms(lib.programs)})
      .catch(e => {if(active)setError(e.message ?? 'Could not load study materials.')})
    return () => {active=false}
  }, [stageKey, gradeLevel])

  const openMaterial = async (key: string, owner: LearningProgram) => {
    if (busy) return
    setBusy(true); setError('')
    try {
      if (!programs?.some(p => p.program_key === owner.program_key &&
        p.units.some(u => u.materials.some(m => m.material_key === key)))) {
        throw new Error('This material is not among your registered curriculum subjects.')
      }
      const result = await fetchLearningMaterial(key)
      if (stageKey?.startsWith('school_') && (
        result.grade_level !== gradeLevel || result.stage_key !== stageKey ||
        result.subject_title !== owner.subject_title || result.track_key !== owner.track_key
      )) throw new Error('This material does not match your enrolled grade and subject.')
      setMaterial(result)
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open this material.') }
    finally { setBusy(false) }
  }

  if (material) return <div className="dash-main">
    <div className="section-heading"><h1>{material.title}</h1><button className="btn btn-secondary" onClick={() => setMaterial(null)}>Back to materials</button></div>
    {material.summary && <p>{material.summary}</p>}
    {material.locked ? <div className="banner banner-info">Your account does not have access to this material.</div>
      : material.content_markdown ? <article style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.7 }}>{material.content_markdown}</article>
      : <div className="empty-panel">Content is not available yet.</div>}
  </div>

  return (
    <div className="dash-main">
      <div className="section-heading">
        <h1>{t('studyMaterials')}</h1>
        <button className="btn btn-secondary" onClick={onBack}>{t('back')}</button>
      </div>
      {error && <div role="alert" className="banner banner-error">{error}</div>}
      {!programs && !error && <p className="muted">Loading…</p>}
      {gradeLevel !== null && stageKey !== null && educationStageFor('school', gradeLevel) === stageKey && <p className="banner banner-info"><strong>Grade {gradeLevel} learning materials.</strong> Open a subject to see chapter lessons, guided practice, and checkpoints. Materials are supplemental and are not teacher-certified textbooks.</p>}
      {programs && programs.length === 0 && <div className="empty-panel">No materials are available for your saved grade and enrolled subjects. Check your education profile.</div>}

      {programs?.map((p) => (
        <div key={p.program_key} className="list-panel">
          <button
            aria-expanded={openProgram === p.program_key}
            className="list-row"
            style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer' }}
            onClick={() => setOpenProgram(openProgram === p.program_key ? null : p.program_key)}
          >
            <div>
              <div className="list-row-title">{p.title}</div>
              <div className="list-row-meta">{p.subject_title}</div>
            </div>
            <span className="pill">{p.units.length ? `${p.units.length} units` : 'In review'}</span>
          </button>

          {openProgram === p.program_key && p.units.length === 0 && (
            <div className="empty-panel" role="status" style={{ margin: '0.8rem 1.1rem' }}>
              Learning content for this program is being prepared and must pass qualified educator review before publication. No unreviewed lesson has been substituted.
            </div>
          )}

          {openProgram === p.program_key && gradeLevel !== null && stageKey !== null && educationStageFor('school', gradeLevel) === stageKey && <SchoolChapterLibrary programKey={p.program_key} grade={gradeLevel} stageKey={stageKey} onOpenPractice={onOpenQuestionBank} />}
          {openProgram === p.program_key && p.units.map((u) => (
            <div key={u.id} style={{ borderTop: '1px solid var(--line)', padding: '0.8rem 1.1rem' }}>
              <div className="list-row-title" style={{ marginBottom: '0.5rem' }}>Unit {u.unit_number}: {u.title}</div>
              {u.materials.length === 0 ? (
                <p className="muted" style={{ fontSize: '0.85rem' }}>Materials for this unit are still under qualified review.</p>
              ) : (
                u.materials.map((m) => (
                  <div key={m.material_key} className="list-row" style={{ padding: '0.6rem 0' }}>
                    <div className="list-row-title" style={{ fontSize: '0.9rem' }}>{m.title}</div>
                    {m.can_access ? (
                      <button className="btn btn-secondary" disabled={busy} onClick={() => void openMaterial(m.material_key,p)}>Open material</button>
                    ) : (
                      <span className="pill">{m.access_tier === 'subscription' ? 'Needs subscription' : 'Needs purchase'}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
