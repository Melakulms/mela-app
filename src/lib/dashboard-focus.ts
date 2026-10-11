// Visibility only: backend feature flags and role authorizations still decide access.
// Safety, profile and foundational learning remain discoverable while focusing.
const FOCUS_MODULE_KEYS = new Set([
  'career_passport', 'safety_center', 'academy', 'practice', 'question_bank',
  'study_materials', 'scholarships', 'mentorship', 'mastery',
])

export function visibleInFocusMode(moduleKey: string, focusMode: boolean, showAll: boolean): boolean {
  return !focusMode || showAll || FOCUS_MODULE_KEYS.has(moduleKey)
}
