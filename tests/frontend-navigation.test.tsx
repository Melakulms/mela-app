import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readStudentView, useStudentNavigation } from '../src/hooks/useStudentNavigation'
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
