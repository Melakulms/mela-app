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
