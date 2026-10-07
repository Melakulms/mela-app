import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import ResetPassword from '../src/pages/ResetPassword'
import Login from '../src/pages/Login'
import VerifyEmail from '../src/pages/VerifyEmail'
import App from '../src/App'

const mocks = vi.hoisted(() => ({
  updateUser: vi.fn(), getSession: vi.fn(), onAuthStateChange: vi.fn(),
  loginUser: vi.fn(), requestPasswordReset: vi.fn(), resetBetaPassword: vi.fn(), registerBetaUser: vi.fn(),
  logoutUser: vi.fn(), fetchOwnProfile: vi.fn(), fetchEnabledLanguages: vi.fn(),
}))
vi.mock('../src/lib/supabase', () => ({ supabase: { auth: {
  updateUser: mocks.updateUser, getSession: mocks.getSession, onAuthStateChange: mocks.onAuthStateChange,
} } }))
vi.mock('../src/lib/auth', () => ({ ...mocks, updatePreferredLanguage: vi.fn() }))
vi.mock('../src/lib/languages', () => ({ fetchEnabledLanguages: mocks.fetchEnabledLanguages }))

beforeEach(() => {
  vi.resetAllMocks()
  mocks.fetchEnabledLanguages.mockResolvedValue([])
  window.history.replaceState(null, '', '/')
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })
  mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
})
afterEach(cleanup)

describe('Password recovery', () => {
  it('keeps an expired link out of the password update flow', () => {
    render(<ResetPassword sessionReady={false} onComplete={vi.fn()} />)
    expect(screen.getByText(/invalid or expired/)).toBeTruthy()
    expect(screen.queryByLabelText('New password')).toBeNull()
  })

  it('rejects mismatching passwords before contacting Supabase', () => {
    render(<ResetPassword sessionReady onComplete={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'SecurePassword123' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'DifferentPassword123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }))
    expect(screen.getByRole('alert').textContent).toContain('do not match')
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })

  it('updates the password and requires a successful response before continuing', async () => {
    mocks.updateUser.mockResolvedValue({ error: null })
    const complete = vi.fn()
    render(<ResetPassword sessionReady onComplete={complete} />)
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'SecurePassword123' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'SecurePassword123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }))
    await screen.findByRole('status')
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'SecurePassword123' })
    expect(complete).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Continue to MELA' }))
    expect(complete).toHaveBeenCalledOnce()
  })

  it('opens the recovery screen when Supabase emits PASSWORD_RECOVERY', async () => {
    mocks.fetchOwnProfile.mockResolvedValue(null)
    render(<App />)
    await screen.findByRole('heading', { name: 'Welcome back' })
    const callback = mocks.onAuthStateChange.mock.calls[0][0]
    await act(async () => callback('PASSWORD_RECOVERY', { user: { id: 'recovery-user' } }))
    expect(screen.getByLabelText('New password')).toBeTruthy()
  })

  it('uses recovery-code flow for beta usernames instead of email reset', async () => {
    render(<Login onSwitchToRegister={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Email or beta username'), { target: { value: 'beta.learner' } })
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }))
    expect(await screen.findByRole('heading', { name: 'Recover beta access' })).toBeTruthy()
    expect(screen.getByLabelText('Recovery code')).toBeTruthy()
    expect(mocks.requestPasswordReset).not.toHaveBeenCalled()
  })
})

describe('Authentication failures', () => {
  it('restores the login button after a network failure', async () => {
    mocks.loginUser.mockRejectedValue(new Error('offline'))
    render(<Login onSwitchToRegister={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Email or beta username'), { target: { value: 'learner@example.invalid' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    await screen.findByRole('alert')
    expect((screen.getByRole('button', { name: 'Log in' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('does not switch accounts when signing out fails', async () => {
    mocks.logoutUser.mockResolvedValue({ error: new Error('signout failed') })
    const switchAccount = vi.fn()
    render(<VerifyEmail email="learner@example.invalid" onUseDifferentAccount={switchAccount} />)
    fireEvent.click(screen.getByRole('button', { name: 'Use a different account' }))
    await screen.findByText(/Could not sign out/)
    expect(switchAccount).not.toHaveBeenCalled()
  })

  it('offers retry instead of an endless spinner when the profile is missing', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'missing-profile' } } }, error: null })
    mocks.fetchOwnProfile.mockResolvedValue(null)
    render(<App />)
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(mocks.fetchOwnProfile).toHaveBeenCalledTimes(2))
  })
})


describe('App session ordering', () => {
  it('keeps password recovery open when an older empty snapshot arrives', async () => {
    let restore!: (value: unknown) => void
    mocks.getSession.mockReturnValue(new Promise(resolve => { restore = resolve }))
    mocks.fetchOwnProfile.mockResolvedValue(null)
    render(<App />)
    const callback = mocks.onAuthStateChange.mock.calls[0][0]
    await act(async () => callback('PASSWORD_RECOVERY', { user: { id: 'recovery-user' } }))
    expect(screen.getByLabelText('New password')).toBeTruthy()
    await act(async () => restore({ data: { session: null }, error: null }))
    expect(screen.getByLabelText('New password')).toBeTruthy()
    expect(screen.queryByText(/invalid or expired/)).toBeNull()
  })

  it('does not reload the signed-out account from a delayed snapshot', async () => {
    let restore!: (value: unknown) => void
    mocks.getSession.mockReturnValue(new Promise(resolve => { restore = resolve }))
    render(<App />)
    const callback = mocks.onAuthStateChange.mock.calls[0][0]
    await act(async () => callback('SIGNED_OUT', null))
    await act(async () => restore({ data: { session: { user: { id: 'old-account' } } }, error: null }))
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeTruthy()
    expect(mocks.fetchOwnProfile).not.toHaveBeenCalled()
  })
})


it('preserves a retryable profile error during token refresh', async () => {
  const session = { user: { id: 'missing-profile' } }
  mocks.getSession.mockResolvedValue({ data: { session }, error: null })
  mocks.fetchOwnProfile.mockResolvedValue(null)
  render(<App />)
  await screen.findByRole('alert')
  const callback = mocks.onAuthStateChange.mock.calls[0][0]
  await act(async () => callback('TOKEN_REFRESHED', { ...session }))
  expect(screen.getByRole('alert')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
})
