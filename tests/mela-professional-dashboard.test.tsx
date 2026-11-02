import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import StudentDashboard from '../src/pages/StudentDashboard'

const mocks = vi.hoisted(() => ({ dashboard: vi.fn(), badges: vi.fn() }))
vi.mock('../src/lib/dashboard', () => ({ fetchDashboard: mocks.dashboard }))
vi.mock('../src/lib/badges', () => ({ fetchMyBadges: mocks.badges }))

const data = {
  profile: { full_name: 'MELA Student' },
  passport: { profile_score: 48, badge_count: 3 },
  practice: { stats: { current_streak_days: 4 } },
  arena: { arena_achievements: 1 },
  feature_flags: { practice: true, career_passport: true, opportunities: true, academy: false },
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.dashboard.mockResolvedValue(data)
  mocks.badges.mockResolvedValue([])
})
afterEach(cleanup)

it('makes all quick-access cards open the actual learner routes', async () => {
  const onNavigate = vi.fn()
  render(<StudentDashboard onNavigate={onNavigate} />)
  await screen.findByRole('heading', { name: /One place for learning/ })
  const quickAccess = screen.getByRole('region', { name: 'Quick access to MELA features' })
  fireEvent.click(quickAccess.querySelectorAll('button')[0])
  fireEvent.click(quickAccess.querySelectorAll('button')[1])
  fireEvent.click(quickAccess.querySelectorAll('button')[2])
  expect(onNavigate.mock.calls.map(call => call[0])).toEqual(['passport','practice','opportunities'])
})

it('does not visually bypass server-disabled learning features', async () => {
  mocks.dashboard.mockResolvedValue({
    ...data, feature_flags: { practice:false, career_passport:false, opportunities:false,academy:false },
  })
  const onNavigate=vi.fn()
  render(<StudentDashboard onNavigate={onNavigate}/>)
  await screen.findByRole('heading', { name: /One place for learning/ })
  const quickAccess = screen.getByRole('region', { name: 'Quick access to MELA features' })
  const buttons = quickAccess.querySelectorAll('button')
  expect(buttons.length).toBe(3)
  for (const button of buttons) expect((button as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByText('Showing 18 of 18 MELA tools. Availability depends on your account and administrator settings.')).toBeTruthy()
  expect(onNavigate).not.toHaveBeenCalled()
})

it('ships the mobile layout and honors accessibility & low-data controls', () => {
  const css=readFileSync('src/mela-professional.css','utf8')
  const app=readFileSync('src/App.tsx','utf8')
  const entry=readFileSync('src/main.tsx','utf8')
  expect(entry).toContain("import './mela-professional.css'")
  expect(app).toContain('className="app-shell mela-professional"')
  expect(css).toContain('@media (max-width: 390px)')
  expect(css).toContain('@media (max-width: 620px)')
  expect(css).toContain('prefers-reduced-motion: no-preference')
  expect(css).toContain('html:not(.mela-reduced-motion):not(.mela-low-data)')
})

it('retains the original distinct backgrounds for every MELA section, not white-only cards', () => {
  const theme = readFileSync('src/styles.css','utf8')
  const professional = readFileSync('src/mela-professional.css','utf8')
  const dashboard = readFileSync('src/pages/StudentDashboard.tsx','utf8')
  const modules = [...dashboard.matchAll(/\{ key: '[a-z_]+', labelKey: '[a-zA-Z]+', blurbKey: '[a-zA-Z]+', view: '[a-z-]+', icon: [A-Za-z]+, cls: '(mc-[a-z_]+)'/g)]
    .map(match => match[1])
  expect(modules).toHaveLength(18)
  for (const selector of new Set(modules)) {
    expect(theme).toContain(`.${selector} { --module-start:`)
    expect(theme).toMatch(new RegExp(`\\.${selector} \\{ --module-start: #[a-f0-9]{6}; --module-end: #[a-f0-9]{6};`))
  }
  expect(professional).toContain('background-image: linear-gradient(135deg,var(--module-start')
  expect(professional).toContain('background-color: var(--module-end')
  expect(professional).toContain('background-image: none !important;')
  expect(professional).toContain('color: #fff; font-size: 1rem; line-height: 1.5;')
  expect(professional).toContain('color: #fff; font-size: 1.12rem;')
})

it('keeps readable section text and a narrow Android layout', () => {
  const css=readFileSync('src/mela-professional.css','utf8')
  expect(css).toContain('.mela-professional .dashboard-main .module-grid { grid-template-columns: 1fr; }')
  expect(css).toContain('.mela-professional .dash-main { font-size: 1rem; line-height: 1.6; }')
  expect(css).toContain('color: #fff; font-size: 1rem; line-height: 1.5;')
})
