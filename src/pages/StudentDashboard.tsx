import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { StudentView } from '../hooks/useStudentNavigation'
import {
  ShieldCheck, Briefcase, GraduationCap, Trophy, Sparkles,
  BookOpen, Swords, FileText, Globe, Video, DollarSign, Medal, Brain, Map, Route, WalletCards, ClipboardCheck,
} from 'lucide-react'
import { fetchDashboard, type MelaDashboard } from '../lib/dashboard'
import { fetchMyBadges, type EarnedBadge } from '../lib/badges'

const MODULES: { key: string; label: string; blurb: string; view?: StudentView; icon: LucideIcon; cls: string; enabled?: boolean }[] = [
  { key: 'career_passport', label: 'Career Passport', blurb: 'Verified skills, badges & portable identity', view: 'passport', icon: ShieldCheck, cls: 'mc-career_passport' },
  { key: 'opportunities', label: 'Opportunity Hub', blurb: 'Verified jobs, internships & gigs', view: 'opportunities', icon: Briefcase, cls: 'mc-opportunities' },
  { key: 'academy', label: 'Skill Academy', blurb: 'Career-tied learning paths', view: 'academy', icon: GraduationCap, cls: 'mc-academy' },
  { key: 'challenges', label: 'Sponsored Challenges', blurb: 'Bank & company competitions', view: 'challenges', icon: Trophy, cls: 'mc-challenges' },
  { key: 'ai_career_coach', label: 'AI Career Coach', blurb: 'Personalized career pathing', view: 'coach', icon: Sparkles, cls: 'mc-coach' },
  { key: 'practice', label: 'Practice', blurb: 'Drill curriculum topics', view: 'practice', icon: BookOpen, cls: 'mc-practice' },
  { key: 'question_bank', label: 'Question Bank', blurb: 'Access the full grade-matched MELA question bank', view: 'question-bank', icon: BookOpen, cls: 'mc-practice', enabled: true },
  { key: 'arena', label: 'Arena', blurb: 'Join the arena', view: 'arena', icon: Swords, cls: 'mc-arena' },
  { key: 'study_materials', label: 'Study Materials', blurb: 'Short notes & summaries', view: 'materials', icon: FileText, cls: 'mc-materials' },
  { key: 'scholarships', label: 'EthioScholar Connect', blurb: 'Global scholarship discovery', view: 'scholarships', icon: Globe, cls: 'mc-scholarships' },
  { key: 'mentorship', label: 'Mentorship', blurb: '1:1 mentorship & interview practice', view: 'mentorship', icon: Video, cls: 'mc-mentorship' },
  { key: 'mastery', label: 'My Mastery Map', blurb: 'See mastered, developing and next skills', view: 'mastery', icon: Brain, cls: 'mc-mastery' },
  { key: 'opportunity_graph', label: 'My Future Map', blurb: 'Connect learning to future pathways', view: 'opportunity-graph', icon: Map, cls: 'mc-graph' },
  { key: 'mela_next', label: 'Mela Next', blurb: 'Set and follow your next transition goal', view: 'mela-next', icon: Route, cls: 'mc-next' },
  { key: 'wallet', label: 'Mela Wallet', blurb: 'Earnings, ledger and payout status', view: 'wallet', icon: WalletCards, cls: 'mc-wallet' },
  { key: 'assessments', label: 'Verified Assessments', blurb: 'Skill verification for career readiness', view: 'assessments', icon: ClipboardCheck, cls: 'mc-assessments' },
  { key: 'earn_work', label: 'Earn & Work', blurb: 'Freelance & escrow tasks', view: 'earn-work', icon: DollarSign, cls: 'mc-earn_work' },
]

export default function StudentDashboard({ onNavigate }: { onNavigate: (view: StudentView) => void }) {
  const [data, setData] = useState<MelaDashboard | null>(null)
  const [badges, setBadges] = useState<EarnedBadge[]>([])
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [query, setQuery] = useState('')
  const [badgeError, setBadgeError] = useState(false)

  useEffect(() => {
    let active = true
    setError(''); setBadgeError(false)
    fetchDashboard().then(value => { if (active) setData(value) }).catch(() => { if (active) setError('Could not load your dashboard. Check your connection and try again.') })
    fetchMyBadges().then(value => { if (active) setBadges(value) }).catch(() => { if (active) setBadgeError(true) })
    return () => { active = false }
  }, [revision])

  if (error) return <div className="dash-main"><h1>Your dashboard</h1><div className="banner banner-error" role="alert">{error}</div><button className="btn btn-primary" onClick={() => setRevision(value => value + 1)}>Try again</button></div>
  if (!data) return <div className="dash-main" role="status"><div className="skeleton skeleton-title" /><div className="skeleton skeleton-card" /><p>Loading your dashboard…</p></div>

  const { profile, passport, practice, arena, feature_flags } = data

  return (
    <div className="dash-main dashboard-main">

      <div className="dash-greeting">
        <div><span className="eyebrow">YOUR LEARNING SPACE</span><h1>Hi, {profile.full_name?.split(' ')[0] ?? 'there'} <span className="greeting-dot">.</span></h1><p>A little progress today. More possibilities tomorrow.</p></div>
      </div>

      <div className="stat-strip">
        <div><span className="stat-value">{passport.profile_score}</span><span className="stat-label">Score</span></div>
        <div><span className="stat-value">{passport.badge_count}</span><span className="stat-label">Badges</span></div>
        <div><span className="stat-value">{practice.stats.current_streak_days}</span><span className="stat-label">Streak</span></div>
        <div><span className="stat-value">{arena.arena_achievements}</span><span className="stat-label">Arena</span></div>
      </div>

      <section className="dashboard-hero"><div><span className="eyebrow">KEEP YOUR MOMENTUM</span><h2>What will you learn today?</h2><p>Explore your curriculum, sharpen a skill, or discover your next opportunity.</p></div>{feature_flags.practice && <button className="btn btn-primary" onClick={() => onNavigate('practice')}>Start practicing <BookOpen size={18} /></button>}</section>
      <div className="section-heading"><div><h2>Explore MELA</h2><p>Everything you need for your next step.</p></div></div>
      <div className="field module-search"><label htmlFor="module-search">Find a learning tool</label><input id="module-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search practice, scholarships, skills…" /></div>
      {MODULES.filter(m => `${m.label} ${m.blurb}`.toLowerCase().includes(query.trim().toLowerCase())).length === 0 && <div className="empty-panel" role="status">No tools match “{query}”. <button className="password-toggle" onClick={() => setQuery('')}>Clear search</button></div>}
      <div className="module-grid">
        {MODULES.filter(m => `${m.label} ${m.blurb}`.toLowerCase().includes(query.trim().toLowerCase())).map((m) => {
          const enabled = ['study_materials','mastery','opportunity_graph','mela_next','wallet'].includes(m.key) ? true : (feature_flags[m.key] ?? m.enabled ?? false)
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
                <h3>{m.label}</h3>
                <p>{m.blurb}</p>
              </div>
              {!enabled && <span className="soon">Not enabled yet</span>}
              {enabled && !isBuilt && <span className="soon">Coming soon</span>}
            </button>
          )
        })}
      </div>

      <div className="section-heading"><h2>Your Badges</h2></div>
      {badgeError ? <div className="empty-panel" role="status">Your badges couldn’t load. <button className="password-toggle" onClick={() => setRevision(value => value + 1)}>Retry</button></div> : badges.length === 0 ? (
        <div className="empty-panel">No badges earned yet — they come from verified skills, courses, and mentorship.</div>
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
