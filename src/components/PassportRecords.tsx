import { useEffect, useRef, useState } from 'react'
import { fetchPassportRecords, savePassportProject, type PassportRecord, type ProjectDraft, type RecordKind } from '../lib/passport-records'
import { safeExternalUrl } from '../lib/external-url'
import PassportCareerEditor from './PassportCareerEditor'
import PassportVerificationPanel from './PassportVerificationPanel'
const emptyProject = (): ProjectDraft => ({ title:'', description:'', project_url:'', repository_url:'', is_public:false })
export default function PassportRecords({ onSaved, allowCareerEditing = false, allowProjectVisibility = true }: { onSaved: () => void; allowCareerEditing?: boolean; allowProjectVisibility?: boolean }) {
  const [kind,setKind] = useState<RecordKind>('projects')
  const [records,setRecords] = useState<PassportRecord[]>([])
  const [loading,setLoading] = useState(true)
  const [more,setMore] = useState(false)
  const [error,setError] = useState('')
  const [message,setMessage] = useState('')
  const [revision,setRevision] = useState(0)
  const [editing,setEditing] = useState<string | null>(null)
  const [draft,setDraft] = useState<ProjectDraft | null>(null)
  const [careerEdit,setCareerEdit] = useState<PassportRecord | 'new' | null>(null)
  const [saving,setSaving] = useState(false)
  const lock = useRef(false)
  useEffect(()=>{
    let active = true
    setLoading(true); setRecords([]); setError(''); setMore(false)
    fetchPassportRecords(kind).then(rows=>{ if(active){setRecords(rows);setMore(rows.length===20)} }).catch(e=>{if(active)setError(e.message ?? 'Could not load records.')}).finally(()=>{if(active)setLoading(false)})
    return ()=>{active=false}
  },[kind,revision])
  const save = async () => {
    if (!draft || lock.current) return
    lock.current=true;setSaving(true);setError('');setMessage('')
    try {
      await savePassportProject(allowProjectVisibility ? draft : {...draft,is_public:false},editing ?? undefined)
      setDraft(null);setEditing(null);setRevision(v=>v+1);setMessage('Project saved. This is a self-reported project, not a verified credential.');onSaved()
    } catch(e) {setError(e instanceof Error ? e.message : 'Could not save project. Your draft is still here.')}
    finally {lock.current=false;setSaving(false)}
  }
  const loadMore = async () => {
    if(lock.current || loading) return
    lock.current=true;setLoading(true);setError('')
    try {const rows=await fetchPassportRecords(kind,records.length);setRecords(r=>[...r,...rows]);setMore(rows.length===20)}
    catch(e){setError(e instanceof Error ? e.message : 'Could not load more records.')}
    finally{lock.current=false;setLoading(false)}
  }
  return <section id="passport-records" className="list-panel question-card" aria-label="My portfolio records">
    <h2>My portfolio records</h2>
    <div className="field"><label htmlFor="passport-record-kind">Record type</label><select id="passport-record-kind" value={kind} disabled={loading || saving || !!draft || !!careerEdit} onChange={e=>{setKind(e.target.value as RecordKind);setMessage('');setCareerEdit(null)}}><option value="projects">Projects</option><option value="education">Education</option><option value="experience">Experience</option></select></div>
    {message && <p role="status">{message}</p>}
    {error && <div role="alert">{error}{!draft && <button className="btn btn-secondary" disabled={loading} onClick={()=>setRevision(v=>v+1)}>Retry records</button>}</div>}
    {kind==='projects' && !draft && <button className="btn btn-primary" onClick={()=>{setDraft(emptyProject());setEditing(null);setMessage('');setError('')}}>Add project</button>}
    {kind!=='projects' && <p className="field-hint">{allowCareerEditing ? 'Education and experience are self-reported and saved privately. Verified records are locked; reviewer approval is separate.' : 'Saved records are shown here. Editing and verification requests are not yet available on this environment.'}</p>}
    {allowCareerEditing && kind!=='projects' && !careerEdit && <button className="btn btn-primary" disabled={loading || saving} onClick={()=>{setCareerEdit('new');setError('');setMessage('')}}>Add {kind} record</button>}
    {allowCareerEditing && kind!=='projects' && careerEdit && <PassportCareerEditor key={kind+':'+(careerEdit==='new'?'new':careerEdit.id)} kind={kind} record={careerEdit==='new'?undefined:careerEdit} onSaved={()=>{setCareerEdit(null);setRevision(v=>v+1);setMessage('Private self-reported record saved. Verification is a separate reviewer decision.');onSaved()}} onCancel={()=>setCareerEdit(null)} />}
    {draft && <form onSubmit={e=>{e.preventDefault();void save()}}>
      <h3>{editing ? 'Edit project' : 'Add project'}</h3>
      <p>Describe your own work. Do not include passwords, identity documents, or private information about other people.</p>
      <div className="field"><label htmlFor="project-title">Project title</label><input id="project-title" required maxLength={200} disabled={saving} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></div>
      <div className="field"><label htmlFor="project-description">What you built and your contribution</label><textarea id="project-description" maxLength={5000} disabled={saving} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></div>
      {(['project_url','repository_url'] as const).map(key=><div className="field" key={key}><label htmlFor={key}>{key==='project_url'?'Project link (optional)':'Repository link (optional)'}</label><input id={key} type="url" disabled={saving} value={draft[key]} placeholder="https://" onChange={e=>setDraft({...draft,[key]:e.target.value})}/></div>)}
      <label><input type="checkbox" disabled={saving || !allowProjectVisibility} checked={allowProjectVisibility && draft.is_public} onChange={e=>setDraft({...draft,is_public:e.target.checked})}/> Make this project visible to employers under MELA's access rules</label>
      <p className="field-hint">New projects are private by default. External links have their own privacy settings. {!allowProjectVisibility && 'Employer visibility is unavailable until adult eligibility and privacy checks are confirmed.'}</p>
      <button className="btn btn-primary" disabled={saving} type="submit">{saving?'Saving project…':'Save project'}</button>
      <button className="btn btn-secondary" disabled={saving} type="button" onClick={()=>{if(window.confirm('Discard unsaved project changes?')){setDraft(null);setEditing(null);setError('')}}}>Cancel editing</button>
    </form>}
    {loading && <p role="status">Loading records…</p>}
    {!loading && !error && !records.length && <p>No {kind} records saved yet.</p>}
    {records.map(record=><article key={record.id} className="question-card">
      <h3>{record.title ?? record.institution}</h3><p>{record.organization ?? record.qualification}{record.field_of_study ? ` · ${record.field_of_study}` : ''}</p>
      <p style={{whiteSpace:'pre-wrap'}}>{record.description}</p><p>{kind==='projects'?'Self-reported project':record.verified===true?'Verified':'Unverified'} · {record.is_public?'Marked public':'Private'}</p>
      {kind==='projects' && <><div>{[record.project_url,record.repository_url].map((value,i)=>{const url=safeExternalUrl(value);return url?<a key={i} className="btn btn-secondary" href={url} target="_blank" rel="noopener noreferrer">{i===0?'Open project':'Open repository'}</a>:null})}</div><button className="btn btn-secondary" disabled={saving || !!draft} onClick={()=>{setEditing(record.id);setDraft({title:record.title ?? '',description:record.description ?? '',project_url:record.project_url ?? '',repository_url:record.repository_url ?? '',is_public:allowProjectVisibility && record.is_public});setMessage('')}}>Edit project</button></>}{allowCareerEditing && kind!=='projects' && !record.verified && <button className="btn btn-secondary" disabled={saving || !!careerEdit} onClick={()=>{setCareerEdit(record);setMessage('')}}>Edit {kind}</button>}
    </article>)}
    {more && <button className="btn btn-secondary" disabled={loading || saving || !!draft} onClick={()=>void loadMore()}>Load more records</button>}
    {allowCareerEditing && kind!=='projects' && !loading && <PassportVerificationPanel kind={kind} records={records} />}
  </section>
}
