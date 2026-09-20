import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { fetchOwnProfile, logoutUser, type MelaProfile } from './lib/auth'
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

type AuthView = 'login' | 'register'
type StudentView = 'dashboard' | 'practice' | 'opportunities' | 'materials' | 'academy' | 'mentorship' | 'passport' | 'coach' | 'arena' | 'services'

export default function App() {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<MelaProfile | null>(null)
  const [authView, setAuthView] = useState<AuthView>('login')
  const [pendingEmail, setPendingEmail] = useState('')
  const [studentView, setStudentView] = useState<StudentView>('dashboard')

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

  useEffect(() => {
    if (!session) {
      setProfile(null)
      return
    }
    fetchOwnProfile()
      .then(setProfile)
      .catch(() => setProfile(null))
  }, [session])

  if (loading) {
    return <div className="centered-loading">Loading…</div>
  }

  if (!session) {
    return authView === 'login' ? (
      <Login onSwitchToRegister={() => setAuthView('register')} />
    ) : (
      <Register
        onSwitchToLogin={() => setAuthView('login')}
        onRegistered={(email) => setPendingEmail(email)}
      />
    )
  }

  if (pendingEmail && !profile) {
    return <VerifyEmail email={pendingEmail} />
  }

  if (!profile) {
    return <div className="centered-loading">Setting up your account…</div>
  }

  if (profile.account_status === 'pending_verification' || !profile.email_verified) {
    return <VerifyEmail email={profile.email ?? pendingEmail} />
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="auth-wordmark">MELA</span>
        <div className="app-header-user">
          <span>{profile.full_name}</span>
          <button onClick={() => logoutUser()}>Log out</button>
        </div>
      </header>

      {profile.role === 'student' ? (
        studentView === 'practice' ? (
          <Practice onBack={() => setStudentView('dashboard')} />
        ) : studentView === 'opportunities' ? (
          <OpportunityHub onBack={() => setStudentView('dashboard')} />
        ) : studentView === 'materials' ? (
          <StudyMaterials onBack={() => setStudentView('dashboard')} />
        ) : studentView === 'academy' ? (
          <SkillAcademy onBack={() => setStudentView('dashboard')} />
        ) : studentView === 'mentorship' ? (
          <Mentorship onBack={() => setStudentView('dashboard')} />
        ) : studentView === 'passport' ? (
          <CareerPassport onBack={() => setStudentView('dashboard')} />
        ) : studentView === 'coach' ? (
          <AiCareerCoach onBack={() => setStudentView('dashboard')} />
        ) : studentView === 'arena' ? (
          <Arena onBack={() => setStudentView('dashboard')} />
        ) : studentView === 'services' ? (
          <StudentServices onBack={() => setStudentView('dashboard')} />
        ) : (
          <StudentDashboard onNavigate={(view) => setStudentView(view as StudentView)} />
        )
      ) : profile.role === 'company' || profile.role === 'employer' ? (
        <EmployerPortal role={profile.role} />
      ) : profile.role === 'parent' || profile.role === 'teacher' || profile.role === 'mentor' ? (
        <RoleDashboard role={profile.role} fullName={profile.full_name} />
      ) : profile.role === 'admin' ? (
        <div className="dash-main"><h1>Central Admin</h1><p className="muted">Administrative access is separated from the learner application. Use the separate MELA Central Dashboard.</p></div>
      ) : (
        <div className="dash-main">
          <h1>Welcome, {profile.full_name}</h1>
          <p className="muted">
            Your account is set up and verified. The {profile.role} experience is being built next —
            it isn't ready yet, so there's nothing to show here honestly. The student experience is live if you want to see it working end to end.
          </p>
        </div>
      )}
    </div>
  )
}
