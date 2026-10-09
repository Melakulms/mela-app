import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import CertificateVerification from '../src/pages/CertificateVerification'

const verify = vi.hoisted(() => vi.fn())
vi.mock('../src/lib/passport', () => ({ verifyCourseCertificate: verify }))

afterEach(cleanup)

it('shows a verified course credential without requiring app authentication', async () => {
  verify.mockResolvedValue({
    certificate_code: 'MELA-C-ABC123',
    credential_type: 'Micro-Credential',
    course_title: 'Career Foundations',
    learner_name: 'Test Learner',
    issued_at: '2026-10-02T10:00:00Z',
    valid: true,
  })

  render(<CertificateVerification code="MELA-C-ABC123" />)

  expect(await screen.findByText('Career Foundations')).toBeTruthy()
  expect(screen.getByText('Test Learner')).toBeTruthy()
  expect(screen.getByText('Valid')).toBeTruthy()
  expect(verify).toHaveBeenCalledWith('MELA-C-ABC123')
})

it('shows a clear invalid state for an unknown credential code', async () => {
  verify.mockResolvedValue(null)
  render(<CertificateVerification code="MELA-C-MISSING" />)
  expect(await screen.findByText(/No MELA credential matches/)).toBeTruthy()
})

it('renders credential labels and status in the saved learner language', async () => {
  const { I18nProvider } = await import('../src/i18n')
  localStorage.setItem('mela_language', 'am')
  verify.mockResolvedValue({ certificate_code: 'TEST', credential_type: 'Course', course_title: 'Test course', learner_name: 'Learner', issued_at: '2026-10-02', valid: false })
  try {
    render(<I18nProvider><CertificateVerification code="TEST" /></I18nProvider>)
    expect(await screen.findByText('ተሰርዟል')).toBeTruthy()
    expect(screen.getByText('የማረጋገጫ ማረጋገጥ')).toBeTruthy()
  } finally { localStorage.removeItem('mela_language') }
})

it('keeps language selection working when browser storage is blocked', async () => {
  const { I18nProvider, useI18n } = await import('../src/i18n')
  const { fireEvent } = await import('@testing-library/react')
  const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked') })
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked') })
  function Selector() { const { t, setLanguage } = useI18n(); return <button onClick={() => setLanguage('am')}>{t('credentialVerification')}</button> }
  try {
    render(<I18nProvider><Selector /></I18nProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Credential verification' }))
    expect(screen.getByRole('button', { name: 'የማረጋገጫ ማረጋገጥ' })).toBeTruthy()
  } finally { read.mockRestore(); write.mockRestore() }
})
