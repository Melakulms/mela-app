import { useEffect, useState } from 'react'
import { fetchLearningLibrary, fetchLearningMaterial, type MaterialContent, type LearningProgram } from '../lib/materials'
import { useI18n } from '../i18n'
import SchoolChapterLibrary from '../components/SchoolChapterLibrary'
import { useSectionDrilldown } from '../hooks/useSectionDrilldown'
import { educationStageFor } from '../lib/education-profile'

export default function StudyMaterials({ stageKey, gradeLevel, onBack, onOpenQuestionBank }: { stageKey: string | null; gradeLevel: number | null; onBack: () => void; onOpenQuestionBank?: () => void }) {
  const { t } = useI18n()
  const [programs, setPrograms] = useState<LearningProgram[] | null>(null)
  const [error, setError] = useState('')
  const [material, setMaterial] = useState<MaterialContent | null>(null)
  const [busy, setBusy] = useState(false)
  const [programKey, openSubject, backToSubjects] = useSectionDrilldown('section')
  const [unitKey, openUnit, backToUnits] = useSectionDrilldown('subsection')

  useEffect(() => {
    let active = true
    setPrograms(null); setMaterial(null); setError('')
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

  const selectedProgram = programs?.find(p => p.program_key === programKey)
  const selectedUnit = selectedProgram?.units.find(u => u.id === unitKey)

  if (selectedProgram) return (
    <div className="dash-main">
      <div className="section-heading">
        <div><span className="eyebrow">{t('studyMaterials')} · Subject</span><h1>{selectedProgram.title}</h1></div>
        <button type="button" className="btn btn-secondary" onClick={selectedUnit ? backToUnits : backToSubjects}>{selectedUnit ? 'Back to units' : 'Back to subjects'}</button>
      </div>
      {error && <div role="alert" className="banner banner-error">{error}</div>}
      {selectedUnit ? (
        <section className="list-panel" aria-label="Opened study unit">
          <h2>Unit {selectedUnit.unit_number}: {selectedUnit.title}</h2>
          <p>Choose a material to open the lesson itself.</p>
          {selectedUnit.materials.length === 0 && <p role="status">Materials for this unit are still under qualified review.</p>}
          {selectedUnit.materials.map(m => (
            <div key={m.material_key} className="list-row">
              <strong>{m.title}</strong>
              {m.can_access
                ? <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void openMaterial(m.material_key, selectedProgram)}>Open material</button>
                : <span className="pill">{m.access_tier === 'subscription' ? 'Needs subscription' : 'Needs purchase'}</span>}
            </div>
          ))}
        </section>
      ) : (
        <>
          <p className="banner banner-info">Choose a chapter or a unit. Only the selected lesson or unit opens; your enrolled grade and subject access remain unchanged.</p>
          {gradeLevel !== null && stageKey !== null && educationStageFor('school', gradeLevel) === stageKey &&
            <SchoolChapterLibrary key={selectedProgram.program_key} programKey={selectedProgram.program_key} grade={gradeLevel} stageKey={stageKey} onOpenPractice={onOpenQuestionBank} />}
          <section className="list-panel" aria-label="Study units">
            <h2>Units</h2>
            {selectedProgram.units.length === 0 && <p role="status">Learning content is being prepared and must pass qualified educator review before publication.</p>}
            {selectedProgram.units.map(u => (
              <button key={u.id} type="button" className="list-row" style={{ width: '100%', textAlign: 'left', cursor: 'pointer', border: 'none', background: 'transparent' }} onClick={() => openUnit(u.id)}>
                <span><strong>Unit {u.unit_number}: {u.title}</strong><span className="muted" style={{ display: 'block' }}>{u.materials.length} materials</span></span>
                <span className="pill">Open unit</span>
              </button>
            ))}
          </section>
        </>
      )}
    </div>
  )

  return (
    <div className="dash-main">
      <div className="section-heading">
        <h1>{t('studyMaterials')}</h1>
        <button className="btn btn-secondary" onClick={onBack}>{t('back')}</button>
      </div>
      {error && <div role="alert" className="banner banner-error">{error}</div>}
      {!programs && !error && <p className="muted" role="status">Loading study materials…</p>}
      {gradeLevel !== null && stageKey !== null && educationStageFor('school', gradeLevel) === stageKey &&
        <p className="banner banner-info"><strong>Grade {gradeLevel} learning materials.</strong> Select your subject to open its chapters and units. Materials are supplemental and are not teacher-certified textbooks.</p>}
      {programs && programs.length === 0 && <div className="empty-panel">No materials are available for your saved grade and enrolled subjects. Check your education profile.</div>}
      <div className="list-panel" aria-label="Available study subjects">
        {programs?.map(p => (
          <button key={p.program_key} type="button" className="list-row" style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer' }} onClick={() => openSubject(p.program_key)}>
            <span><strong>{p.title}</strong><span className="muted" style={{ display: 'block' }}>{p.subject_title}</span></span>
            <span className="pill">{p.units.length ? `${p.units.length} units` : 'In review'}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
