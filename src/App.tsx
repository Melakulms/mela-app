import { lazy, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Wifi, LogOut } from 'lucide-react'
import { supabase } from './lib/supabase'
import { fetchOwnProfile, logoutUser, updatePreferredLanguage, type MelaProfile } from './lib/auth'
import { fetchEnabledLanguages, type PlatformLanguage } from './lib/languages'
import ResetPassword from './pages/ResetPassword'
import Login from './pages/Login'
import Register from './pages/Register'
import VerifyEmail from './pages/VerifyEmail'
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'))
const Practice = lazy(() => import('./pages/Practice'))
const OpportunityHub = lazy(() => import('./pages/OpportunityHub'))
const StudyMaterials = lazy(() => import('./pages/StudyMaterials'))
const SkillAcademy = lazy(() => import('./pages/SkillAcademy'))
const Mentorship = lazy(() => import('./pages/Mentorship'))
const CareerPassport = lazy(() => import('./pages/CareerPassport'))
const EmployerPortal = lazy(() => import('./pages/EmployerPortal'))
const AiCareerCoach = lazy(() => import('./pages/AiCareerCoach'))
const Arena = lazy(() => import('./pages/Arena'))
const Profile = lazy(() => import('./pages/Profile'))
const EthioScholarConnect = lazy(() => import('./pages/EthioScholarConnect'))
const RoleDashboard = lazy(() => import('./pages/RoleDashboard'))
const RoleProfileSetup = lazy(() => import('./pages/RoleProfileSetup'))
const EmployerApprovalPending = lazy(() => import('./pages/EmployerApprovalPending'))
const LearnerTools = lazy(() => import('./pages/LearnerTools'))
const LearnerSubsections = lazy(() => import('./pages/LearnerSubsections'))
const StudentOnboarding = lazy(() => import('./pages/StudentOnboarding'))
const QuestionBank = lazy(() => import('./pages/QuestionBank'))

type AuthView = 'login' | 'register'
type StudentView = 'dashboard' | 'practice' | 'opportunities' | 'materials' | 'academy' | 'mentorship' | 'passport' | 'coach' | 'arena' | 'profile' | 'scholarships' | 'mastery' | 'opportunity-graph' | 'mela-next' | 'wallet' | 'challenges' | 'assessments' | 'earn-work' | 'question-bank'

const BOTTOM_NAV: { view: StudentView; label: string }[] = [
  { view: 'dashboard', label: 'Dashboard' },
  { view: 'practice', label: 'Practice' },
  { view: 'arena', label: 'Arena' },
  { view: 'scholarships', label: 'Scholarships' },
  { view: 'profile', label: 'Profile' },
]

export default function App() {
  const [recovering, setRecovering] = useState(() => new URLSearchParams(window.location.search).get('recovery') === '1')
  const [accountError, setAccountError] = useState('')
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileRevision, setProfileRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [sessionRevision, setSessionRevision] = useState(0)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<MelaProfile | null>(null)
  const [authView, setAuthView] = useState<AuthView>('login')
  const [pendingEmail, setPendingEmail] = useState('')
  const [studentView, setStudentView] = useState<StudentView>('dashboard')
  const [languages, setLanguages] = useState<PlatformLanguage[]>([])
  const [employerRegistration, setEmployerRegistration] = useState<{ status: string; company_name: string | null } | null>(null)
  const [editingEmployerProfile, setEditingEmployerProfile] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setAccountError('')
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (event === 'USER_UPDATED' || event === 'SIGNED_IN') setProfileRevision(value => value + 1)
      if (event === 'SIGNED_OUT') setRecovering(false)
      setSession(newSession)
      setLoading(false)
    })
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) setAccountError('Could not restore your session. Please try again.')
      setSession(data.session)
      setLoading(false)
    }).catch(() => {
      if (active) { setAccountError('Could not connect. Please try again.'); setLoading(false) }
    })
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [sessionRevision])

  useEffect(() => { setStudentView('dashboard'); setEditingEmployerProfile(false) }, [session?.user.id])

  const reloadProfile = () => setProfileRevision((value) => value + 1)

  useEffect(() => {
    let active = true
    setProfile(null)
    setEmployerRegistration(null)
    setAccountError('')
    if (!session?.user.id) { setProfileLoading(false); return }
    setProfileLoading(true)
    const load = async () => {
      try {
        const nextProfile = await fetchOwnProfile()
        if (!nextProfile || nextProfile.id !== session.user.id) throw new Error('Your profile could not be loaded. Please retry or sign in again.')
        let registration = null
        if (nextProfile.role === 'company' || nextProfile.role === 'employer') {
          const { data, error } = await supabase.from('employer_registration_requests')
            .select('status, company_name').eq('applicant_user_id', session.user.id)
            .order('created_at', { ascending: false }).limit(1).maybeSingle()
          if (error) throw error
          registration = data
        }
        if (active) { setProfile(nextProfile); setEmployerRegistration(registration) }
      } catch (error) {
        if (active) setAccountError(error instanceof Error ? error.message : 'Could not load your account. Please retry.')
      } finally { if (active) setProfileLoading(false) }
    }
    void load()
    fetchEnabledLanguages().then((data) => { if (active) setLanguages(data) }).catch(() => {})
    return () => { active = false }
  }, [session?.user.id, profileRevision])

  if (loading) return <div className="centered-loading">Loading…</div>

  if (recovering) return <ResetPassword sessionReady={!!session} onComplete={() => {
    setRecovering(false)
    window.history.replaceState(null, '', window.location.pathname)
    reloadProfile()
  }} />

  if (accountError) return <div className="auth-shell"><div className="auth-card">
    <h1>Unable to load your account</h1><div className="banner banner-error" role="alert">{accountError}</div>
    <button className="btn btn-primary" onClick={() => session ? reloadProfile() : setSessionRevision(value => value + 1)}>Retry</button>
    <button className="btn btn-secondary" onClick={() => logoutUser()}>Log out</button>
  </div></div>

  if (!session) {
    if (pendingEmail) {
      return <VerifyEmail email={pendingEmail} onUseDifferentAccount={() => {
        setPendingEmail('')
        setAuthView('login')
      }} />
    }
    return authView === 'login' ? (
      <Login onSwitchToRegister={() => setAuthView('register')} />
    ) : (
      <Register onSwitchToLogin={() => setAuthView('login')} onRegistered={(email) => setPendingEmail(email)} />
    )
  }

  if (profileLoading || !profile || profile.id !== session.user.id) return <div className="centered-loading">Setting up your account…</div>
  if (profile.account_status === 'pending_verification' || !profile.email_verified) {
    return <VerifyEmail onRefresh={reloadProfile} email={profile.email ?? pendingEmail} onUseDifferentAccount={() => { setPendingEmail(''); setAuthView('login') }} />
  }

  if (profile.account_status !== 'active') {
    return <div className="auth-shell"><div className="auth-card"><h1>Account unavailable</h1>
      <p>Your account is {profile.account_status}. Contact MELA support for assistance.</p>
      <button className="btn btn-secondary" onClick={() => logoutUser()}>Log out</button>
    </div></div>
  }

  const isStudent = profile.role === 'student'

  if (isStudent && !profile.education_onboarding_completed) {
    return <StudentOnboarding onComplete={reloadProfile} />
  }

  if ((profile.role === 'parent' || profile.role === 'teacher' || profile.role === 'company' || profile.role === 'employer') && ((profile.profile_completion ?? 0) < 100 || ((profile.role === 'company' || profile.role === 'employer') && editingEmployerProfile))) {
    return <RoleProfileSetup role={profile.role === 'employer' ? 'company' : profile.role} fullName={profile.full_name} email={profile.email} onComplete={() => { setEditingEmployerProfile(false); reloadProfile() }} />
  }

  if ((profile.role === 'company' || profile.role === 'employer') && employerRegistration && employerRegistration.status.toLowerCase() !== 'approved') {
    return (
      <EmployerApprovalPending
        status={employerRegistration.status}
        companyName={employerRegistration.company_name}
        onRefresh={reloadProfile}
        onEdit={() => setEditingEmployerProfile(true)}
      />
    )
  }

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
          {studentView === 'question-bank' && <QuestionBank onBack={() => setStudentView('dashboard')} />}
          {studentView === 'opportunities' && <OpportunityHub onBack={() => setStudentView('dashboard')} />}
          {studentView === 'materials' && <StudyMaterials stageKey={profile.education_stage_key} gradeLevel={profile.grade_level} onBack={() => setStudentView('dashboard')} />}
          {studentView === 'academy' && <SkillAcademy onBack={() => setStudentView('dashboard')} />}
          {studentView === 'mentorship' && <Mentorship onBack={() => setStudentView('dashboard')} />}
          {studentView === 'passport' && <CareerPassport onBack={() => setStudentView('dashboard')} />}
          {studentView === 'coach' && <AiCareerCoach onBack={() => setStudentView('dashboard')} />}
          {studentView === 'arena' && <Arena onBack={() => setStudentView('dashboard')} />}
          {studentView === 'profile' && <Profile profile={profile} onProfileUpdated={reloadProfile} />}
          {studentView === 'scholarships' && <EthioScholarConnect onBack={() => setStudentView('dashboard')} />}
          {studentView === 'mastery' && <LearnerTools view="mastery" onBack={() => setStudentView('dashboard')} />}
          {studentView === 'opportunity-graph' && <LearnerTools view="graph" onBack={() => setStudentView('dashboard')} />}
          {studentView === 'mela-next' && <LearnerTools view="next" onBack={() => setStudentView('dashboard')} />}
          {studentView === 'wallet' && <LearnerTools view="wallet" onBack={() => setStudentView('dashboard')} />}
          {studentView === 'challenges' && <LearnerSubsections view="challenges" onBack={() => setStudentView('dashboard')} />}
          {studentView === 'assessments' && <LearnerSubsections view="assessments" onBack={() => setStudentView('dashboard')} />}
          {studentView === 'earn-work' && <LearnerSubsections view="earn" onBack={() => setStudentView('dashboard')} />}
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
