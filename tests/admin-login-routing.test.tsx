import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from '../src/App'

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), onAuthStateChange: vi.fn(), loginUser: vi.fn(), logoutUser: vi.fn(), fetchOwnProfile: vi.fn(), from: vi.fn() }))
vi.mock('../src/lib/supabase', () => ({ supabase: { auth: { getSession: mocks.getSession, onAuthStateChange: mocks.onAuthStateChange }, from: mocks.from } }))
vi.mock('../src/lib/auth', () => ({ ...mocks, updatePreferredLanguage: vi.fn() }))
vi.mock('../src/lib/languages', () => ({ fetchEnabledLanguages: async () => [] }))
vi.mock('../src/pages/StudentDashboard', () => ({ default: () => <h1>Student home</h1> }))
vi.mock('../src/pages/EmployerPortal', () => ({ default: () => <h1>Employer home</h1> }))
vi.mock('../src/pages/RoleDashboard', () => ({ default: () => <h1>Mentor home</h1> }))

const replace = vi.fn()
const destination = 'https://melakulms.github.io/Mela-central-dashboard-/'
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
  const session = { user: { id: 'test-user' } }
  mocks.fetchOwnProfile.mockResolvedValue({ id: 'test-user', role, account_status: 'active', email_verified: true, education_onboarding_completed: true, profile_completion: 100, preferred_language: 'English', ...overrides })
  mocks.loginUser.mockImplementation(async () => {
    const callback = mocks.onAuthStateChange.mock.calls.at(-1)![0]
    callback('SIGNED_IN', session)
    return { error: null }
  })
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Log in' }))
  fireEvent.change(screen.getByLabelText('Email or beta username'), { target: { value: 'test@example.invalid' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'TestPassword123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
}

it.each(['admin', 'super_admin'])('keeps %s in the user app until they explicitly choose the admin link', async role => {
  await signIn(role)
  await screen.findByRole('heading', { name: 'MELA User App' })
  expect(replace).not.toHaveBeenCalled()
  expect(screen.getByRole('link', { name: 'Open the separate Admin app' }).getAttribute('href')).toBe(destination)
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
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'admin-user' } } }, error: null })
  mocks.fetchOwnProfile.mockResolvedValue({ id: 'admin-user', role: 'admin', account_status: 'active', email_verified: true, preferred_language: 'English' })
  render(<App />)
  await screen.findByRole('heading', { name: 'MELA User App' })
  expect(replace).not.toHaveBeenCalled()
  expect(screen.getByRole('link', { name: 'Open the separate Admin app' }).getAttribute('href')).toBe(destination)
})
it('preserves account restrictions before redirecting an admin', async () => {
  await signIn('admin', { account_status: 'suspended' })
  await screen.findByRole('heading', { name: 'Account unavailable' })
  expect(replace).not.toHaveBeenCalled()
})

it('switches from a saved admin session to user sign-in without navigating to Admin', async () => {
  await signIn('admin')
  await screen.findByRole('heading', { name: 'MELA User App' })
  mocks.logoutUser.mockImplementation(async () => {
    mocks.onAuthStateChange.mock.calls.at(-1)![0]('SIGNED_OUT', null)
    return { error: null }
  })
  fireEvent.click(screen.getByRole('button', { name: 'Switch to a user account' }))
  await screen.findByLabelText('Email or beta username')
  expect(replace).not.toHaveBeenCalled()
})
