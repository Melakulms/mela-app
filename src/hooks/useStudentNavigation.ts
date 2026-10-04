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
  return view && Object.hasOwn(VIEW_LABELS, view) ? view as StudentView : 'dashboard'
}

export function useStudentNavigation() {
  const [view, setView] = useState<StudentView>(readStudentView)
  useEffect(() => {
    const restore = () => setView(readStudentView())
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
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
