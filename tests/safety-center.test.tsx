import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import SafetyCenter from '../src/pages/SafetyCenter'

const mocks = vi.hoisted(() => ({
  fetchMySafetyCenter: vi.fn(),
  submitSafetyReport: vi.fn(),
  requestGuardianConsent: vi.fn(),
  refreshSchoolSafetyStatus: vi.fn(),
}))

vi.mock('../src/lib/safety', () => ({
  fetchMySafetyCenter: mocks.fetchMySafetyCenter,
  submitSafetyReport: mocks.submitSafetyReport,
  requestGuardianConsent: mocks.requestGuardianConsent,
  refreshSchoolSafetyStatus: mocks.refreshSchoolSafetyStatus,
}))

beforeEach(() => {
  vi.resetAllMocks()
  mocks.fetchMySafetyCenter.mockResolvedValue({
    profile: { education_stage_key: 'school_11_12', learner_safety_status: 'guardian_required' },
    guardians: [],
    reports: [],
    policies: [{ policy_key: 'privacy', version: '2026-08-14', title: 'Mela Privacy Notice', required_for_access: true, explicit_consent: true, revocable: false }],
  })
  mocks.submitSafetyReport.mockResolvedValue(undefined)
  mocks.requestGuardianConsent.mockResolvedValue(undefined)
  mocks.refreshSchoolSafetyStatus.mockResolvedValue('guardian_required')
})

afterEach(cleanup)

describe('SafetyCenter', () => {
  it('submits a safety report and refreshes status', async () => {
    render(<SafetyCenter onBack={vi.fn()} />)
    await screen.findByText('Safety & privacy')
    fireEvent.change(screen.getByLabelText('Describe the concern'), { target: { value: 'Someone repeatedly sent unsafe messages to me.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit report' }))
    await waitFor(() => expect(mocks.submitSafetyReport).toHaveBeenCalledWith('bullying_or_harassment', 'Someone repeatedly sent unsafe messages to me.'))
    await waitFor(() => expect(mocks.fetchMySafetyCenter).toHaveBeenCalledTimes(2))
  })

  it('keeps guardian verification server-controlled', async () => {
    render(<SafetyCenter onBack={vi.fn()} />)
    await screen.findByText('Guardian consent')
    fireEvent.change(screen.getByLabelText('Guardian email'), { target: { value: 'guardian@example.com' } })
    fireEvent.change(screen.getByLabelText('Relationship'), { target: { value: 'Parent' } })
    fireEvent.click(screen.getByRole('button', { name: 'Request guardian consent' }))
    await waitFor(() => expect(mocks.requestGuardianConsent).toHaveBeenCalledWith('guardian@example.com', 'Parent', ''))
    expect(mocks.refreshSchoolSafetyStatus).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(/learners cannot self-verify/i)).toBeTruthy()
  })
})
