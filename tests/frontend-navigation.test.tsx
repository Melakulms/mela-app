import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readExplicitStudentDestination, readStudentView, useStudentNavigation } from '../src/hooks/useStudentNavigation'
import StudentDashboard from '../src/pages/StudentDashboard'

const mocks = vi.hoisted(() => ({ dashboard: vi.fn(), badges: vi.fn() }))
vi.mock('../src/lib/dashboard', () => ({ fetchDashboard: mocks.dashboard }))
vi.mock('../src/lib/badges', () => ({ fetchMyBadges: mocks.badges }))
const data = { profile: { full_name: 'Mela Learner' }, passport: { profile_score: 40, badge_count: 0 }, practice: { stats: { current_streak_days: 2 } }, arena: { arena_achievements: 0 }, feature_flags: { practice: true, wallet: false } }
beforeEach(() => { vi.resetAllMocks(); window.history.replaceState(null, '', '/mela-app/'); mocks.dashboard.mockResolvedValue(data); mocks.badges.mockResolvedValue([]) })
afterEach(cleanup)
function Navigation() { const [view, navigate] = useStudentNavigation(); return <><span>{view}</span><button onClick={() => navigate('practice')}>Open practice</button></> }
describe('Frontend navigation', () => {
  it('restores valid routes and rejects inherited or unknown route names', () => {
    for (const view of ['constructor', '__proto__', 'missing']) { window.history.replaceState(null, '', `?view=${view}`); expect(readStudentView()).toBe('dashboard') }
    window.history.replaceState(null, '', '?view=question-bank'); expect(readStudentView()).toBe('question-bank')
  })
  it('preserves the deployment path and auth parameters, and responds to browser history', () => {
    window.history.replaceState(null, '', '/mela-app/?source=email#auth-callback')
    render(<Navigation />)
    fireEvent.click(screen.getByText('Open practice'))
    expect(window.location.pathname).toBe('/mela-app/')
    expect(window.location.search).toBe('?source=email&view=practice')
    expect(window.location.hash).toBe('#auth-callback')
    act(() => { window.history.replaceState(null, '', '?view=profile'); window.dispatchEvent(new PopStateEvent('popstate')) })
    expect(screen.getByText('profile')).toBeTruthy()
  })
})
describe('Learning dashboard', () => {
  it('recovers from a failed load and distinguishes unavailable badges from an empty collection', async () => {
    mocks.dashboard.mockRejectedValueOnce(new Error('offline'))
    mocks.badges.mockRejectedValue(new Error('offline'))
    render(<StudentDashboard onNavigate={vi.fn()} />)
    await screen.findByRole('alert'); fireEvent.click(screen.getByText('Try again'))
    await screen.findByText('Explore MELA')
    expect(screen.getByText(/badges couldn’t load/)).toBeTruthy()
  })
  it('shows a clear Career Passport shortcut before the feature grid', async () => {
    const navigate = vi.fn()
    render(<StudentDashboard onNavigate={navigate} />)
    const button = await screen.findByRole('button', { name: 'Open Career Passport updates' })
    fireEvent.click(button)
    expect(navigate).toHaveBeenCalledWith('passport')
  })
  it('makes Career Passport accessible even when dashboard data fails', async () => {
    mocks.dashboard.mockRejectedValueOnce(new Error('offline'))
    render(<StudentDashboard onNavigate={vi.fn()} />)
    await screen.findByRole('alert')
    expect(screen.getAllByRole('button', { name: 'Open' }).length).toBeGreaterThanOrEqual(3)
  })
  it('searches learning tools and keeps explicitly disabled question banks disabled', async () => {
    mocks.dashboard.mockResolvedValue({ ...data, feature_flags: { question_bank: false } })
    render(<StudentDashboard onNavigate={vi.fn()} />)
    await screen.findByText('Explore MELA')
    fireEvent.change(screen.getByLabelText('Find a learning tool'), { target: { value: 'question bank' } })
    expect((screen.getByRole('button', { name: /Question Bank/ }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByText('Opportunity Hub')).toBeNull()
    fireEvent.change(screen.getByLabelText('Find a learning tool'), { target: { value: 'nomatch' } })
    expect(screen.getByRole('status').textContent).toContain('No tools match')
  })
})

it('routes Home on older Android browsers without Object.hasOwn', () => {
  const original = Object.hasOwn
  try {
    Object.hasOwn = undefined as any
    window.history.replaceState(null, '', '?view=dashboard')
    expect(readStudentView()).toBe('dashboard')
    window.history.replaceState(null, '', '?view=practice')
    expect(readStudentView()).toBe('practice')
  } finally { Object.hasOwn = original }
})

it('clears the previous route and settings history at an authentication boundary', () => {
  window.history.replaceState({melaSettingsOpen: true}, '', '/mela-app/?view=passport#settings-privacy')
  render(<Navigation />)
  expect(screen.getByText('passport')).toBeTruthy()
  act(() => window.dispatchEvent(new Event('mela:session-boundary')))
  expect(screen.getByText('dashboard')).toBeTruthy()
  expect(window.location.search).toBe('?view=dashboard')
  expect(window.location.hash).toBe('')
  expect(window.history.state).toBeNull()
})

it('opens supported explicit learning links including Mentorship after session restore', () => {
  for(const view of ['arena','scholarships','passport','mentorship'] as const) {
    cleanup()
    window.history.replaceState(null,'',`/mela-app/?view=${view}&mela_open=1&code=private#access_token=redacted`)
    expect(readExplicitStudentDestination()).toBe(view)
    render(<Navigation/>)
    act(() => window.dispatchEvent(new Event('mela:session-boundary')))
    expect(screen.getByText(view)).toBeTruthy()
    expect(window.location.search).toBe(`?view=${view}`)
    expect(window.location.hash).toBe('')
    expect(window.history.state).toBeNull()
  }
})

it('does not restore Mentorship from ordinary session history', () => {
  window.history.replaceState(null, '', '/?view=mentorship')
  expect(readExplicitStudentDestination()).toBeNull()
  render(<Navigation />)
  act(() => window.dispatchEvent(new Event('mela:session-boundary')))
  expect(screen.getByText('dashboard')).toBeTruthy()
})

it('opens the Mentorship card when enabled and respects an explicit disabled setting', async () => {
  const navigate = vi.fn()
  mocks.dashboard.mockResolvedValue({...data, feature_flags:{mentorship:true}})
  render(<StudentDashboard onNavigate={navigate} />)
  fireEvent.click(await screen.findByRole('button', {name:/Mentorship/i}))
  expect(navigate).toHaveBeenCalledWith('mentorship')
  cleanup()
  mocks.dashboard.mockResolvedValue({...data, feature_flags:{mentorship:false}})
  render(<StudentDashboard onNavigate={navigate} />)
  expect((await screen.findByRole('button', {name:/Mentorship/i}) as HTMLButtonElement).disabled).toBe(true)
})

it('does not reopen arbitrary private sections even when a link asks for it',()=>{
  window.history.replaceState(null,'','/mela-app/?view=profile&mela_open=1')
  render(<Navigation/>)
  act(()=>window.dispatchEvent(new Event('mela:session-boundary')))
  expect(screen.getByText('dashboard')).toBeTruthy()
  expect(window.location.search).toBe('?view=dashboard')
})

it('shows safe Arena and Scholarship learner pages even if dashboard omits feature flags',async()=>{
  mocks.dashboard.mockResolvedValue({
    ...data,feature_flags:{practice:true,arena:false,scholarships:false}
  })
  const navigate=vi.fn()
  render(<StudentDashboard onNavigate={navigate}/>)
  await screen.findByText('Explore MELA')
  const arena=screen.getByRole('button',{name:/Arena.*Join the arena/i}) as HTMLButtonElement
  expect(arena.disabled).toBe(false)
  fireEvent.click(arena)
  expect(navigate).toHaveBeenCalledWith('arena')
  const scholarship=screen.getByRole('button',{name:/EthioScholar Connect/i}) as HTMLButtonElement
  expect(scholarship.disabled).toBe(false)
  fireEvent.click(scholarship)
  expect(navigate).toHaveBeenCalledWith('scholarships')
})
