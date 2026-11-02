import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import EarnWork from '../src/pages/EarnWork'

const mock = vi.hoisted(() => ({
  enabled: false, tasks: [] as any[], proposals: [] as any[],
  getUser: vi.fn(), rpc: vi.fn(), insert: vi.fn(),
}))
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: { getUser: mock.getUser },
    rpc: mock.rpc,
    from: (table: string) => {
      const query: any = {}
      query.select = () => query
      query.eq = () => query
      query.order = () => query
      query.limit = () => Promise.resolve({
        data: table === 'marketplace_tasks' ? mock.tasks : mock.proposals, error: null,
      })
      query.insert = mock.insert
      return query
    },
  },
}))
vi.mock('../src/components/ContractDisputes', () => ({
  default: ({ workEnabled }: {workEnabled:boolean}) =>
    <p>Contracts loaded (work actions {workEnabled ? 'available' : 'paused'})</p>,
}))
vi.mock('../src/lib/contracts', () => ({ withdrawMyProposal: vi.fn() }))

const task = { id: 'task-1', title: 'Translate a lesson', description: 'Translate an approved learning lesson.',
  task_type: 'translation', budget_amount: 200, currency: 'ETB', reward_coins: null,
  skills_required: ['Amharic'], deadline: null, status: 'open' }
const saved = { id: 'proposal-1', task_id: 'old-task', status: 'accepted', proposal_text: 'An existing proposal',
  proposed_amount: 100, estimated_days: 3, submitted_at: '2026-11-01' }
beforeEach(() => {
  vi.clearAllMocks()
  mock.enabled = false; mock.tasks = [task]; mock.proposals = [saved]
  mock.getUser.mockResolvedValue({ data: { user: { id: 'learner-1' } }, error: null })
  mock.rpc.mockImplementation((action: string) =>
    action === 'platform_feature_available' ? Promise.resolve({data: mock.enabled, error: null}) :
      Promise.resolve({data: null, error: {message: 'Unexpected RPC'}}))
  mock.insert.mockResolvedValue({ data: null, error: null })
})
afterEach(cleanup)

it('keeps paid proposals closed when the production feature is paused but shows old records', async () => {
  render(<EarnWork stageKey="university" onBack={vi.fn()} />)
  await screen.findByText(/New paid work is currently paused/)
  expect(screen.queryByRole('button', {name: 'Send proposal'})).toBeNull()
  fireEvent.click(screen.getByRole('button', {name: 'My proposals (1)'}))
  fireEvent.click(screen.getByRole('button', {name: 'View proposal'}))
  expect(screen.getByText('An existing proposal')).toBeTruthy()
  expect(screen.getByText(/not the same as a funded contract/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'My contracts'}))
  expect(screen.getByText(/work actions paused/)).toBeTruthy()
  expect(mock.insert).not.toHaveBeenCalled()
})

it('blocks school learners from paid proposals, even when a feature flag is enabled', async () => {
  mock.enabled = true
  render(<EarnWork stageKey="school_10_12" onBack={vi.fn()} />)
  await screen.findByText(/Paid freelance work requires verified adult eligibility/)
  fireEvent.click(screen.getByRole('button', {name:'View details'}))
  expect(screen.queryByRole('button',{name:'Send proposal'})).toBeNull()
  expect(screen.getByText('Applications for this task are not available to your account.')).toBeTruthy()
})

it('validates a non-school proposal and sends it only after the server feature gate is open', async () => {
  mock.enabled = true
  render(<EarnWork stageKey="university" onBack={vi.fn()} />)
  await screen.findByText('Translate a lesson')
  fireEvent.click(screen.getByRole('button',{name:'View details'}))
  fireEvent.change(screen.getByLabelText(/How will you complete this task/), {
    target: {value:'I can translate this lesson accurately and review terminology.'},
  })
  fireEvent.change(screen.getByLabelText('Your proposed amount (ETB)'), { target:{value:'-20'} })
  fireEvent.click(screen.getByRole('button',{name:'Send proposal'}))
  await screen.findByText(/Enter a valid positive amount/)
  expect(mock.insert).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Your proposed amount (ETB)'), {target:{value:'150.50'}})
  fireEvent.change(screen.getByLabelText('Estimated days'), {target:{value:'3'}})
  fireEvent.click(screen.getByRole('button',{name:'Send proposal'}))
  await waitFor(() => expect(mock.insert).toHaveBeenCalledWith(expect.objectContaining({
    task_id:'task-1',user_id:'learner-1', status:'pending', proposed_amount:150.5, estimated_days:3,
  })))
  expect(mock.rpc).toHaveBeenCalledWith('platform_feature_available', {p_feature_key:'earn_work'})
})

it('shows a useful empty state for currently assigned production tasks', async () => {
  mock.tasks = []
  render(<EarnWork stageKey="university" onBack={vi.fn()} />)
  expect(await screen.findByText('No open employer tasks are available right now.')).toBeTruthy()
})
