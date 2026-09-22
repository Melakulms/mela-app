import { useEffect, useState } from 'react'
import {
  ShieldCheck, Briefcase, GraduationCap, Trophy, Sparkles, Building2,
  BookOpen, Swords, FileText, Globe, Video, DollarSign, Medal,
} from 'lucide-react'
import { fetchDashboard, type MelaDashboard } from '../lib/dashboard'
import { fetchMyBadges, type EarnedBadge } from '../lib/badges'

const MODULES: { key: string; label: string; blurb: string; view?: string; icon: any; cls: string }[] = [
  { key: 'career_passport', label: 'Career Passport', blurb: 'Verified skills, badges & portable identity', view: 'passport', icon: ShieldCheck, cls: 'mc-career_passport' },
  { key: 'opportunities', label: 'Opportunity Hub', blurb: 'Verified jobs, internships & gigs', view: 'opportunities', icon: Briefcase, cls: 'mc-opportunities' },
  { key: 'academy', label: 'Skill Academy', blurb: 'Career-tied learning paths', view: 'academy', icon: GraduationCap, cls: 'mc-academy' },
  { key: 'challenges', label: 'Sponsored Challenges', blurb: 'Bank & company competitions', view: 'challenges', icon: Trophy, cls: 'mc-challenges' },
  { key: 'ai_career_coach', label: 'AI Career Coach', blurb: 'Personalized career pathing', view: 'coach', icon: Sparkles, cls: 'mc-coach' },
  { key: 'employer', label: 'Employer Portal', blurb: 'For companies to hire talent', icon: Building2, cls: 'mc-employer' },
  { key: 'practice', label: 'Practice', blurb: 'Drill curriculum topics', view: 'practice', icon: BookOpen, cls: 'mc-practice' },
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

export default function StudentDashboard({ onNavigate }: { onNavigate: (view: string) => void }) {
  const [data, setData] = useState<MelaDashboard | null>(null)
  const [badges, setBadges] = useState<EarnedBadge[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    fetchDashboard().then(setData).catch((e) => setError(e.message ?? 'Could not load your dashboard.'))
    fetchMyBadges().then(setBadges).catch(() => {})
  }, [])

  if (error) return <div className="dash-main"><div className="banner banner-error">{error}</div></div>
  if (!data) return <div className="centered-loading">Loading your dashboard…</div>

  const { profile, passport, practice, arena, feature_flags } = data

  return (
    <div className="dash-main">
      <p className="dash-quote">"Education is the most powerful weapon which you can use to change the world."</p>

      <div className="dash-greeting">
        <h1>Hi, {profile.full_name?.split(' ')[0] ?? 'there'}</h1>
      </div>

      <div className="stat-strip">
        <div><span className="stat-value">{passport.profile_score}</span><span className="stat-label">Score</span></div>
        <div><span className="stat-value">{passport.badge_count}</span><span className="stat-label">Badges</span></div>
        <div><span className="stat-value">{practice.stats.current_streak_days}</span><span className="stat-label">Streak</span></div>
        <div><span className="stat-value">{arena.arena_achievements}</span><span className="stat-label">Arena</span></div>
      </div>

      <div className="section-heading"><h2>Quick Actions</h2></div>
      <div className="module-grid">
        {MODULES.map((m) => {
          const enabled = ['study_materials','mastery','opportunity_graph','mela_next','wallet'].includes(m.key) ? true : feature_flags[m.key]
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
                <div className="module-icon"><Icon size={18} color="#fff" /></div>
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
      {badges.length === 0 ? (
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
