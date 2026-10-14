import {useEffect,useRef,useState} from 'react'
import {supabase} from '../lib/supabase'

type Credential={
 id:string;document_kind:string;original_name:string;storage_path:string;
 review_status:'pending'|'approved'|'rejected';review_note:string|null;uploaded_at:string
}
const ALLOWED:Record<string,string>={
 'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png',
}
const MAX_BYTES=10*1024*1024
const DOCUMENT_KINDS=[
 ['degree','University degree'],
 ['diploma','Diploma'],
 ['teaching_license','Teaching license'],
 ['professional_certificate','Professional certificate'],
 ['other','Other relevant qualification'],
] as const

/** Teacher-submitted original evidence is private, immutable and subject to
 * independent admin approval. Only role-matching teachers can insert files.
 */
export default function TeacherCredentialUpload(){
 const [kind,setKind]=useState<string>('degree')
 const [file,setFile]=useState<File|null>(null)
 const [docs,setDocs]=useState<Credential[]>([])
 const [busy,setBusy]=useState(false)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const [revision,setRevision]=useState(0)
 const lock=useRef(false)
 useEffect(()=>{
  let active=true
  void(async()=>{
   setLoading(true)
   try{
    const {data:auth,error:authError}=await supabase.auth.getUser()
    if(authError)throw authError
    if(!auth.user)throw new Error('Log in to view qualification documents.')
    const {data,error}=await supabase.from('teacher_credential_documents')
      .select('id,document_kind,original_name,storage_path,review_status,review_note,uploaded_at')
      .eq('teacher_id',auth.user.id).order('uploaded_at',{ascending:false})
    if(error)throw error
    if(active)setDocs((data??[]) as Credential[])
   }catch(cause){
    if(active)setError(cause instanceof Error?cause.message:'Could not load qualification documents.')
   }finally{if(active)setLoading(false)}
  })()
  return()=>{active=false}
 },[revision])

 async function upload(event:React.FormEvent){
  event.preventDefault()
  if(lock.current||!file)return
  setError('');setMessage('')
  if(!ALLOWED[file.type])return setError('Choose a PDF, JPG or PNG certificate.')
  if(file.size<1||file.size>MAX_BYTES)return setError('Document must be no larger than 10 MB.')
  if(file.name.length>180)return setError('File name must not exceed 180 characters.')
  if(docs.length>=12)return setError('Maximum 12 qualification documents.')
  lock.current=true;setBusy(true)
  try{
   const {data:auth,error:authError}=await supabase.auth.getUser()
   if(authError)throw authError
   if(!auth.user)throw new Error('Session expired. Log in again before uploading.')
   const id=crypto.randomUUID()
   const path=`${auth.user.id}/${id}.${ALLOWED[file.type]}`
   const {error:uploadError}=await supabase.storage.from('teacher-credentials')
    .upload(path,file,{contentType:file.type,upsert:false})
   if(uploadError)throw uploadError
   const {error:metadataError}=await supabase.from('teacher_credential_documents').insert({
    id,teacher_id:auth.user.id,document_kind:kind,original_name:file.name,storage_path:path,
   })
   if(metadataError)throw metadataError
   setMessage('Your qualification was submitted privately for administrator verification. You cannot review questions until approved.')
   setFile(null);setRevision(v=>v+1)
   const picker=document.getElementById('teacher-credential-file') as HTMLInputElement|null
   if(picker)picker.value=''
  }catch(cause){
   // Never delete the underlying evidence on an ambiguous upload error:
   // immutable storage prevents tampering; a retry uses a distinct UUID.
   setError(cause instanceof Error?cause.message:'Could not upload your document. Please retry.')
  }finally{lock.current=false;setBusy(false)}
 }

 async function view(doc:Credential){
  // Open promptly to avoid the Android popup blocker. The link expires in 60s.
  const win=window.open('about:blank','_blank')
  try{
   if(win)win.opener=null
   const {data,error}=await supabase.storage.from('teacher-credentials').createSignedUrl(doc.storage_path,60)
   if(error||!data?.signedUrl)throw error??new Error('Unable to open document.')
   if(win)win.location.replace(data.signedUrl)
   else setError('Please allow popups to open your private document.')
  }catch(cause){
   if(win)win.close()
   setError(cause instanceof Error?cause.message:'Unable to view your document.')
  }
 }

 return <section className="list-panel" aria-label="Teacher qualification documents">
  <h2>Qualifications &amp; documents</h2>
  <p>Submit a clear PDF or photo of your degree, diploma, teaching license or professional certificate. Only you and MFA-verified MELA administrators can view these private files. A qualification document must be verified before any question-review permissions are granted.</p>
  <p className="field-hint">Maximum 10 MB each · PDF, JPG or PNG · up to 12 files. Files cannot be replaced after submission; upload corrected evidence as a new document.</p>
  {error&&<p role="alert" className="banner banner-error">{error}</p>}
  {message&&<p role="status" className="banner banner-info">{message}</p>}
  <form onSubmit={event=>void upload(event)}>
   <div className="field"><label htmlFor="teacher-credential-kind">Qualification document type</label>
    <select id="teacher-credential-kind" value={kind} disabled={busy}
     onChange={event=>setKind(event.target.value)}>
     {DOCUMENT_KINDS.map(([value,label])=><option key={value} value={value}>{label}</option>)}
    </select></div>
   <div className="field"><label htmlFor="teacher-credential-file">Choose certificate (PDF, JPG or PNG)</label>
    <input id="teacher-credential-file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
      disabled={busy} onChange={event=>setFile(event.currentTarget.files?.[0]??null)}/></div>
   <button className="btn btn-primary" type="submit" disabled={!file||busy}>{busy?'Uploading qualification…':'Submit qualification for verification'}</button>
  </form>
  <div aria-label="Submitted qualification documents">
   <h3>My submitted documents</h3>
   {loading?<p role="status">Checking submissions…</p>:docs.length===0?<p>No documents submitted yet.</p>:
     docs.map(doc=><div key={doc.id} className="list-row">
      <div><strong>{doc.original_name}</strong> · {doc.review_status}
       {doc.review_note&&<p className="field-hint">Administrator feedback: {doc.review_note}</p>}</div>
      <button type="button" className="btn btn-secondary" onClick={()=>void view(doc)}>View privately</button>
     </div>)}
  </div>
  <button type="button" className="btn btn-secondary" onClick={()=>setRevision(v=>v+1)} disabled={busy}>Refresh verification status</button>
 </section>
}
