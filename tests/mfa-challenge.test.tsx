import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import MfaChallenge from '../src/components/MfaChallenge'

const { listFactors, challenge, verify } = vi.hoisted(() => ({
  listFactors: vi.fn(async () => ({ data: { totp: [{ id: 'verified-factor', status: 'verified' }] }, error: null })),
  challenge: vi.fn(async () => ({ data: { id: 'challenge-id' }, error: null })),
  verify: vi.fn(async () => ({ data: {}, error: null })),
}))

vi.mock('../src/lib/supabase', () => ({
  supabase: { auth: { mfa: { listFactors, challenge, verify } } },
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it('keeps a user behind the MFA gate until their six-digit code verifies', async () => {
  const onVerified = vi.fn()
  render(<MfaChallenge onVerified={onVerified} onSignOut={() => {}} />)
  const submit = screen.getByRole('button', { name: 'Verify and continue' }) as HTMLButtonElement
  expect(submit.disabled).toBe(true)
  await waitFor(() => expect(listFactors).toHaveBeenCalled())
  fireEvent.change(screen.getByLabelText('Six-digit authentication code'), { target: { value: '123456' } })
  fireEvent.click(submit)
  await waitFor(() => expect(onVerified).toHaveBeenCalledOnce())
  expect(challenge).toHaveBeenCalledWith({ factorId: 'verified-factor' })
  expect(verify).toHaveBeenCalledWith({ factorId: 'verified-factor', challengeId: 'challenge-id', code: '123456' })
})

it('fails closed when no verified TOTP factor can be loaded', async () => {
  listFactors.mockResolvedValueOnce({ data: { totp: [] }, error: null } as any)
  const onVerified = vi.fn()
  render(<MfaChallenge onVerified={onVerified} onSignOut={() => {}} />)
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('No verified authenticator'))
  expect((screen.getByRole('button', { name: 'Verify and continue' }) as HTMLButtonElement).disabled).toBe(true)
  expect(onVerified).not.toHaveBeenCalled()
})
