// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '../src/i18n'
import Register from '../src/pages/Register'

const mocks = vi.hoisted(() => ({ registerUser: vi.fn(), registerBetaUser: vi.fn() }))
vi.mock('../src/lib/auth', () => ({ registerUser: mocks.registerUser, registerBetaUser: mocks.registerBetaUser }))

beforeEach(() => { vi.resetAllMocks(); localStorage.removeItem('mela_language'); window.history.replaceState(null, '', '/mela-app/?signup=email') })
afterEach(() => { cleanup(); localStorage.removeItem('mela_language'); window.history.replaceState(null, '', '/mela-app/') })

function fillEmailForm() {
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'MELA Learner' } })
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: ' Learner@Example.com ' } })
  fireEvent.change(screen.getByLabelText('Password', { exact: true }), { target: { value: 'A long test passphrase 2026' } })
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'A long test passphrase 2026' } })
}

it('offers student, family, teacher and company registration when email is explicitly selected', () => {
  render(<I18nProvider><Register onSwitchToLogin={vi.fn()} /></I18nProvider>)
  expect(screen.getByRole('heading', { name: 'Create your MELA account' })).toBeTruthy()
  expect(screen.getByLabelText('Email address')).toBeTruthy()
  expect(screen.queryByLabelText('Beta access code')).toBeNull()
  const role = screen.getByLabelText('I am registering as') as HTMLSelectElement
  expect(role.value).toBe('student')
  expect(Array.from(role.options).map(option => option.value)).toEqual(['student','parent','teacher','company'])
  expect(screen.queryByRole('option', { name: /admin/i })).toBeNull()
  expect(screen.getByRole('button', { name: 'Create account' })).toBeTruthy()
})

it('creates a family email account without a username or invitation code', async () => {
  const onRegistered = vi.fn()
  mocks.registerUser.mockResolvedValue({ data: { user: { id: 'test' }, session: null }, error: null })
  render(<I18nProvider><Register onSwitchToLogin={vi.fn()} onRegistered={onRegistered} /></I18nProvider>)
  fillEmailForm()
  fireEvent.change(screen.getByLabelText('I am registering as'), { target: { value: 'parent' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
  await waitFor(() => expect(mocks.registerUser).toHaveBeenCalledWith({
    email: 'learner@example.com', fullName: 'MELA Learner',
    password: 'A long test passphrase 2026', role: 'parent',
  }))
  expect(onRegistered).toHaveBeenCalledWith('learner@example.com')
  expect(mocks.registerBetaUser).not.toHaveBeenCalled()
})

it('rejects mismatched email signup passwords before requesting an account', () => {
  const view = render(<I18nProvider><Register onSwitchToLogin={vi.fn()} /></I18nProvider>)
  fillEmailForm()
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Mismatch passphrase' } })
  fireEvent.submit(view.container.querySelector('form')!)
  expect(screen.getByRole('alert').textContent).toContain('do not match')
  expect(mocks.registerUser).not.toHaveBeenCalled()
})

it('shows a retryable message when the signup service refuses an account', async () => {
  mocks.registerUser.mockResolvedValue({ data: { user: null, session: null }, error: { message: 'Signup temporarily unavailable' } })
  render(<I18nProvider><Register onSwitchToLogin={vi.fn()} /></I18nProvider>)
  fillEmailForm()
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Signup temporarily unavailable')
  expect((screen.getByRole('button', { name: 'Create account' }) as HTMLButtonElement).disabled).toBe(false)
})

it('keeps invitation signup for authorized educators and employers', () => {
  render(<I18nProvider><Register onSwitchToLogin={vi.fn()} /></I18nProvider>)
  fireEvent.click(screen.getByRole('button', { name: /Have an invitation code/ }))
  expect(screen.getByLabelText('Beta access code')).toBeTruthy()
  const options = Array.from((screen.getByLabelText('Account type (required)') as HTMLSelectElement).options).map(o => o.value)
  expect(options).toContain('teacher')
  expect(options).toContain('company')
  fireEvent.click(screen.getByRole('button', { name: /No invitation code/ }))
  expect(screen.getByLabelText('Email address')).toBeTruthy()
})

it('explains a mail-server failure instead of blaming registration details', async () => {
  mocks.registerUser.mockResolvedValue({ data: { user: null, session: null }, error: { message: 'Error sending confirmation email' } })
  render(<I18nProvider><Register onSwitchToLogin={vi.fn()} /></I18nProvider>)
  fillEmailForm()
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
  expect((await screen.findByRole('alert')).textContent).toContain('MELA could not send a confirmation email')
})


it.each([
  ['teacher','Teacher / educator'],
  ['company','Company / employer'],
] as const)('registers %s by email without admin privileges or invitation',async (value,label)=>{
  const onRegistered=vi.fn()
  mocks.registerUser.mockResolvedValue({data:{user:{id:'new-account'},session:null},error:null})
  render(<I18nProvider><Register onSwitchToLogin={vi.fn()} onRegistered={onRegistered}/></I18nProvider>)
  fillEmailForm()
  fireEvent.change(screen.getByLabelText('I am registering as'),{target:{value}})
  expect(screen.getByRole('option',{name:label})).toBeTruthy()
  expect(screen.getByRole('status').textContent).toContain('must verify')
  fireEvent.click(screen.getByRole('button',{name:'Create account'}))
  await waitFor(()=>expect(mocks.registerUser).toHaveBeenCalledWith({
    email:'learner@example.com',
    password:'A long test passphrase 2026',
    fullName:'MELA Learner',
    role:value,
  }))
  expect(onRegistered).toHaveBeenCalledWith('learner@example.com')
  expect(mocks.registerBetaUser).not.toHaveBeenCalled()
})


it('offers safe invitation signup after a live SMTP failure without disabling verification', async () => {
  mocks.registerUser.mockResolvedValue({ data: { user: null, session: null }, error: { message: '535 5.7.8 Authentication failed' } })
  render(<I18nProvider><Register onSwitchToLogin={vi.fn()} /></I18nProvider>)
  fillEmailForm()
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
  await screen.findByRole('button', { name: 'Register with an invitation code' })
  fireEvent.click(screen.getByRole('button', { name: 'Register with an invitation code' }))
  expect(screen.getByLabelText('Beta access code')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Register with an invitation code' })).toBeNull()
})

it('accepts a direct link to the invite-only beta registration screen', () => {
  const current = window.location.href
  try {
    window.history.replaceState(null, '', '/mela-app/?signup=invite')
    render(<I18nProvider><Register onSwitchToLogin={vi.fn()} /></I18nProvider>)
    expect(screen.getByLabelText('Beta access code')).toBeTruthy()
    expect(screen.queryByLabelText('Email address')).toBeNull()
  } finally {
    window.history.replaceState(null, '', current)
  }
})

it('defaults to invitation-code signup without asking for email', () => {
  window.history.replaceState(null, '', '/mela-app/')
  render(<I18nProvider><Register onSwitchToLogin={vi.fn()} /></I18nProvider>)
  expect(screen.getByLabelText('Beta access code')).toBeTruthy()
  expect(screen.queryByLabelText('Email address')).toBeNull()
  expect(screen.getByText(/one-time invitation verifies permission to join MELA/)).toBeTruthy()
})
