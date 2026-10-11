import { useState } from 'react'
import { parseSafeList, saveRoleProfile } from '../lib/role-profile-save'

const GRADES=[...Array.from({length:12},(_,i)=>String(i+1)),'college_tvet','university']
export default function TeacherProfileSetup({fullName,email,onComplete}: {fullName:string|null;email:string|null;onComplete:()=>void}) {
  const [name,setName]=useState(fullName ?? '')
  const [institution,setInstitution]=useState('')
  const [qualification,setQualification]=useState('')
  const [subjects,setSubjects]=useState('')
  const [grades,setGrades]=useState<string[]>([])
  const [years,setYears]=useState('0')
  const [skills,setSkills]=useState('')
  const [bio,setBio]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();setError('')
    if(name.trim().length<2 || institution.trim().length<2 || !qualification.trim()) return setError('Full name, institution and qualification are required.')
    if(parseSafeList(subjects).length===0 || grades.length===0) return setError('Select teaching subjects and at least one grade or education stage.')
    const experience=Number(years)
    if(!Number.isInteger(experience)||experience<0||experience>80)return setError('Experience must be between 0 and 80 years.')
    setBusy(true)
    try {
      await saveRoleProfile({role:'teacher',name,institution,details:{
        qualification:qualification.trim(),subjects_taught:parseSafeList(subjects),
        grade_levels:grades,teaching_experience_years:experience,
        skills:parseSafeList(skills),certifications:[],biography:bio.trim(),teaching_interests:[],
      }})
      onComplete()
    }catch(cause){setError(cause instanceof Error?cause.message:'Unable to save teacher profile.')}
    finally{setBusy(false)}
  }
  return <div className="auth-shell"><div className="auth-card" style={{maxWidth:720}}>
    <span className="auth-wordmark">MELA · EDUCATORS</span>
    <h1>Teacher profile</h1>
    <p className="auth-subtitle">Enter your teaching qualifications, institution, actual subjects and grades. Saving a profile never grants authority to review or approve questions.</p>
    {error && <div className="banner banner-error" role="alert">{error}</div>}
    <form onSubmit={e=>void submit(e)}>
      <div className="field"><label htmlFor="teacher-name">Full name (required)</label><input id="teacher-name" required minLength={2} maxLength={100} value={name} onChange={e=>setName(e.target.value)} disabled={busy}/></div>
      <div className="field"><label htmlFor="teacher-school">School / teaching institution (required)</label><input id="teacher-school" required maxLength={160} value={institution} onChange={e=>setInstitution(e.target.value)} disabled={busy}/></div>
      <div className="field"><label htmlFor="teacher-qualification">Teaching qualification (required)</label><input id="teacher-qualification" required maxLength={180} value={qualification} onChange={e=>setQualification(e.target.value)} disabled={busy}/></div>
      <div className="field"><label htmlFor="teacher-subjects">Subjects you teach (required, comma separated)</label><input id="teacher-subjects" required maxLength={500} placeholder="Mathematics, Physics" value={subjects} onChange={e=>setSubjects(e.target.value)} disabled={busy}/></div>
      <div className="field"><label id="teacher-grades-label">Grade levels / programs you teach (required)</label>
        <div className="role-grid" role="group" aria-labelledby="teacher-grades-label">
          {GRADES.map(value=><button key={value} type="button" className="role-option" aria-pressed={grades.includes(value)} disabled={busy}
            onClick={()=>setGrades(current=>current.includes(value)?current.filter(v=>v!==value):[...current,value])}>
            {grades.includes(value)?'✓ ':''}{value==='college_tvet'?'College / TVET':value==='university'?'University':`Grade ${value}`}
          </button>)}
        </div>
      </div>
      <div className="field"><label htmlFor="teacher-years">Teaching experience (years)</label><input id="teacher-years" type="number" min={0} max={80} value={years} onChange={e=>setYears(e.target.value)} disabled={busy}/></div>
      <div className="field"><label htmlFor="teacher-skills">Specialist skills (optional)</label><input id="teacher-skills" maxLength={400} value={skills} onChange={e=>setSkills(e.target.value)} disabled={busy}/></div>
      <div className="field"><label htmlFor="teacher-bio">Teaching experience summary (optional)</label><textarea id="teacher-bio" maxLength={1500} value={bio} onChange={e=>setBio(e.target.value)} disabled={busy}/></div>
      <p className="field-hint">Administrator approval, teacher credentials and subject assignments must be independently verified before question-review access.</p>
      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy?'Saving teacher profile…':'Save teacher profile'}</button>
    </form>
    <p className="field-hint">Signed-in account: {email ?? 'verified teacher account'}</p>
  </div></div>
}
