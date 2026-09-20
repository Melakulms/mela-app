import { useEffect, useState } from 'react'
import { Wifi, LogOut } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { fetchOwnProfile, logoutUser, updatePreferredLanguage, type MelaProfile } from './lib/auth'
import { fetchEnabledLanguages, type PlatformLanguage } from './lib/languages'
import Login from './pages/Login'
import Register from './pages/Register'
import VerifyEmail from './pages/VerifyEmail'
import StudentDashboard from './pages/StudentDashboard'
import Practice from './pages/Practice'
import OpportunityHub from './pages/OpportunityHub'
import StudyMaterials from './pages/StudyMaterials'
import SkillAcademy from './pages/SkillAcademy'
import Mentorship from './pages/Mentorship'
import CareerPassport from './pages/CareerPassport'
import EmployerPortal from './pages/EmployerPortal'
import AiCareerCoach from './pages/AiCareerCoach'
import Arena from './pages/Arena'
import StudentServices from './pages/StudentServices'
import RoleDashboard from './pages/RoleDashboard'
import Profile from './pages/Profile'
import EthioScholarConnect from './pages/EthioScholarConnect'

type AuthView='login'|'register'
type StudentView='dashboard'|'practice'|'opportunities'|'materials'|'academy'|'mentorship'|'passport'|'coach'|'arena'|'services'|'profile'|'scholarships'

const BOTTOM_NAV:{view:StudentView;label:string}[]=[
 {view:'dashboard',label:'Dashboard'},{view:'practice',label:'Practice'},{view:'arena',label:'Arena'},{view:'profile',label:'Profile'}
]

export default function App(){
 const [loading,setLoading]=useState(true),[session,setSession]=useState<Session|null>(null),[profile,setProfile]=useState<MelaProfile|null>(null),[authView,setAuthView]=useState<AuthView>('login'),[pendingEmail,setPendingEmail]=useState(''),[studentView,setStudentView]=useState<StudentView>('dashboard'),[languages,setLanguages]=useState<PlatformLanguage[]>([])
 const reloadProfile=()=>{fetchOwnProfile().then(setProfile).catch(()=>setProfile(null))}
 useEffect(()=>{supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)});const {data:sub}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>sub.subscription.unsubscribe()},[])
 useEffect(()=>{if(!session){setProfile(null);return} reloadProfile();fetchEnabledLanguages().then(setLanguages).catch(()=>{})},[session])
 if(loading)return <div className="centered-loading">Loading…</div>
 if(!session)return authView==='login'?<Login onSwitchToRegister={()=>setAuthView('register')}/>:<Register onSwitchToLogin={()=>setAuthView('login')} onRegistered={e=>setPendingEmail(e)}/>
 if(pendingEmail&&!profile)return <VerifyEmail email={pendingEmail}/>
 if(!profile)return <div className="centered-loading">Setting up your account…</div>
 if(profile.account_status==='pending_verification'||!profile.email_verified)return <VerifyEmail email={profile.email??pendingEmail}/>
 const changeLanguage=async(code:string)=>{try{await updatePreferredLanguage(code);reloadProfile()}catch{}}
 return <div className="app-shell">
  <header className="app-topbar">
   <span className="auth-wordmark">⚡ MELA</span>
   <div className="app-topbar-right">
    {profile.role==='student'&&<select className="lang-select" value={profile.preferred_language} onChange={e=>changeLanguage(e.target.value)}>{languages.map(l=><option key={l.language_code} value={l.language_code}>{l.native_name}</option>)}</select>}
    {profile.role==='student'&&<span className="pill-stat coins">🪙 {profile.coin_balance}</span>}
    <span className="pill-stat online"><Wifi size={13}/> Online</span>
    <button className="icon-btn" onClick={()=>logoutUser()} aria-label="Log out"><LogOut size={18}/></button>
   </div>
  </header>
  {profile.role==='student'?<>
   {studentView==='practice'&&<Practice onBack={()=>setStudentView('dashboard')}/>}
   {studentView==='opportunities'&&<OpportunityHub onBack={()=>setStudentView('dashboard')}/>}
   {studentView==='materials'&&<StudyMaterials onBack={()=>setStudentView('dashboard')}/>}
   {studentView==='academy'&&<SkillAcademy onBack={()=>setStudentView('dashboard')}/>}
   {studentView==='mentorship'&&<Mentorship onBack={()=>setStudentView('dashboard')}/>}
   {studentView==='passport'&&<CareerPassport onBack={()=>setStudentView('dashboard')}/>}
   {studentView==='coach'&&<AiCareerCoach onBack={()=>setStudentView('dashboard')}/>}
   {studentView==='arena'&&<Arena onBack={()=>setStudentView('dashboard')}/>}
   {studentView==='services'&&<StudentServices onBack={()=>setStudentView('dashboard')}/>}
   {studentView==='profile'&&<Profile profile={profile} onProfileUpdated={reloadProfile}/>}
   {studentView==='scholarships'&&<EthioScholarConnect onBack={()=>setStudentView('dashboard')}/>}
   {studentView==='dashboard'&&<StudentDashboard onNavigate={v=>setStudentView(v as StudentView)}/>}
   <nav className="bottom-nav">{BOTTOM_NAV.map(item=><button key={item.label} className={studentView===item.view?'active':''} onClick={()=>setStudentView(item.view)}>{item.label}</button>)}</nav>
  </>:profile.role==='company'||profile.role==='employer'?<EmployerPortal role={profile.role}/>:profile.role==='parent'||profile.role==='teacher'||profile.role==='mentor'?<RoleDashboard role={profile.role} fullName={profile.full_name}/>:profile.role==='admin'?<div className="dash-main"><h1>Central Admin</h1><p className="muted">Administrative access is separated from the learner application. Use the separate MELA Central Dashboard.</p></div>:<div className="dash-main"><h1>Welcome, {profile.full_name}</h1><p className="muted">Your account is set up and verified. The {profile.role} experience is being built next.</p></div>}
 </div>
}