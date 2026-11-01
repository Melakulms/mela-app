import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from '../src/App'

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), onAuthStateChange: vi.fn(), loginUser: vi.fn(), logoutUser: vi.fn(), fetchOwnProfile: vi.fn(), from: vi.fn() }))
vi.mock('../src/lib/supabase', () => ({ supabase: { auth: { getSession: mocks.getSession, onAuthStateChange: mocks.onAuthStateChange }, from: mocks.from } }))
vi.mock('../src/lib/auth', () => ({ ...mocks, updatePreferredLanguage: vi.fn() }))
vi.mock('../src/lib/languages', () => ({ fetchEnabledLanguages: async () => [] }))
vi.mock('../src/pages/StudentDashboard', () => ({ default: () => <h1>Student home</h1> }))
vi.mock('../src/pages/EmployerPortal', () => ({ default: () => <h1>Employer home</h1> }))
vi.mock('../src/pages/RoleDashboard', () => ({ default: () => <h1>Mentor home</h1> }))

const replace = vi.fn()
beforeEach(() => {
  vi.resetAllMocks()
  window.history.replaceState(null, '', '/')
  const realWindow = window
  vi.stubGlobal('window', new Proxy(realWindow, { get(target, key) {
    if (key === 'location') return { ...target.location, replace }
    return Reflect.get(target, key)
  } }))
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })
  mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
  const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { status: 'approved' }, error: null }) }
  for (const method of ['select', 'eq', 'order', 'limit'] as const) query[method].mockReturnValue(query)
  mocks.from.mockReturnValue(query)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

async function signIn(role: string, overrides = {}) {
  const session = { user: { id: 'test-user', email: 'test@example.invalid', email_confirmed_at: '2026-11-01T00:00:00Z' } }
  mocks.fetchOwnProfile.mockResolvedValue({ id: 'test-user', role, account_status: 'active', email_verified: true, education_onboarding_completed: true, profile_completion: 100, preferred_language: 'English', ...overrides })
  mocks.loginUser.mockImplementation(async () => {
    const callback = mocks.onAuthStateChange.mock.calls.at(-1)![0]
    callback('SIGNED_IN', session)
    return { error: null }
  })
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Log in' }))
  fireEvent.change(screen.getByLabelText('Email or MELA username'), { target: { value: 'test@example.invalid' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'TestPassword123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
}

it.each(['admin', 'super_admin'])('shows only user sign-in for %s without admin links or redirection', async role => {
  await signIn(role)
  await screen.findByText('Sign in or register with a MELA user account to continue.')
  expect(replace).not.toHaveBeenCalled()
  expect(screen.queryByRole('link', { name: /admin/i })).toBeNull()
  expect(screen.queryByRole('button', { name: /switch/i })).toBeNull()
  expect(mocks.loginUser).toHaveBeenCalledWith('test@example.invalid', 'TestPassword123')
  expect(screen.queryByRole('heading', { name: 'Central Admin' })).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Account setup' })).toBeNull()
})
it.each([['student', 'Student home'], ['employer', 'Employer home'], ['mentor', 'Mentor home']])('preserves %s login routing', async (role, heading) => {
  await signIn(role)
  expect(await screen.findByRole('heading', { name: heading })).toBeTruthy()
  expect(replace).not.toHaveBeenCalled()
})
it('keeps an already signed-in admin on the user app during session restoration', async () => {
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'admin-user', email: 'admin@example.invalid', email_confirmed_at: '2026-11-01T00:00:00Z' } } }, error: null })
  mocks.fetchOwnProfile.mockResolvedValue({ id: 'admin-user', role: 'admin', account_status: 'active', email_verified: true, preferred_language: 'English' })
  render(<App />)
  await screen.findByText('Sign in or register with a MELA user account to continue.')
  expect(replace).not.toHaveBeenCalled()
  expect(screen.queryByRole('link', { name: /admin/i })).toBeNull()
  expect(screen.queryByRole('button', { name: /switch/i })).toBeNull()
})
it('preserves account restrictions before redirecting an admin', async () => {
  await signIn('admin', { account_status: 'suspended' })
  await screen.findByRole('heading', { name: 'Account unavailable' })
  expect(replace).not.toHaveBeenCalled()
})

it('allows a user to sign in after restoring a non-user account', async () => {
  await signIn('admin')
  await screen.findByText('Sign in or register with a MELA user account to continue.')
  mocks.fetchOwnProfile.mockResolvedValue({ id: 'student-user', role: 'student', account_status: 'active', email_verified: true, education_onboarding_completed: true, preferred_language: 'English' })
  mocks.loginUser.mockImplementation(async () => {
    mocks.onAuthStateChange.mock.calls.at(-1)![0]('SIGNED_IN', { user: { id: 'student-user', email: 'student@example.invalid', email_confirmed_at: '2026-11-01T00:00:00Z' } })
    return { error: null }
  })
  fireEvent.change(screen.getByLabelText('Email or MELA username'), { target: { value: 'student@example.invalid' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'TestPassword123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  await screen.findByRole('heading', { name: 'Student home' })
  expect(replace).not.toHaveBeenCalled()
  expect(screen.queryByText('Sign in or register with a MELA user account to continue.')).toBeNull()
})

// A confirmation screen must not survive a successful login and later logout.
it('returns to login after signing out of a restored student session', async () => {
  await signIn('student')
  await screen.findByRole('heading', { name: 'Student home' })
  act(() => mocks.onAuthStateChange.mock.calls.at(-1)![0]('SIGNED_OUT', null))
  expect(await screen.findByLabelText('Email or MELA username')).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'Student home' })).toBeNull()
})
