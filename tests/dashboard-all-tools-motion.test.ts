// @vitest-environment node
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const dashboard = readFileSync(new URL('../src/pages/StudentDashboard.tsx', import.meta.url), 'utf8')
const motion = readFileSync(new URL('../src/mela-motion.css', import.meta.url), 'utf8')

it('shows the complete MELA feature catalog on phones by default, even when Focus mode was saved', () => {
  expect(dashboard).toContain('const [showAllTools, setShowAllTools] = useState(true)')
  expect(dashboard).toContain('setShowAllTools(true)')
  expect(dashboard).toContain('visibleInFocusMode(m.key, focusMode, showAllTools || normalizedQuery.length > 0)')
  expect((dashboard.match(/\{ key: '[a-z_]+', labelKey:/g) ?? []).length).toBe(18)
  expect(dashboard).toContain('Availability depends on your account and administrator settings.')
  expect(dashboard).toContain('disabled={!isBuilt || !enabled}')
})

it('lets the user replay visible dashboard motion without overriding accessibility or low-data preferences', () => {
  expect(dashboard).toContain('setMotionReplay(run => run + 1)')
  expect(dashboard).toContain('key={`hero-${motionReplay}`}')
  expect(dashboard).toContain('key={`modules-${motionReplay}`}')
  expect(dashboard).toContain("devicePreferences.reducedMotion || devicePreferences.lowData")
  expect(dashboard).toContain("prefers-reduced-motion: reduce")
  expect(dashboard).toContain('Animation off — check Settings')
  expect(motion).toContain('animation: mela-tile-enter 700ms')
  expect(motion).toContain('prefers-reduced-motion: no-preference')
  expect(motion).toContain('html.mela-reduced-motion *')
  expect(motion).toContain('html.mela-low-data *')
})
