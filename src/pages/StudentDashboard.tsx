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
import { audienceAllowsStudentModule, type StudentAudience } from '../lib/feature-audience'
import type { Scholarship } from '../lib/scholarships'
import type { LearnerDiscoveryProfile } from '../lib/learner-discovery'
import type { Course, Enrollment } from '../lib/academy'
import { profilePreparationChecklist, nearDeadline, recommendCourses } from '../lib/personal-learning'

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

export default function StudentDashboard({ onNavigate, audience = { stage: null, grade: null } }: { onNavigate: (view: StudentView) => void; audience?: StudentAudience }) {
  const { t } = useI18n()
  const [data, setData] = useState<MelaDashboard | null>(null)
  const [badges, setBadges] = useState<EarnedBadge[]>([])
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [query, setQuery] = useState('')
  const [badgeError, setBadgeError] = useState(false)
  const [suggestedScholarships, setSuggestedScholarships] = useState<{ item: Scholarship; reasons: string[] }[]>([])
  const [discoveryProfile, setDiscoveryProfile] = useState<LearnerDiscoveryProfile | null>(null)
  const [courseEnrollments, setCourseEnrollments] = useState<Enrollment[]>([])
  const [courseRecommendations, setCourseRecommendations] = useState<{ course: Course; reasons: string[] }[]>([])
  const [studyGoalMinutes, setStudyGoalMinutes] = useState<number | null>(null)
  const [showDeadlineNotices, setShowDeadlineNotices] = useState(false)

  useEffect(() => {
    let active = true
    setError(''); setBadgeError(false)
    fetchDashboard().then(value => { if (active) setData(value) }).catch(() => { if (active) setError(t('dashboardLoadError')) })
    fetchMyBadges().then(value => { if (active) setBadges(value) }).catch(() => { if (active) setBadgeError(true) })
    return () => { active = false }
  }, [revision, t])

  useEffect(() => {
    let active = true
    void Promise.all([import('../lib/learner-discovery'), import('../lib/scholarships')]).then(async ([discovery, scholarships]) => {
      const preferences = await discovery.fetchLearnerDiscoveryProfile()
      if (active) setDiscoveryProfile(preferences)
      if (!preferences.enable_suggestions || (!preferences.interest_fields.length && !preferences.preferred_study_countries.length && preferences.target_degree_level === 'any')) {
        if (active) setSuggestedScholarships([])
        return
      }
      const available = await scholarships.fetchOpenScholarships()
      const matches = discovery.rankScholarships(available, preferences).filter(row => row.score > 0).slice(0, 3)
      if (active) setSuggestedScholarships(matches)
    }).catch(() => {
      // Scholarship explorer still provides the full verified catalogue if personalization is not configured.
      if (active) setSuggestedScholarships([])
    })
    return () => { active = false }
  }, [revision])

  useEffect(() => {
    let active = true
    void import('../lib/academy').then(async academy => {
      const enrollments = await academy.fetchMyEnrollments()
      if (active) setCourseEnrollments(enrollments)
      if (!discoveryProfile) return
      const catalog = await academy.fetchCourses()
      const ranked = recommendCourses(catalog, discoveryProfile, new globalThis.Map<string, Enrollment>(enrollments.map(row => [row.course_id, row])))
        .filter(row => row.score > 0).slice(0, 3).map(row => ({ course: row.course, reasons: row.reasons }))
      if (active) setCourseRecommendations(ranked)
    }).catch(() => {
      // Other dashboard data remains usable if learning catalogue or progress is unavailable.
    })
    return () => { active = false }
  }, [revision, discoveryProfile])

  useEffect(() => {
    let active = true
    void import('../lib/user-settings').then(module => module.fetchUserSettings()).then(settings => {
      if (!active) return
      setStudyGoalMinutes(settings.daily_study_minutes)
      setShowDeadlineNotices(settings.notify_opportunities)
    }).catch(() => {
      if (active) { setStudyGoalMinutes(null); setShowDeadlineNotices(false) }
    })
    return () => { active = false }
  }, [revision])

  if (error) return <div className="dash-main"><h1>{t('yourDashboard')}</h1><div className="banner banner-error" role="alert">{error}</div><button className="btn btn-primary" onClick={() => setRevision(value => value + 1)}>{t('tryAgain')}</button></div>
  if (!data) return <div className="dash-main" role="status"><div className="skeleton skeleton-title" /><div className="skeleton skeleton-card" /><p>{t('loadingDashboard')}</p></div>

  const { profile, passport, practice, arena, feature_flags } = data
  const checklist = discoveryProfile ? profilePreparationChecklist(audience.stage, audience.grade, discoveryProfile) : null
  const readiness = checklist ? Math.round(100 * checklist.filter(row => row.complete).length / checklist.length) : null
  const ongoing = courseEnrollments.filter(row => !row.completed_at).length
  const finished = courseEnrollments.filter(row => !!row.completed_at).length
  const answered = Number(practice.stats.total_questions ?? 0)
  const correct = Number(practice.stats.correct_answers ?? 0)
  const accuracy = answered > 0 ? Math.round((100 * correct) / answered) : null
  const today = new Date()
  const todayISO = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-')
  const deadlines = showDeadlineNotices ? suggestedScholarships.map(row => ({ ...row, days: nearDeadline(row.item.deadline, todayISO) }))
    .filter((row): row is typeof row & { days: number } => row.days !== null) : []
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleModules = MODULES.filter(m => audienceAllowsStudentModule(m.key, audience)).filter(m => `${t(m.labelKey)} ${t(m.blurbKey)}`.toLocaleLowerCase().includes(normalizedQuery))

  return (
    <div className="dash-main dashboard-main">
      <div className="dash-greeting">
        <div><span className="eyebrow">{t('learningSpace')}</span><h1>{t('hello')}, {profile.full_name?.split(' ')[0] ?? t('there')} <span className="greeting-dot">.</span></h1><p>{t('dailyProgress')}</p></div>
      </div>

      <div className="settings-panel">
        <div className="section-heading"><h2>Your learning profile</h2><button className="btn btn-secondary" type="button" onClick={() => onNavigate('profile')}>Edit profile</button></div>
        <p>{audience.stage?.startsWith('school_') ? `Grade ${audience.grade ?? 'not set'} · Grade-matched curriculum` : 'Higher education and career learning'}. Add subjects and interests to get suggested scholarships and opportunities.</p>
        <button className="btn btn-secondary" type="button" onClick={() => onNavigate('scholarships')}>Discover scholarships</button>
      </div>
      {readiness !== null && <section className="settings-panel" aria-label="Discovery profile readiness">
        <div className="section-heading"><h2>My profile preparation</h2><strong>{readiness}%</strong></div>
        <progress value={readiness} max={100} aria-label="Discovery preferences completed" style={{width:'100%'}}/>
        <p className="settings-note">This measures optional profile preferences, not verified identity, grades, school records or scholarship eligibility.</p>
        {checklist?.filter(step => !step.complete).slice(0, 2).map(step => <p key={step.label} className="settings-note">Next step: {step.label}</p>)}
        {readiness < 100 && <button className="btn btn-secondary" onClick={() => onNavigate('profile')}>Complete preferences</button>}
      </section>}
      {courseEnrollments.length > 0 && <section className="settings-panel" aria-label="Course progress">
        <h2>My course progress</h2>
        <p><strong>{ongoing}</strong> courses in progress · <strong>{finished}</strong> recorded complete</p>
        <button className="btn btn-secondary" onClick={() => onNavigate('academy')}>Open my courses</button>
      </section>}
      {courseRecommendations.length > 0 && <section className="settings-panel" aria-label="Suggested learning courses">
        <div className="section-heading"><h2>Learning suggested for you</h2><button className="btn btn-secondary" onClick={() => onNavigate('academy')}>Explore courses</button></div>
        {courseRecommendations.map(({course, reasons}) => <p key={course.id}><strong>{course.title}</strong> — {reasons.join(' · ')}</p>)}
      </section>}
      {deadlines.length > 0 && <section className="settings-panel" aria-label="Scholarship deadlines">
        <h2>Upcoming scholarship deadlines</h2>
        {deadlines.map(row => <p key={row.item.id}><strong>{row.item.title}</strong>: {row.days === 0 ? 'deadline listed as today' : row.days + ' days until listed deadline'}</p>)}
        <p className="settings-note">These are in-app notices based on the published deadline and your preferences. No email, SMS or push notification has been scheduled.</p>
        <button className="btn btn-secondary" onClick={() => onNavigate('scholarships')}>Review requirements</button>
      </section>}
      {suggestedScholarships.length > 0 && <section className="settings-panel" aria-label="Suggested scholarships">
        <div className="section-heading"><h2>Suggested scholarships</h2><button className="btn btn-secondary" onClick={() => onNavigate('scholarships')}>See all</button></div>
        <p className="settings-note">Based on your submitted interests and study goals. Matches are not verified admission or funding eligibility.</p>
        {suggestedScholarships.map(({item, reasons}) => <div className="list-row" key={item.id}>
          <div><strong>{item.title}</strong><p className="settings-note">{item.study_country ?? 'International'} · {reasons.join(', ')}</p></div>
        </div>)}
      </section>}
      <section className="settings-panel" aria-label="Practice learning history">
        <h2>My practice record</h2>
        <p><strong>{practice.stats.total_sessions}</strong> sessions recorded · <strong>{answered}</strong> questions answered{accuracy !== null ? ` · ${accuracy}% correct` : ''}</p>
        <p className="settings-note">These are your saved practice statistics, not teacher-verified examination results.{studyGoalMinutes !== null ? ` Your selected daily study target is ${studyGoalMinutes} minutes.` : ''}</p>
        <button className="btn btn-secondary" onClick={() => onNavigate('practice')}>Practice by subject</button>
      </section>
      <div className="stat-strip">
        <div><span className="stat-value">{passport.profile_score}</span><span className="stat-label">{t('score')}</span></div>
        <div><span className="stat-value">{passport.badge_count}</span><span className="stat-label">{t('badges')}</span></div>
        <div><span className="stat-value">{practice.stats.current_streak_days}</span><span className="stat-label">{t('streak')}</span></div>
        <div><span className="stat-value">{arena.arena_achievements}</span><span className="stat-label">{t('arena')}</span></div>
      </div>

      <section className="settings-panel" aria-label="Suggested next learning steps">
        <h2>Suggested next learning steps</h2>
        <p className="settings-note">These links are based on your saved records. They are not automatically graded or counted as completed activities.</p>
        {courseRecommendations.length > 0 && <div className="list-row"><div><strong>Continue learning</strong><p className="settings-note">{courseRecommendations[0].course.title}</p></div>
          <button className="btn btn-secondary" onClick={() => onNavigate('academy')}>Open course</button></div>}
        {practice.recommendations.length > 0 && <div className="list-row"><div><strong>Practice a recommended topic</strong><p className="settings-note">{practice.recommendations[0].subject} · {practice.recommendations[0].topic}</p></div>
          <button className="btn btn-secondary" onClick={() => onNavigate('practice')}>Practice</button></div>}
        {suggestedScholarships.length > 0 && <div className="list-row"><div><strong>Review a matching scholarship</strong><p className="settings-note">{suggestedScholarships[0].item.title}</p></div>
          <button className="btn btn-secondary" onClick={() => onNavigate('scholarships')}>Review</button></div>}
        {courseRecommendations.length === 0 && practice.recommendations.length === 0 && suggestedScholarships.length === 0 &&
          <div className="list-row"><div><strong>Build your plan</strong><p className="settings-note">Choose subjects and study goals to find relevant published learning content.</p></div>
          <button className="btn btn-secondary" onClick={() => onNavigate('profile')}>Set goals</button></div>}
      </section>

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
