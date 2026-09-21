import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Wifi, LogOut } from 'lucide-react'
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
import Profile from './pages/Profile'
import EthioScholarConnect from './pages/EthioScholarConnect'
import RoleDashboard from './pages/RoleDashboard'

type AuthView = 'login' | 'register'
type StudentView = 'dashboard' | 'practice' | 'opportunities' | 'materials' | 'academy' | 'mentorship' | 'passport' | 'coach' | 'arena' | 'profile' | 'scholarships'

const BOTTOM_NAV: { view: StudentView; label: string }[] = [
  { view: 'dashboard', label: 'Dashboard' },
  { view: 'practice', label: 'Practice' },
  { view: 'arena', label: 'Arena' },
  { view: 'scholarships', label: 'Scholarships' },
  { view: 'profile', label: 'Profile' },
]

export default function App() {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<MelaProfile | null>(null)
  const [authView, setAuthView] = useState<AuthView>('login')
  const [pendingEmail, setPendingEmail] = useState('')
  const [studentView, setStudentView] = useState<StudentView>('dashboard')
  const [languages, setLanguages] = useState<PlatformLanguage[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const reloadProfile = () => {
    fetchOwnProfile().then(setProfile).catch(() => setProfile(null))
  }

  useEffect(() => {
    if (!session) { setProfile(null); return }
    reloadProfile()
    fetchEnabledLanguages().then(setLanguages).catch(() => {})
  }, [session])

  if (loading) return <div className="centered-loading">Loading…</div>

  if (!session) {
    return authView === 'login' ? (
      <Login onSwitchToRegister={() => setAuthView('register')} />
    ) : (
      <Register onSwitchToLogin={() => setAuthView('login')} onRegistered={(email) => setPendingEmail(email)} />
    )
  }

  if (pendingEmail && !profile) return <VerifyEmail email={pendingEmail} />
  if (!profile) return <div className="centered-loading">Setting up your account…</div>
  if (profile.account_status === 'pending_verification' || !profile.email_verified) {
    return <VerifyEmail email={profile.email ?? pendingEmail} />
  }

  const isStudent = profile.role === 'student'

  const changeLanguage = async (code: string) => {
    try {
      await updatePreferredLanguage(code)
      reloadProfile()
    } catch { /* surfaced within Profile page if changed from there */ }
  }

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <span className="auth-wordmark">⚡ MELA</span>
        <div className="app-topbar-right">
          <select className="lang-select" value={profile.preferred_language} onChange={(e) => changeLanguage(e.target.value)}>
            {languages.map((l) => (
              <option key={l.language_code} value={l.language_name}>{l.native_name}</option>
            ))}
          </select>
          <span className="pill-stat coins">🪙 {profile.coin_balance}</span>
          <span className="pill-stat online"><Wifi size={13} /> Online</span>
          <button className="icon-btn" onClick={() => logoutUser()} aria-label="Log out"><LogOut size={18} /></button>
        </div>
      </header>

      {isStudent ? (
        <>
          {studentView === 'practice' && <Practice onBack={() => setStudentView('dashboard')} />}
          {studentView === 'opportunities' && <OpportunityHub onBack={() => setStudentView('dashboard')} />}
          {studentView === 'materials' && <StudyMaterials stageKey={profile.education_stage_key} onBack={() => setStudentView('dashboard')} />}
          {studentView === 'academy' && <SkillAcademy onBack={() => setStudentView('dashboard')} />}
          {studentView === 'mentorship' && <Mentorship onBack={() => setStudentView('dashboard')} />}
          {studentView === 'passport' && <CareerPassport onBack={() => setStudentView('dashboard')} />}
          {studentView === 'coach' && <AiCareerCoach onBack={() => setStudentView('dashboard')} />}
          {studentView === 'arena' && <Arena onBack={() => setStudentView('dashboard')} />}
          {studentView === 'profile' && <Profile profile={profile} onProfileUpdated={reloadProfile} />}
          {studentView === 'scholarships' && <EthioScholarConnect onBack={() => setStudentView('dashboard')} />}
          {studentView === 'dashboard' && <StudentDashboard onNavigate={(view) => setStudentView(view as StudentView)} />}

          <nav className="bottom-nav">
            {BOTTOM_NAV.map((item) => (
              <button
                key={item.label}
                className={studentView === item.view ? 'active' : ''}
                onClick={() => setStudentView(item.view)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </>
      ) : profile.role === 'company' || profile.role === 'employer' ? (
        <EmployerPortal role={profile.role} />
      ) : profile.role === 'parent' || profile.role === 'teacher' || profile.role === 'mentor' ? (
        <RoleDashboard role={profile.role} fullName={profile.full_name} />
      ) : profile.role === 'admin' ? (
        <div className="dash-main"><h1>Central Admin</h1><p className="muted">Use the separate MELA Central Dashboard for administrative operations.</p></div>
      ) : (
        <div className="dash-main"><h1>Account setup</h1><p className="muted">Your account role is not yet supported by this frontend.</p></div>
      )}
    </div>
  )
}
