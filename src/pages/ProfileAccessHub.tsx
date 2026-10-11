import {useState, type ReactNode} from 'react'
import {BookOpen, ClipboardList, ShieldCheck, Briefcase, Users, Trophy, GraduationCap, ChevronLeft, RefreshCw} from 'lucide-react'
import SkillAcademy from './SkillAcademy'
import SafetyCenter from './SafetyCenter'

type PreviewSection = 'setup' | 'features' | 'academy' | 'safety'
type Role = 'student' | 'parent' | 'teacher' | 'company' | 'employer'

const MODULES=[
  {name:'Skill Academy',description:'Browse the published course catalog. Enrollment and personalized course progress require a completed, eligible student profile.',group:'Learning'},
  {name:'Grade subjects & Question Bank',description:'Grade- and stream-specific learning; subject sessions cannot begin until the school profile is verified and saved.',group:'Learning'},
  {name:'Practice & Study Materials',description:'Curriculum study sessions and lessons matched to education level. Some content also requires teacher approval.',group:'Learning'},
  {name:'Eight Arena competition formats',description:'Curriculum games and organized challenges. Matches, prizes and money-related activity stay subject to age and account checks.',group:'Challenges'},
  {name:'AI learning & career guidance',description:'AI education paths and guidance with age-appropriate limits. Year One handbook is a draft and has not been teacher certified.',group:'Learning'},
  {name:'Scholarships & Opportunity Hub',description:'Education opportunities, training and verified career connections with eligibility checks.',group:'Opportunities'},
  {name:'Career Passport & Mastery Map',description:'Your private progress, evidence and educational milestones after your learner record is complete.',group:'Profile'},
  {name:'Mentorship & employer connections',description:'Verified adult or guardian-gated mentor matching, and employer relationships when allowed.',group:'Opportunities'},
  {name:'Safety & Privacy',description:'See safeguarding resources, guardian consent status and ways to report a safety concern.',group:'Safety'},
]

const ROLE_INFO:Record<Role,{title:string;summary:string;items:string[]}> = {
  student:{title:'Student features',summary:'Complete your education profile for grade subjects and personalized learning. You can browse safe resources while setup is unresolved.',
    items:['Your grade and subject curriculum','AI education and practice','Age-appropriate Arena challenges','Study materials and scholarship discovery']},
  parent:{title:'Family and guardian features',summary:'Complete a separate family profile. Child records remain private until an approved guardian link exists.',
    items:['Family learning support','Verified parent/child linking','School and learner updates after verification','Family safety guidance']},
  teacher:{title:'Teacher features',summary:'Your teacher profile and classroom tools are independent. Question approval always needs verified teaching credentials.',
    items:['Teaching subjects and grades','Educator classrooms','Question review assignments after verification','Learning content quality workflows']},
  company:{title:'Employer and partner features',summary:'Complete company verification before creating live opportunities or contacting eligible learners.',
    items:['Organization profile','Employer opportunity management after approval','Verified challenges and recruiting','Account and safety checks']},
  employer:{title:'Employer and partner features',summary:'Legacy employer accounts need administrator review before connecting to the supported company profile.',
    items:['Organization profile','Employer verification','Recruitment opportunities after approval','Safety checks and reporting']},
}

export default function ProfileAccessHub({role,stageKey,setup,onRefresh,onSignOut}:{
  role:Role;stageKey?:string|null;setup:ReactNode;onRefresh:()=>void;onSignOut:()=>void
}){
  const [section,setSection]=useState<PreviewSection>('setup')
  const [message,setMessage]=useState('')
  const details=ROLE_INFO[role]
  const isStudent=role==='student'
  return <div className="profile-access-hub">
    <header className="profile-access-header">
      <div><span className="auth-wordmark">MELA</span><span className="pill">Account setup</span></div>
      <button type="button" className="btn btn-secondary" onClick={onSignOut}>Sign out</button>
    </header>
    <div className="profile-access-controls" role="navigation" aria-label="Account setup and safe browsing">
      <button type="button" className={section==='setup'?'btn btn-primary':'btn btn-secondary'} onClick={()=>setSection('setup')} aria-current={section==='setup'?'page':undefined}>Complete my profile</button>
      <button type="button" className={section==='features'?'btn btn-primary':'btn btn-secondary'} onClick={()=>setSection('features')} aria-current={section==='features'?'page':undefined}>Explore MELA features</button>
      <button type="button" className="btn btn-secondary" onClick={()=>{setMessage('Checking your profile with the server…');onRefresh()}}><RefreshCw size={16} aria-hidden="true"/> Check profile</button>
    </div>
    {message && <p role="status" className="profile-access-status">{message}</p>}
    {section==='setup' && <>
      <div className="profile-access-intro">
        <strong>Profile saving not working?</strong>
        <p>You can still explore safe MELA features. Competitions, private records, grading and other restricted actions remain locked until your account is verified and the profile is correctly saved.</p>
      </div>
      {setup}
    </>}
    {section==='features' && <main className="dash-main profile-access-explore">
      <span className="eyebrow">MELA · ROLE-SPECIFIC ACCESS</span>
      <h1>{details.title}</h1><p>{details.summary}</p>
      <section className="list-panel"><h2>Your workspace will include</h2>
        <ul>{details.items.map(item=><li key={item}>{item}</li>)}</ul>
      </section>
      {isStudent && <>
        <div className="section-heading"><h2>Discover the platform</h2></div>
        <div className="module-grid">
          {MODULES.map(m=><article className="module-card" key={m.name}>
            <span className="eyebrow">{m.group}</span><h3>{m.name}</h3><p>{m.description}</p>
            {m.name==='Skill Academy'&&<button type="button" className="btn btn-secondary" onClick={()=>setSection('academy')}><BookOpen size={15}/> Browse courses</button>}
            {m.name==='Safety & Privacy'&&<button type="button" className="btn btn-secondary" onClick={()=>setSection('safety')}><ShieldCheck size={15}/> Open Safety Center</button>}
          </article>)}
        </div>
        {(stageKey==='school_11_12'||stageKey==='college_tvet'||stageKey==='university')&&
          <p><a className="btn btn-secondary" href={`${import.meta.env.BASE_URL}ai-year-one.html`}>Read draft AI Year One lessons</a></p>}
        <p className="field-hint">Only read-only course browsing and safety reporting are open during setup. Previewed features are not proof of eligibility, published lesson availability or approved financial rewards.</p>
      </>}
      <button type="button" className="btn btn-primary" onClick={()=>setSection('setup')}><ClipboardList size={15}/> Return to profile setup</button>
    </main>}
    {section==='academy'&&isStudent&&<main className="profile-access-explore">
      <button className="btn btn-secondary" onClick={()=>setSection('features')}><ChevronLeft size={16}/> All features</button>
      <SkillAcademy previewOnly onBack={()=>setSection('features')}/>
    </main>}
    {section==='safety'&&isStudent&&<main className="profile-access-explore">
      <button className="btn btn-secondary" onClick={()=>setSection('features')}><ChevronLeft size={16}/> All features</button>
      <SafetyCenter onBack={()=>setSection('features')}/>
    </main>}
  </div>
}
