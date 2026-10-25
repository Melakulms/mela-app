import { useEffect, useState } from 'react'

export const VIEW_LABELS = {
  dashboard: 'Dashboard', practice: 'Practice', opportunities: 'Opportunity Hub',
  materials: 'Study Materials', academy: 'Skill Academy', mentorship: 'Mentorship',
  passport: 'Career Passport', coach: 'AI Career Coach', arena: 'Arena', profile: 'Profile',
  scholarships: 'Scholarships', mastery: 'My Mastery Map', 'opportunity-graph': 'My Future Map',
  'mela-next': 'Mela Next', wallet: 'Mela Wallet', challenges: 'Challenges',
  assessments: 'Assessments', 'earn-work': 'Earn & Work', 'question-bank': 'Question Bank',
  safety: 'Safety & Privacy',
} as const
export type StudentView = keyof typeof VIEW_LABELS

export function readStudentView(): StudentView {
  const view = new URLSearchParams(window.location.search).get('view')
  return view && Object.prototype.hasOwnProperty.call(VIEW_LABELS, view) ? view as StudentView : 'dashboard'
}

export function useStudentNavigation() {
  const [view, setView] = useState<StudentView>(readStudentView)
  useEffect(() => {
    const restore = () => setView(readStudentView())
    const reset = () => {
      // A restored session normally starts at Home to avoid reopening private
      // previous screens. An explicitly shared Arena or Scholarships entry is
      // a deliberate public section request, not session-history restoration.
      const params = new URLSearchParams(window.location.search)
      const requested = params.get('view')
      const explicit = params.get('mela_open') === '1' &&
        (requested === 'arena' || requested === 'scholarships')
      const next: StudentView = explicit ? requested as StudentView : 'dashboard'
      // Discard old OAuth/recovery parameters and consume the one-time intent.
      window.history.replaceState(null, '', window.location.pathname + '?view=' + next)
      setView(next)
    }
    window.addEventListener('mela:session-boundary', reset)
    window.addEventListener('popstate', restore)
    return () => { window.removeEventListener('popstate', restore); window.removeEventListener('mela:session-boundary', reset) }
  }, [])
  const navigate = (next: StudentView) => {
    if (next === view) return
    const url = new URL(window.location.href)
    url.searchParams.set('view', next)
    window.history.pushState(null, '', url)
    setView(next)
  }
  return [view, navigate] as const
}

