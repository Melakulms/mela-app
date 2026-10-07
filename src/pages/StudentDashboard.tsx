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

  useEffect(() => {
    let active = true
    setError(''); setBadgeError(false)
    fetchDashboard().then(value => { if (active) setData(value) }).catch(() => { if (active) setError(t('dashboardLoadError')) })
    fetchMyBadges().then(value => { if (active) setBadges(value) }).catch(() => { if (active) setBadgeError(true) })
    return () => { active = false }
  }, [revision, t])

  if (error) return <div className="dash-main"><h1>{t('yourDashboard')}</h1><div className="banner banner-error" role="alert">{error}</div><button className="btn btn-primary" onClick={() => setRevision(value => value + 1)}>{t('tryAgain')}</button></div>
  if (!data) return <div className="dash-main" role="status"><div className="skeleton skeleton-title" /><div className="skeleton skeleton-card" /><p>{t('loadingDashboard')}</p></div>

  const { profile, passport, practice, arena, feature_flags } = data
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleModules = MODULES.filter(m => `${t(m.labelKey)} ${t(m.blurbKey)}`.toLocaleLowerCase().includes(normalizedQuery))

  return (
    <div className="dash-main dashboard-main">
      <div className="dash-greeting">
        <div><span className="eyebrow">{t('learningSpace')}</span><h1>{t('hello')}, {profile.full_name?.split(' ')[0] ?? t('there')} <span className="greeting-dot">.</span></h1><p>{t('dailyProgress')}</p></div>
      </div>

      <div className="stat-strip">
        <div><span className="stat-value">{passport.profile_score}</span><span className="stat-label">{t('score')}</span></div>
        <div><span className="stat-value">{passport.badge_count}</span><span className="stat-label">{t('badges')}</span></div>
        <div><span className="stat-value">{practice.stats.current_streak_days}</span><span className="stat-label">{t('streak')}</span></div>
        <div><span className="stat-value">{arena.arena_achievements}</span><span className="stat-label">{t('arena')}</span></div>
      </div>

      <section className="dashboard-hero"><div><span className="eyebrow">{t('keepMomentum')}</span><h2>{t('learnToday')}</h2><p>{t('explorePrompt')}</p></div>{feature_flags.practice && <button className="btn btn-primary" onClick={() => onNavigate('practice')}>{t('startPracticing')} <BookOpen size={18} /></button>}</section>
      <div className="section-heading"><div><h2>{t('exploreMela')}</h2><p>{t('exploreMelaHelp')}</p></div></div>
      <div className="field module-search"><label htmlFor="module-search">{t('findLearningTool')}</label><input id="module-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('searchLearningTools')} /></div>
      {visibleModules.length === 0 && <div className="empty-panel" role="status">{t('noToolsMatch')} “{query}”. <button className="password-toggle" onClick={() => setQuery('')}>{t('clearSearch')}</button></div>}
      <div className="module-grid">
        {visibleModules.map((m) => {
          const enabled = ['study_materials','mastery','opportunity_graph','mela_next','wallet','safety_center'].includes(m.key) ? true : (feature_flags[m.key] ?? m.enabled ?? false)
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
              {!enabled && <span className="soon">{t('notEnabledYet')}</span>}
              {enabled && !isBuilt && <span className="soon">{t('comingSoon')}</span>}
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
