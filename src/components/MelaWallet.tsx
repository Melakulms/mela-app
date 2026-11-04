import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import './MelaWallet.css'

type WalletTab = 'overview' | 'transactions' | 'referrals' | 'payouts'
type LedgerEntry = {
  id: string; source_type?: string | null; status?: string | null
  net_amount?: number | string | null; currency?: string | null
  occurred_at?: string | null
}
type Breakdown = {
  source_type: string; available?: number | string; pending?: number | string
  paid?: number | string
}
type PayoutRequest = {
  id: string; amount_minor?: number | string | null; currency?: string | null
  status?: string | null; provider?: string | null; created_at?: string | null
  completed_at?: string | null; failure_reason?: string | null
}
type PayoutAccount = {
  bank_name?: string | null; currency?: string | null
  masked_account?: string | null; active?: boolean
}
type Commission = {
  id: string; amount: number | string; status: string; currency?: string | null
  invitee_tier?: string | null; created_at?: string | null
}
export type WalletSnapshot = {
  available_balance?: number | string | null
  pending_earnings?: number | string | null
  paid_out?: number | string | null
  lifetime_earned?: number | string | null
  pending_payout?: number | string | null
  payouts_enabled?: boolean
  recent_ledger?: LedgerEntry[]
  source_breakdown?: Breakdown[]
  payout_requests?: PayoutRequest[]
  payout_account?: PayoutAccount
}

const tabs: { key: WalletTab; title: string }[] = [
  { key: 'overview', title: 'Overview' },
  { key: 'transactions', title: 'Transactions' },
  { key: 'referrals', title: 'Referrals' },
  { key: 'payouts', title: 'Payouts' },
]

function numeric(value: unknown): number {
  const n = typeof value === 'number' || typeof value === 'string' ? Number(value) : 0
  return Number.isFinite(n) ? n : 0
}
function etb(value: unknown) {
  return new Intl.NumberFormat('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numeric(value)) + ' ETB'
}
function amountWithCurrency(value: unknown, currency: unknown) {
  const amount = new Intl.NumberFormat('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numeric(value))
  const code = typeof currency === 'string' && /^[A-Z]{3}$/.test(currency.toUpperCase()) ? currency.toUpperCase() : 'currency unrecorded'
  return amount + ' ' + code
}
function day(value: string | null | undefined) {
  if (!value) return 'Date unavailable'
  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime()) ? 'Date unavailable' : timestamp.toLocaleDateString()
}
function readable(value: string | null | undefined) {
  return value ? value.replaceAll('_', ' ') : 'Unknown'
}
function positiveCommissionTotal(rows: Commission[], status: string) {
  return rows.filter(row => row.status === status && row.currency?.toUpperCase() === 'ETB')
    .reduce((sum, row) => sum + numeric(row.amount), 0)
}

/**
 * A private, read-only overview. Bank/Telebirr collection and withdrawal actions
 * are deliberately NOT implemented here. A referral is not spendable cash.
 */
export default function MelaWallet({ data, onBack, onRefresh }: {
  data: WalletSnapshot; onBack: () => void; onRefresh: () => void
}) {
  const [tab, setTab] = useState<WalletTab>('overview')
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [commissionState, setCommissionState] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [coinBalance, setCoinBalance] = useState<number | null>(null)
  const [coinError, setCoinError] = useState(false)

  useEffect(() => {
    let active = true
    setCommissionState('loading')
    setCoinError(false)
    async function loadPrivateDetails() {
      try {
        const auth = await supabase.auth.getUser()
        const userId = auth.data.user?.id
        if (auth.error || !userId) throw new Error('Please sign in again.')
        const [referrals, profile] = await Promise.all([
          supabase.from('invitation_commissions')
            .select('id,amount,status,currency,invitee_tier,created_at')
            .eq('inviter_user_id', userId)
            .order('created_at', { ascending: false }),
          supabase.from('profiles').select('coin_balance').eq('id', userId).maybeSingle(),
        ])
        if (!active) return
        if (referrals.error) throw referrals.error
        if (!Array.isArray(referrals.data)) throw new Error('Referral data was unavailable')
        setCommissions(referrals.data as Commission[])
        setCommissionState('loaded')
        if (profile.error || profile.data?.coin_balance == null) {
          setCoinBalance(null)
          setCoinError(true)
        } else setCoinBalance(numeric(profile.data.coin_balance))
      } catch {
        if (!active) return
        setCommissions([])
        setCommissionState('error')
        setCoinBalance(null)
        setCoinError(true)
      }
    }
    void loadPrivateDetails()
    return () => { active = false }
  }, [data])

  const ledger = Array.isArray(data.recent_ledger) ? data.recent_ledger : []
  const sources = Array.isArray(data.source_breakdown) ? data.source_breakdown : []
  const payouts = Array.isArray(data.payout_requests) ? data.payout_requests : []
  const account = data.payout_account && typeof data.payout_account === 'object' ? data.payout_account : null
  const latestPending = positiveCommissionTotal(commissions, 'pending')
  const paidCommission = positiveCommissionTotal(commissions, 'paid')

  return <main className="dash-main mela-wallet">
    <div className="section-heading"><h1>MELA Wallet</h1>
      <div className="mela-wallet-actions">
        <button type="button" className="btn btn-secondary" onClick={onRefresh}>Refresh</button>
        <button type="button" className="btn btn-secondary" onClick={onBack}>Back</button>
      </div>
    </div>

    <section className="mela-wallet-hero" aria-label="Your recorded earnings">
      <span className="mela-wallet-kicker">YOUR PRIVATE EARNINGS OVERVIEW</span>
      <strong className="mela-wallet-hero-amount">{etb(data.available_balance)}</strong>
      <span>Recorded available earnings · not a deposit or bank balance</span>
      <p>Learning coins, referral commissions and work earnings are tracked separately. MELA does not accept deposits or withdrawals on this page.</p>
    </section>

    <nav className="mela-wallet-tabs" aria-label="Wallet sections">
      {tabs.map(item => <button type="button" key={item.key}
        className={tab === item.key ? 'mela-wallet-tab selected' : 'mela-wallet-tab'}
        aria-pressed={tab === item.key} onClick={() => setTab(item.key)}>{item.title}</button>)}
    </nav>

    {tab === 'overview' && <section aria-label="Wallet overview">
      <div className="mela-wallet-stats">
        <div><strong>{etb(data.pending_earnings)}</strong><span>Pending work earnings</span></div>
        <div><strong>{etb(data.paid_out)}</strong><span>Recorded paid earnings</span></div>
        <div><strong>{etb(data.lifetime_earned)}</strong><span>Recorded lifetime earnings</span></div>
        <div><strong>{coinError ? 'Unavailable' : coinBalance === null ? 'Loading…' : coinBalance.toLocaleString()}</strong><span>Learning coins · not cash</span></div>
      </div>
      <div className="mela-wallet-panel">
        <h2>Earnings by source</h2>
        {sources.length ? <div className="mela-wallet-rows">{sources.map(source =>
          <div className="mela-wallet-row" key={source.source_type}>
            <div><strong>{readable(source.source_type)}</strong><small>Source categories only; aggregated amounts may mix currencies.</small></div>
            <span>See transaction history</span>
          </div>)}</div> : <p>No work earnings have been recorded yet.</p>}
      </div>
      <p className="mela-wallet-explainer">Referral earnings are shown under Referrals, not added to the work-earnings balance. A pending referral commission is not payable until independently verified and approved.</p>
    </section>}

    {tab === 'transactions' && <section className="mela-wallet-panel" aria-label="Wallet transactions">
      <h2>Recent work earnings</h2>
      <p className="field-hint">Showing up to 25 recent server-recorded ledger entries. No payments are created by viewing this history.</p>
      {ledger.length ? <div className="mela-wallet-rows">{ledger.map(item =>
        <div className="mela-wallet-row" key={item.id}>
          <div><strong>{readable(item.source_type)}</strong><small>{readable(item.status)} · {day(item.occurred_at)}</small></div>
          <span>{amountWithCurrency(item.net_amount, item.currency)}</span>
        </div>)}</div> : <p>No earnings transactions have been recorded yet.</p>}
    </section>}

    {tab === 'referrals' && <section className="mela-wallet-panel" aria-label="Referral commissions">
      <h2>Referral commission status</h2>
      <p>A Pro subscription can earn 20 ETB, and a Premium subscription can earn 40 ETB, only after the invited user's first payment is independently verified. Registration alone earns nothing.</p>
      {commissionState === 'loading' && <p role="status">Loading your private commissions…</p>}
      {commissionState === 'error' && <p className="banner banner-error" role="alert">Could not verify referral records. No balance is displayed; try Refresh.</p>}
      {commissionState === 'loaded' && <>
        <div className="mela-wallet-stats">
          <div><strong>{etb(latestPending)}</strong><span>Pending review · not withdrawable</span></div>
          <div><strong>{etb(paidCommission)}</strong><span>Recorded paid commissions</span></div>
        </div>
        {commissions.length ? <div className="mela-wallet-rows">{commissions.map(item =>
          <div className="mela-wallet-row" key={item.id}>
            <div><strong>{readable(item.invitee_tier) || 'Referral'}</strong><small>{readable(item.status)} · {day(item.created_at)}</small></div>
            <span>{amountWithCurrency(item.amount, item.currency)}</span>
          </div>)}</div> : <p>No referral commissions have been recorded yet.</p>}
      </>}
      <p className="field-hint">Commissions appear only when the server records an eligible verified first payment. They cannot be converted into learning coins or spent inside MELA.</p>
    </section>}

    {tab === 'payouts' && <section className="mela-wallet-panel" aria-label="Payout status">
      <h2>Withdrawal and payout status</h2>
      <div className="banner banner-info" role="status">
        {data.payouts_enabled === true
          ? 'Payout configuration is enabled, but this page does not initiate transfers. A verified destination and administrator approval are still required.'
          : 'Withdrawals are unavailable. MELA is completing provider, business and safeguarding verification. Do not send money to request a withdrawal.'}
      </div>
      <p><strong>Pending requested payouts:</strong> {etb(data.pending_payout)}</p>
      <p><strong>Saved active payout destination (not independently verified):</strong> {account?.active && account.masked_account
        ? [account.bank_name, account.masked_account].filter(Boolean).join(' · ')
        : 'No active destination is recorded'}</p>
      <h3>Recent payout requests</h3>
      {payouts.length ? <div className="mela-wallet-rows">{payouts.map(item =>
        <div className="mela-wallet-row" key={item.id}>
          <div><strong>{readable(item.status)}</strong><small>{day(item.created_at)} · {readable(item.provider)}</small>
            {item.status === 'failed' && <small>Contact MELA support to review a failed payout.</small>}</div>
          <span>{amountWithCurrency(numeric(item.amount_minor) / 100, item.currency)}</span>
        </div>)}</div> : <p>No payout requests have been recorded for this account.</p>}
      <p className="field-hint">A paid status must correspond to independently confirmed outgoing transfer evidence. MELA does not offer a cash-out button until that workflow has passed review.</p>
    </section>}
  </main>
}
