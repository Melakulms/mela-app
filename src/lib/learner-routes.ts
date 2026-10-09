import { VIEW_LABELS, type StudentView } from '../hooks/useStudentNavigation'

// Only built learner destinations can become internal navigation actions.
const aliases: Record<string, StudentView> = {
  skill_academy: 'academy', skillAcademy: 'academy', study_materials: 'materials',
  opportunity_hub: 'opportunities', opportunity_graph: 'opportunity-graph',
  career_passport: 'passport', mela_next: 'mela-next', question_bank: 'question-bank',
  verified_assessments: 'assessments', ai_career_coach: 'coach',
}
export function learnerRoute(value: unknown): StudentView | null {
  if (typeof value !== 'string') return null
  const key = value.trim()
  // Financial features remain deferred, including server-provided route keys.
  if (key === 'wallet' || key === 'earn-work' || key === 'earn_work') return null
  if (Object.hasOwn(VIEW_LABELS, key)) return key as StudentView
  return Object.hasOwn(aliases, key) ? aliases[key] : null
}
