import { safeExternalUrl } from '../lib/external-url'
import ScholarshipReadinessPanel from '../components/ScholarshipReadinessPanel'
import ScholarshipResearchLibrary from '../components/ScholarshipResearchLibrary'
import { useEffect, useMemo, useState } from 'react'
import { checkScholarshipEligibility, ensureScholarshipTasks, fetchOpenScholarships, fetchSavedScholarshipIds, fetchScholarshipApplications, fetchScholarshipTasks, setScholarshipTaskCompleted, toggleSavedScholarship, type Scholarship, type ScholarshipApplication, type ScholarshipTask } from '../lib/scholarships'
import { applyToOpportunity } from '../lib/opportunities'
import { useI18n } from '../i18n'

const labels:Record<string,string>={submitted:'Submitted',under_review:'Under review',shortlisted:'Shortlisted',accepted:'Accepted',rejected:'Rejected',withdrawn:'Withdrawn'}

export default function EthioScholarConnect({onBack}:{onBack:()=>void}) {
  const { t } = useI18n()
 const [items,setItems]=useState<Scholarship[]>([]); const [saved,setSaved]=useState<Set<string>>(new Set()); const [apps,setApps]=useState<ScholarshipApplication[]>([]); const [tasks,setTasks]=useState<ScholarshipTask[]>([]); const [tab,setTab]=useState('readiness'); const [catalogLoaded,setCatalogLoaded]=useState(false); const [search,setSearch]=useState(''); const [country,setCountry]=useState(''); const [selected,setSelected]=useState<Scholarship|null>(null); const [eligibility,setEligibility]=useState<any>(null); const [error,setError]=useState(''); const [busy,setBusy]=useState<string|null>(null)
 const load=async()=>{
   setError('')
   // A Saved/Preparation permission or network failure must not hide verified offers.
   const results=await Promise.allSettled([
     fetchOpenScholarships(),fetchSavedScholarshipIds(),fetchScholarshipApplications(),fetchScholarshipTasks()
   ])
   const messages:string[]=[]
   if(results[0].status==='fulfilled'){setItems(results[0].value);setCatalogLoaded(true)}
   else {setCatalogLoaded(false);messages.push('Could not load verified scholarship offers.')}
   if(results[1].status==='fulfilled')setSaved(results[1].value)
   else messages.push('Saved scholarships are temporarily unavailable.')
   if(results[2].status==='fulfilled')setApps(results[2].value)
   else messages.push('Application history is temporarily unavailable.')
   if(results[3].status==='fulfilled')setTasks(results[3].value)
   else messages.push('Preparation checklists are temporarily unavailable.')
   if(messages.length)setError(messages.join(' '))
 }
 useEffect(()=>{load()},[])
 const countries=useMemo(()=>Array.from(new Set(items.map(x=>x.study_country).filter(Boolean))) as string[],[items])
 const filtered=useMemo(()=>items.filter(s=>(!search||[s.title,s.institution,s.program_name,...s.fields_of_study].filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase()))&&(!country||s.study_country===country)&&(tab!=='saved'||saved.has(s.id))),[items,search,country,tab,saved])
 const save=async(s:Scholarship)=>{if(busy)return;setBusy(s.id);setError('');try{const was=saved.has(s.id);await toggleSavedScholarship(s.id,was);setSaved(old=>{const n=new Set(old);was?n.delete(s.id):n.add(s.id);return n})}catch(e:any){setError(e.message||'Could not save scholarship.')}finally{setBusy(null)}}
 const updateTask=async(task:ScholarshipTask)=>{
   if(busy)return
   setBusy(task.id);setError('')
   try{
     await setScholarshipTaskCompleted(task.id,!task.completed)
     // Display the server-confirmed value, not an optimistic checkbox toggle.
     setTasks(current=>current.map(row=>row.id===task.id?{...row,completed:!task.completed}:row))
   }catch(e){
     setError(e instanceof Error?e.message:'Checklist could not be saved. Try again.')
   }finally{setBusy(null)}
 }
 const start=async(s:Scholarship)=>{if(busy)return;setBusy(s.id);setError('');try{if(s.application_method==='external'){await ensureScholarshipTasks(s);setTab('preparation')}else{await applyToOpportunity(s.id,'');const a=(await fetchScholarshipApplications()).find(x=>x.opportunity_id===s.id);await ensureScholarshipTasks(s,a?.id);setTab('applications')}await load()}catch(e:any){setError(e.message||'Could not start application.')}finally{setBusy(null)}}
 const progress=(id:string)=>{const t=tasks.filter(x=>x.opportunity_id===id);return t.length?Math.round(t.filter(x=>x.completed).length/t.length*100):0}
 return <div className='dash-main'><div className='section-heading'><div><h1>{t('scholarships')}</h1><p className='muted'>Your profile readiness, verified offers, preparation checklists and real application records are separate steps.</p></div><button className='btn btn-secondary' onClick={onBack}>{t('back')}</button></div>
 {error&&<div className='banner banner-error' role='alert'>{error}<button className='btn btn-secondary' onClick={load}>Retry scholarships</button></div>}
 <section className='banner banner-info' aria-label='Scholarship research and eligibility safety'>
   <strong>Scholarship research is not an offer, award or admission decision</strong>
   <p>Verify Ethiopian nationality rules, education stage, academic qualifications, funding, language requirements and current deadlines on the official university or scholarship website.</p>
   <p>Saving an item or marking a task complete is not an application. External university decisions are not tracked unless an official provider confirms them. Never pay unverified agents or upload personal identity documents to unofficial links.</p>
 </section>
 <div className='list-panel'><div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}><button className={tab==='readiness'?'btn btn-primary':'btn btn-secondary'} onClick={()=>setTab('readiness')}>My readiness</button><button className={tab==='universities'?'btn btn-primary':'btn btn-secondary'} onClick={()=>setTab('universities')}>200 university links</button><button className={tab==='programmes'?'btn btn-primary':'btn btn-secondary'} onClick={()=>setTab('programmes')}>12 programme sources</button><button className={tab==='discover'?'btn btn-primary':'btn btn-secondary'} onClick={()=>setTab('discover')}>Verified offers</button><button className={tab==='saved'?'btn btn-primary':'btn btn-secondary'} onClick={()=>setTab('saved')}>Saved ({saved.size})</button><button className={tab==='preparation'?'btn btn-primary':'btn btn-secondary'} onClick={()=>setTab('preparation')}>My preparation ({tasks.length})</button><button className={tab==='applications'?'btn btn-primary':'btn btn-secondary'} onClick={()=>setTab('applications')}>My Applications ({apps.length})</button></div>
 {tab==='readiness'&&<ScholarshipReadinessPanel verifiedOfferCount={catalogLoaded?items.length:null}/>}
 {tab==='universities'&&<ScholarshipResearchLibrary view='universities'/>}
 {tab==='programmes'&&<ScholarshipResearchLibrary view='programmes'/>}
 <div style={{display:['readiness','universities','programmes'].includes(tab)?'none':undefined}}>
 {(tab==='discover'||tab==='saved')&&<div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}><input aria-label='Search scholarships' placeholder='Search scholarships' value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label='Study country' value={country} onChange={e=>setCountry(e.target.value)}><option value=''>All countries</option>{countries.map(c=><option key={c}>{c}</option>)}</select></div>}
 {tab==='preparation'?<><p className='muted'>These are your own planning tasks. Completing them does not mean a university received an application, approved documents or granted admission.</p>{tasks.length===0?<div className='empty-panel'>No preparation tasks yet. Open Verified offers and choose Prepare checklist to begin.</div>:tasks.map(task=><label className='list-row' key={task.id}><span><strong>{items.find(item=>item.id===task.opportunity_id)?.title||'Scholarship preparation'}</strong><span style={{display:'block'}}><input type='checkbox' checked={task.completed} disabled={busy!==null} onChange={()=>void updateTask(task)}/> {task.title}</span></span><span className='muted'>{task.due_at?'Due '+new Date(task.due_at).toLocaleDateString():''}</span></label>)}</>:tab==='applications'?<>{apps.length===0?<div className='empty-panel'>No recorded in-app applications. Scholarship bookmarks and preparation checklists are not applications.</div>:apps.map(a=><div className='list-row' key={a.id}><div style={{flex:1}}><div className='list-row-title'>{a.title}</div><div className='list-row-meta'>{a.institution||'Scholarship'} · {labels[a.status]||a.status}</div><div className='muted'>Preparation progress: {progress(a.opportunity_id)}%</div><progress value={progress(a.opportunity_id)} max='100' style={{width:'100%'}}/></div></div>)}</>:filtered.length===0?<div className='empty-panel'>{tab==='saved'?'No saved scholarships yet.':'No currently source-verified open scholarships match this search.'}</div>:filtered.map(s=><div className='list-row' key={s.id}><div style={{flex:1}}><div className='list-row-title'>{s.title}</div><div className='list-row-meta'>{s.institution||'Scholarship'} · {s.study_country||'Global'} · {s.funding_type||'Funding unspecified'}{s.deadline?' · Due '+s.deadline:''}</div><div className='list-row-meta'>{s.required_documents.length} requirements{s.verified_at?' · Verified '+new Date(s.verified_at).toLocaleDateString():''}</div></div><div style={{display:'flex',gap:8,alignItems:'center'}}><button className='btn btn-secondary' onClick={async()=>{setSelected(s);setEligibility(null);try{setEligibility(await checkScholarshipEligibility(s.id))}catch{}}}>Details</button><button className='btn btn-secondary' disabled={busy!==null} onClick={()=>save(s)}>{saved.has(s.id)?'Saved':'Save'}</button>{s.application_method==='external' ? <>{safeExternalUrl(s.external_url) ? <a className='btn btn-primary' href={safeExternalUrl(s.external_url)!} target='_blank' rel='noopener noreferrer'>Official site</a> : <span>Official link unavailable</span>}<button className='btn btn-secondary' disabled={busy!==null} onClick={()=>start(s)}>Prepare checklist</button></> : <button className='btn btn-primary' disabled={busy!==null||apps.some(a=>a.opportunity_id===s.id)} onClick={()=>start(s)}>{apps.some(a=>a.opportunity_id===s.id)?'Applied':'Start application'}</button>}</div></div>)}
 </div>
 </div>
 {selected&&<div className='list-panel' style={{marginTop:16}}><div className='section-heading'><h2>{selected.title}</h2><button className='btn btn-secondary' onClick={()=>setSelected(null)}>Close</button></div><p>{selected.description}</p><p><strong>Eligibility:</strong> {eligibility?.eligible!==undefined?(eligibility.eligible?'Some recorded profile conditions match. This is NOT verified eligibility or admission.':'Some recorded conditions do not match. Verify provider requirements directly.'):'Eligibility has not been confirmed. Review the official requirements.'}</p><p><strong>Criteria:</strong> {selected.eligible_countries.join(', ')||'See official requirements'}{selected.minimum_gpa?' · Minimum GPA '+selected.minimum_gpa:''}</p><p><strong>Study level:</strong> {selected.degree_levels.join(', ')||'Not specified'}</p><p><strong>Fields:</strong> {selected.fields_of_study.join(', ')||'Not specified'}</p><p><strong>Documents:</strong> {selected.required_documents.join(', ')||'Not specified'}</p><p><strong>Coverage:</strong> {selected.coverage.join(', ')||'Not specified'}</p>{safeExternalUrl(selected.source_url)&&<p><a href={safeExternalUrl(selected.source_url)!} target='_blank' rel='noopener noreferrer'>Official source</a></p>}<p className='muted'>External applications and outcomes must be verified by the provider. Preparation checklists and profile comparisons are not guaranteed admission.</p></div>}

 </div>
}