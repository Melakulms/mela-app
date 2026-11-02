import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import ContractDisputes from '../src/components/ContractDisputes'

const mock = vi.hoisted(() => ({
  contracts: [] as any[],
  milestones: [] as any[],
  fetchMyContracts: vi.fn(),
  fetchMyMilestones: vi.fn(),
  fetchMyReviews: vi.fn(),
  submitWorkMilestone: vi.fn(),
  raiseContractDispute: vi.fn(),
  respondToContract: vi.fn(),
  submitContractReview: vi.fn(),
}))
vi.mock('../src/lib/contracts', () => ({
  fetchMyContracts: mock.fetchMyContracts,
  fetchMyMilestones: mock.fetchMyMilestones,
  fetchMyReviews: mock.fetchMyReviews,
  submitWorkMilestone: mock.submitWorkMilestone,
  raiseContractDispute: mock.raiseContractDispute,
  respondToContract: mock.respondToContract,
  submitContractReview: mock.submitContractReview,
}))

const contract = { id: 'contract-001', freelancer_id: 'freelancer-1',
  status: 'active', agreed_amount: 200, currency: 'ETB', funding_status: 'held' }
const milestones = [
  {id: 'm1', contract_id: contract.id, title:'Translation', amount:100, status:'pending'},
  {id: 'm2', contract_id: contract.id, title:'Review', amount:100, status:'pending'},
]
beforeEach(() => {
  vi.clearAllMocks()
  mock.contracts = [{...contract}]
  mock.milestones = milestones.map(row => ({...row}))
  mock.fetchMyContracts.mockImplementation(async () => mock.contracts)
  mock.fetchMyMilestones.mockImplementation(async () => mock.milestones)
  mock.fetchMyReviews.mockResolvedValue([])
  mock.submitWorkMilestone.mockResolvedValue(undefined)
  mock.raiseContractDispute.mockResolvedValue(undefined)
})
afterEach(cleanup)

it('keeps milestone links and notes separate when submitting funded work', async () => {
  render(<ContractDisputes currentUserId="freelancer-1" workEnabled />)
  fireEvent.click(await screen.findByRole('button', {name:'Open contract'}))
  fireEvent.change(screen.getByLabelText('HTTPS deliverable link for Translation'), {
    target:{value:'https://example.com/translation'} })
  fireEvent.change(screen.getByLabelText('Delivery note (optional)', {selector:'textarea'}), {
    target:{value:'Translation draft'} })
  fireEvent.change(screen.getByLabelText('HTTPS deliverable link for Review'), {
    target:{value:'https://example.com/review'} })
  const buttons = screen.getAllByRole('button',{name:'Submit milestone'})
  fireEvent.click(buttons[0])
  await waitFor(() => expect(mock.submitWorkMilestone).toHaveBeenCalledWith(
    'm1', 'https://example.com/translation', 'Translation draft'))
  expect((screen.getByLabelText('HTTPS deliverable link for Review') as HTMLInputElement).value)
    .toBe('https://example.com/review')
})

it('does not offer delivery for a contract without independently held escrow', async () => {
  mock.contracts = [{...contract, funding_status:'pending'}]
  render(<ContractDisputes currentUserId="freelancer-1" workEnabled />)
  fireEvent.click(await screen.findByRole('button', {name:'Open contract'}))
  expect(screen.getByText(/held escrow funding is confirmed/)).toBeTruthy()
  expect(screen.queryByRole('button',{name:'Submit milestone'})).toBeNull()
  expect(mock.submitWorkMilestone).not.toHaveBeenCalled()
})

it('preserves access to contract issue reporting while new paid work is paused', async () => {
  render(<ContractDisputes currentUserId="freelancer-1" workEnabled={false} />)
  fireEvent.click(await screen.findByRole('button',{name:'Report a contract issue'}))
  fireEvent.change(screen.getByLabelText('What went wrong?'),{
    target:{value:'The requested delivery scope is unclear.'},
  })
  fireEvent.click(screen.getByRole('button',{name:'Submit dispute'}))
  await waitFor(() => expect(mock.raiseContractDispute).toHaveBeenCalledWith(
    contract.id, 'The requested delivery scope is unclear.'))
})
