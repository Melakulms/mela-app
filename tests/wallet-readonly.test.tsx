import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import MelaWallet, { type WalletSnapshot } from '../src/components/MelaWallet'

const mock = vi.hoisted(() => ({
  getUser: vi.fn(), rpc: vi.fn(), from: vi.fn(),
  commissions: vi.fn(), profile: vi.fn(), commissionEq: vi.fn(), profileEq: vi.fn(),
}))
vi.mock('../src/lib/supabase', () => ({
  supabase: { auth: { getUser: mock.getUser }, rpc: mock.rpc, from: mock.from },
}))

const snapshot: WalletSnapshot = {
  available_balance: 12.5, pending_earnings: 6, paid_out: 5,
  lifetime_earned: 17.5, pending_payout: 12.5, payouts_enabled: false,
  source_breakdown: [{ source_type: 'freelance', available: 12.5, pending: 6, paid: 5 }],
  recent_ledger: [{ id: 'a', source_type: 'freelance', net_amount: 12.5, status: 'available', currency: 'ETB', occurred_at: '2026-11-04T00:00:00Z' }],
  payout_requests: [{ id: 'p', amount_minor: 1250, status: 'pending', currency: 'ETB', provider: 'bank', created_at: '2026-11-01T00:00:00Z' }],
  payout_account: {},
}

beforeEach(() => {
  vi.resetAllMocks()
  mock.getUser.mockResolvedValue({ data: { user: { id: 'owner-1' } }, error: null })
  mock.commissionEq.mockReturnThis()
  mock.profileEq.mockReturnThis()
  mock.commissions.mockResolvedValue({ data: [
    { id: 'c1', amount: 20, status: 'pending', currency: 'ETB', invitee_tier: 'pro', created_at: '2026-11-01' },
    { id: 'c2', amount: 40, status: 'paid', currency: 'ETB', invitee_tier: 'premium', created_at: '2026-11-02' },
  ], error: null })
  mock.profile.mockResolvedValue({ data: { coin_balance: 35 }, error: null })
  mock.from.mockImplementation((table: string) => {
    if (table === 'invitation_commissions') return {
      select: vi.fn().mockReturnThis(), eq: mock.commissionEq,
      order: mock.commissions,
    }
    if (table === 'profiles') return {
      select: vi.fn().mockReturnThis(), eq: mock.profileEq,
      maybeSingle: mock.profile,
    }
    throw new Error('Unexpected table: ' + table)
  })
})
afterEach(cleanup)

it('shows cash and learning coins separately, with accessible mobile wallet sections', async () => {
  render(<MelaWallet data={snapshot} onBack={vi.fn()} onRefresh={vi.fn()} />)
  expect(screen.getByText('12.50 ETB')).toBeTruthy()
  expect(screen.getByText('Pending work earnings')).toBeTruthy()
  expect(await screen.findByText('35')).toBeTruthy()
  expect(screen.getByText('Learning coins · not cash')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Overview' }).getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'Transactions' }))
  expect(screen.getByRole('button', { name: 'Transactions' }).getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByText('Recent work earnings')).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Withdraw|Send money|Cash out/i })).toBeNull()
})

it('only reads the signed-in user\'s referral commissions; pending is never spendable cash', async () => {
  render(<MelaWallet data={snapshot} onBack={vi.fn()} onRefresh={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Referrals' }))
  expect((await screen.findAllByText('20.00 ETB')).length).toBeGreaterThan(0)
  expect(screen.getAllByText('40.00 ETB').length).toBeGreaterThan(0)
  expect(screen.getByText('Pending review · not withdrawable')).toBeTruthy()
  expect(screen.getByText('Recorded paid commissions')).toBeTruthy()
  expect(mock.from).toHaveBeenCalledWith('invitation_commissions')
  expect(mock.commissionEq).toHaveBeenCalledWith('inviter_user_id', 'owner-1')
  expect(mock.commissions).toHaveBeenCalledWith('created_at', { ascending: false })
  expect(mock.rpc).not.toHaveBeenCalled()
})

it('fails closed when private commission records cannot be verified', async () => {
  mock.commissions.mockResolvedValue({ data: null, error: { message: 'Access denied' } })
  render(<MelaWallet data={snapshot} onBack={vi.fn()} onRefresh={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Referrals' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Could not verify referral records')
  expect(screen.queryByText('Pending review · not withdrawable')).toBeNull()
})

it('correctly converts minor units, masks payout destination, and does not offer a transfer', async () => {
  render(<MelaWallet data={{ ...snapshot, payout_account: {
    bank_name: 'Test Bank', masked_account: '••••1234', active: true,
  } }} onBack={vi.fn()} onRefresh={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Payouts' }))
  expect(screen.getAllByText('12.50 ETB').length).toBeGreaterThan(0)
  expect(screen.getByText('Test Bank · ••••1234')).toBeTruthy()
  expect(screen.getByText(/Withdrawals are unavailable/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: /withdraw|transfer|payout/i })).toBeNull()
})

it('reloads the wallet only on explicit Refresh and supports Back', () => {
  const onRefresh = vi.fn(), onBack = vi.fn()
  render(<MelaWallet data={snapshot} onBack={onBack} onRefresh={onRefresh} />)
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  expect(onRefresh).toHaveBeenCalledOnce()
  expect(onBack).toHaveBeenCalledOnce()
})
