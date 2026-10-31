// @vitest-environment jsdom
import {afterEach, beforeEach, expect, it, vi} from 'vitest'
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {I18nProvider} from '../src/i18n'
import Register from '../src/pages/Register'

const mocks = vi.hoisted(() => ({ registerBetaUser: vi.fn(), registerUser: vi.fn() }))
vi.mock('../src/lib/auth', () => ({ registerBetaUser: mocks.registerBetaUser, registerUser: mocks.registerUser }))

beforeEach(() => {
  vi.resetAllMocks()
  window.history.replaceState(null, '', '/mela-app/')
  localStorage.removeItem('mela_language')
})
afterEach(() => { cleanup(); localStorage.removeItem('mela_language') })

function openForm() {
  const view = render(<I18nProvider><Register onSwitchToLogin={vi.fn()}/></I18nProvider>)
  const role = screen.getByLabelText('Account type (required)') as HTMLSelectElement
  return { ...view, role }
}

it('requires an account type before calling the invite signup service', () => {
  const { role, container } = openForm()
  expect(role.value).toBe('')
  fireEvent.submit(container.querySelector('form')!)
  expect(screen.getByRole('alert').textContent).toContain('Select your account type')
  expect(mocks.registerBetaUser).not.toHaveBeenCalled()
})

it.each([
  ['student', 'Student / learner'],
  ['parent', 'Parent / family or guardian'],
  ['teacher', 'Teacher / educator'],
  ['company', 'Employer / organization'],
] as const)('submits the %s role with the invitation for server-side matching', async (value, label) => {
  const { role } = openForm()
  fireEvent.change(role,{ target: { value } })
  expect(role.value).toBe(value)
  expect(screen.getByRole('option',{name:label})).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Full name'),{ target: { value:'MELA Test' } })
  fireEvent.change(screen.getByLabelText('Username'),{ target: { value:'mela.test' } })
  fireEvent.change(screen.getByLabelText('Beta access code'),{ target: { value:'test-invite-token-not-real' } })
  fireEvent.change(screen.getByLabelText('Password',{exact:true}),{ target: { value:'SecurePassword123' } })
  fireEvent.change(screen.getByLabelText('Confirm password'),{ target: { value:'SecurePassword123' } })
  mocks.registerBetaUser.mockResolvedValueOnce({created:true,username:'mela.test',role:value,recovery_code:'MELA-R-test',recovery_notice:'Save code'})
  fireEvent.click(screen.getByRole('button',{name:'Create beta account'}))
  await waitFor(() => expect(mocks.registerBetaUser).toHaveBeenCalledWith(expect.objectContaining({role:value,username:'mela.test',accessCode:'test-invite-token-not-real'})))
})

 it('offers public learning before an invitation is available', () => {
  openForm()
  expect(screen.getByRole('link', { name: 'Open free study library' }).getAttribute('href')).toBe('/offline.html')
  expect(mocks.registerBetaUser).not.toHaveBeenCalled()
 })
