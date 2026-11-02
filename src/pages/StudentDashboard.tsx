import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { StudentView } from '../hooks/useStudentNavigation'
import type { TranslationKey } from '../i18n'
import { useI18n } from '../i18n'
import {
  ShieldCheck, ShieldAlert, Briefcase, GraduationCap, Trophy, Sparkles,
  BookOpen, Swords, FileText, Globe, Video, DollarSign, Medal, Brain, Map, Route, WalletCards, ClipboardCheck,
} from 'lucide-react'
import { fetchDashboard, type MelaDashboard } from '../lib/dashboard'
import { fetchMyBadges, type EarnedBadge } from '../lib/badges'
import { readDevicePreferences } from '../lib/device-preferences'
import { visibleInFocusMode } from '../lib/dashboard-focus'

type DashboardModule = {
  key: string
  labelKey: TranslationKey
  blurbKey: TranslationKey
  view?: StudentView
  icon: LucideIcon
  cls: string
  enabled?: boolean
}

const MODULES: DashboardModule[] = [
  { key: 'career_passport', labelKey: 'careerPassport', blurbKey: 'careerPassportBlurb', view: 'passport', icon: ShieldCheck, cls: 'mc-career_passport' },
  { key: 'safety_center', labelKey: 'safetyPrivacy', blurbKey: 'safetyPrivacyBlurb', view: 'safety', icon: ShieldAlert, cls: 'mc-safety', enabled: true },
  { key: 'opportunities', labelKey: 'opportunityHub', blurbKey: 'opportunityHubBlurb', view: 'opportunities', icon: Briefcase, cls: 'mc-opportunities' },
  { key: 'academy', labelKey: 'skillAcademy', blurbKey: 'skillAcademyBlurb', view: 'academy', icon: GraduationCap, cls: 'mc-academy' },
  { key: 'challenges', labelKey: 'sponsoredChallenges', blurbKey: 'sponsoredChallengesBlurb', view: 'challenges', icon: Trophy, cls: 'mc-challenges' },
  { key: 'ai_career_coach', labelKey: 'aiCareerCoach', blurbKey: 'aiCareerCoachBlurb', view: 'coach', icon: Sparkles, cls: 'mc-coach' },
  { key: 'practice', labelKey: 'practice', blurbKey: 'practiceBlurb', view: 'practice', icon: BookOpen, cls: 'mc-practice' },
  { key: 'question_bank', labelKey: 'questionBank', blurbKey: 'questionBankBlurb', view: 'question-bank', icon: BookOpen, cls: 'mc-question-bank', enabled: true },
  { key: 'arena', labelKey: 'arena', blurbKey: 'arenaBlurb', view: 'arena', icon: Swords, cls: 'mc-arena' },
  { key: 'study_materials', labelKey: 'studyMaterials', blurbKey: 'studyMaterialsBlurb', view: 'materials', icon: FileText, cls: 'mc-materials' },
  { key: 'scholarships', labelKey: 'ethioScholarConnect', blurbKey: 'ethioScholarConnectBlurb', view: 'scholarships', icon: Globe, cls: 'mc-scholarships' },
  { key: 'mentorship', labelKey: 'mentorship', blurbKey: 'mentorshipBlurb', view: 'mentorship', icon: Video, cls: 'mc-mentorship' },
  { key: 'mastery', labelKey: 'masteryMap', blurbKey: 'masteryMapBlurb', view: 'mastery', icon: Brain, cls: 'mc-mastery' },
  { key: 'opportunity_graph', labelKey: 'futureMap', blurbKey: 'futureMapBlurb', view: 'opportunity-graph', icon: Map, cls: 'mc-graph' },
  { key: 'mela_next', labelKey: 'melaNext', blurbKey: 'melaNextBlurb', view: 'mela-next', icon: Route, cls: 'mc-next' },
  { key: 'wallet', labelKey: 'melaWallet', blurbKey: 'melaWalletBlurb', view: 'wallet', icon: WalletCards, cls: 'mc-wallet' },
  { key: 'assessments', labelKey: 'verifiedAssessments', blurbKey: 'verifiedAssessmentsBlurb', view: 'assessments', icon: ClipboardCheck, cls: 'mc-assessments' },
  { key: 'earn_work', labelKey: 'earnWork', blurbKey: 'earnWorkBlurb', view: 'earn-work', icon: DollarSign, cls: 'mc-earn_work' },
]

export default function StudentDashboard({ onNavigate }: { onNavigate: (view: StudentView) => void }) {
  const { t } = useI18n()
  const [data, setData] = useState<MelaDashboard | null>(null)
  const [badges, setBadges] = useState<EarnedBadge[]>([])
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [query, setQuery] = useState('')
  const [badgeError, setBadgeError] = useState(false)
  const [devicePreferences, setDevicePreferences] = useState(readDevicePreferences)
  const [showAllTools, setShowAllTools] = useState(true)
  const [motionReplay, setMotionReplay] = useState(0)
  const { dailyStudyMinutes, focusMode } = devicePreferences

  useEffect(() => {
    const changed = () => { setDevicePreferences(readDevicePreferences()); setShowAllTools(true) }
    window.addEventListener('mela:device-preferences-changed', changed)
    return () => window.removeEventListener('mela:device-preferences-changed', changed)
  }, [])

  useEffect(() => {
    let active = true
    setError(''); setBadgeError(false)
    fetchDashboard().then(value => { if (active) setData(value) }).catch(() => { if (active) setError(t('dashboardLoadError')) })
    fetchMyBadges().then(value => { if (active) setBadges(value) }).catch(() => { if (active) setBadgeError(true) })
    return () => { active = false }
  }, [revision, t])

  if (error) return <div className="dash-main">
    <h1>{t('yourDashboard')}</h1>
    <div className="banner banner-error" role="alert">{error} Your feature overview is still available below.</div>
    <button className="btn btn-primary" onClick={() => setRevision(value => value + 1)}>{t('tryAgain')}</button>
    <section aria-label="Available MELA navigation when dashboard data cannot load">
      <div className="section-heading"><h2>{t('exploreMela')}</h2></div>
      <div className="module-grid">
        {MODULES.map(m => {
          const basicLearningOrSafety = m.view === 'safety' || m.view === 'academy' || m.view === 'passport'
          const Icon = m.icon
          return <div key={m.key} className={`module-card ${m.cls}`}>
            <div className="module-icon"><Icon size={20}/></div>
            <h3>{t(m.labelKey)}</h3><p>{t(m.blurbKey)}</p>
            {basicLearningOrSafety
              ? <button type="button" className="btn btn-secondary" onClick={() => onNavigate(m.view!)}>Open</button>
              : <p className="field-hint">Temporarily unavailable until feature permissions and your dashboard can be checked.</p>}
          </div>
        })}
      </div>
    </section>
  </div>
  if (!data) return <div className="dash-main" role="status"><div className="skeleton skeleton-title" /><div className="skeleton skeleton-card" /><p>{t('loadingDashboard')}</p></div>

  const { profile, passport, practice, arena, feature_flags } = data
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleModules = MODULES.filter(m => visibleInFocusMode(m.key, focusMode, showAllTools || normalizedQuery.length > 0) && `${t(m.labelKey)} ${t(m.blurbKey)}`.toLocaleLowerCase().includes(normalizedQuery))
  const motionBlocked = devicePreferences.reducedMotion || devicePreferences.lowData ||
    (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true)

  return (
    <div className="dash-main dashboard-main">
      <div className="dash-greeting mela-welcome">
        <div><span className="eyebrow">{t('learningSpace')}</span>
          <h1>{t('hello')}, {profile.full_name?.split(' ')[0] ?? t('there')} <span className="mela-wave" aria-hidden="true">👋</span></h1>
          <p>{t('dailyProgress')}</p>
        </div>
        <span className="mela-welcome-tag"><Sparkles size={15} aria-hidden="true" /> Learn · Practice · Grow</span>
      </div>

      <section key={`hero-${motionReplay}`} className="dashboard-hero mela-featured-hero" aria-label="Your MELA learning journey">
        <div className="mela-hero-copy">
          <span className="eyebrow">MELA · YOUR NEXT CHAPTER</span>
          <h2>One place for learning, skills and opportunity.</h2>
          <p>Explore your courses, practise your skills and build your future with tools connected to your MELA account.</p>
          <div className="mela-hero-actions">
            {feature_flags.practice && <button type="button" className="btn mela-hero-primary" onClick={() => onNavigate('practice')}>{t('startPracticing')} <BookOpen size={17} aria-hidden="true" /></button>}
            {feature_flags.career_passport !== false && <button type="button" className="btn mela-hero-secondary" aria-label="Open Career Passport updates" onClick={() => onNavigate('passport')}>Career Passport <ShieldCheck size={17} aria-hidden="true" /></button>}
          </div>
        </div>
        <div className="mela-hero-art" aria-hidden="true">
          <div className="mela-hero-orbit"><GraduationCap size={48} strokeWidth={1.6}/></div>
          <span className="mela-hero-spark mela-hero-spark-one"><Sparkles size={21}/></span>
          <span className="mela-hero-spark mela-hero-spark-two"><Trophy size={22}/></span>
          <span className="mela-hero-spark mela-hero-spark-three"><BookOpen size={23}/></span>
        </div>
      </section>

      <div className="stat-strip mela-dashboard-stats" aria-label="Your saved MELA progress">
        <div><span className="stat-value">{passport.profile_score}</span><span className="stat-label">{t('score')}</span></div>
        <div><span className="stat-value">{passport.badge_count}</span><span className="stat-label">{t('badges')}</span></div>
        <div><span className="stat-value">{practice.stats.current_streak_days}</span><span className="stat-label">{t('streak')}</span></div>
        <div><span className="stat-value">{arena.arena_achievements}</span><span className="stat-label">{t('arena')}</span></div>
      </div>

      <section className="mela-quick-start" aria-label="Quick access to MELA features">
        <div className="section-heading"><h2>Quick access</h2></div>
        <div className="mela-quick-grid">
          <button type="button" className="mela-quick-card" onClick={() => onNavigate('passport')} disabled={feature_flags.career_passport === false}>
            <span className="mela-quick-icon quick-passport"><ShieldCheck size={22}/></span>
            <span><strong>Career Passport</strong><small>My skills and experience</small></span>
            <span aria-hidden="true" className="mela-quick-arrow">›</span>
          </button>
          <button type="button" className="mela-quick-card" onClick={() => onNavigate('practice')} disabled={!feature_flags.practice}>
            <span className="mela-quick-icon quick-practice"><BookOpen size={22}/></span>
            <span><strong>My grade &amp; subjects</strong><small>Practise your curriculum</small></span>
            <span aria-hidden="true" className="mela-quick-arrow">›</span>
          </button>
          <button type="button" className="mela-quick-card" onClick={() => onNavigate('opportunities')} disabled={!feature_flags.opportunities}>
            <span className="mela-quick-icon quick-opportunity"><Briefcase size={22}/></span>
            <span><strong>Opportunities</strong><small>Explore available programs</small></span>
            <span aria-hidden="true" className="mela-quick-arrow">›</span>
          </button>
        </div>
      </section>

      <section className="mela-daily-goal" aria-label="My study target">
        <div className="mela-daily-goal-mark"><GraduationCap size={23} aria-hidden="true" /></div>
        <div><strong>My daily study target</strong>
          <p><b>{dailyStudyMinutes} minutes</b> each day · a personal goal, not a recorded completion.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => window.dispatchEvent(new Event('mela:open-settings'))}>Edit</button>
      </section>
      <div className="section-heading"><div><h2>{t('exploreMela')}</h2><p>{t('exploreMelaHelp')}</p></div></div>
      {focusMode && <section className="focus-mode-notice" aria-label="Student focus mode">
        <div><strong>Focus mode is on</strong><p>{showAllTools ? "All MELA tools are visible. Choose focused tools only when you want a shorter list." : "Showing learning and safety tools first. You can return to all tools at any time."}</p></div>
        <button type="button" className="btn btn-secondary" onClick={() => setShowAllTools(current => !current)}>
          {showAllTools ? 'Show focused tools' : 'Show all tools'}
        </button>
      </section>}
      <div className="field module-search"><label htmlFor="module-search">{t('findLearningTool')}</label><input id="module-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('searchLearningTools')} /></div>
      {visibleModules.length === 0 && <div className="empty-panel" role="status">{t('noToolsMatch')} “{query}”. <button className="password-toggle" onClick={() => setQuery('')}>{t('clearSearch')}</button></div>}
      <div className="dashboard-tools-status">
        <span>Showing {visibleModules.length} of {MODULES.length} MELA tools. Availability depends on your account and administrator settings.</span>
        {motionBlocked
          ? <button type="button" className="btn btn-secondary" onClick={() => window.dispatchEvent(new Event("mela:open-settings"))}>Animation off — check Settings</button>
          : <button type="button" className="btn btn-secondary" onClick={() => setMotionReplay(run => run + 1)}>Replay dashboard animation</button>}
      </div>
      <div key={`modules-${motionReplay}`} className="module-grid">
        {visibleModules.map((m) => {
          const enabled = // Earn & Work stays navigable for existing proposals, contracts and disputes.
          // Creation and paid actions remain guarded by the signed-in server readiness RPC.
          ['arena','scholarships','study_materials','mastery','opportunity_graph','mela_next','wallet','safety_center','earn_work'].includes(m.key) ? true : (feature_flags[m.key] ?? m.enabled ?? false)
          const isBuilt = !!m.view
          const Icon = m.icon
          return (
            <button
              key={m.key}
              className={`module-card ${m.cls}${!enabled || !isBuilt ? ' disabled' : ''}`}
              onClick={isBuilt && enabled ? () => onNavigate(m.view!) : undefined}
              disabled={!isBuilt || !enabled}
            >
              <div>
                <div className="module-icon"><Icon size={20} /></div>
                <h3>{t(m.labelKey)}</h3>
                <p>{t(m.blurbKey)}</p>
              </div>
              <span className="mela-module-footer">
                {!enabled ? <span className="soon">{t('notEnabledYet')}</span>
                  : !isBuilt ? <span className="soon">{t('comingSoon')}</span>
                  : <span className="mela-module-open">Open feature <span aria-hidden="true">→</span></span>}
              </span>
            </button>
          )
        })}
      </div>

      <div className="section-heading"><h2>{t('yourBadges')}</h2></div>
      {badgeError ? <div className="empty-panel" role="status">{t('badgesLoadError')} <button className="password-toggle" onClick={() => setRevision(value => value + 1)}>{t('retry')}</button></div> : badges.length === 0 ? (
        <div className="empty-panel">{t('noBadgesYet')}</div>
      ) : (
        <div className="badge-row">
          {badges.map((b) => (
            <div className="badge-item" key={b.code}>
              <div className="badge-icon" style={{ background: 'var(--gold-soft)' }}>
                <Medal size={24} color="var(--gold)" />
              </div>
              <span className="badge-label">{b.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
