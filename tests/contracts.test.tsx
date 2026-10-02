import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import ContractDisputes from '../src/components/ContractDisputes'
const mocks=vi.hoisted(()=>({fetchMyContracts:vi.fn(),raiseContractDispute:vi.fn()}))
vi.mock('../src/lib/contracts',()=>mocks)
beforeEach(()=>{vi.resetAllMocks();mocks.fetchMyContracts.mockResolvedValue([{id:'contract-id',status:'active',agreed_amount:100,currency:'ETB'}])})
afterEach(cleanup)
it('requires a reason and refreshes the held contract after a successful dispute',async()=>{
  mocks.raiseContractDispute.mockResolvedValue(undefined)
  render(<ContractDisputes/> )
  fireEvent.click(await screen.findByRole('button',{name:'Report a contract issue'}))
  expect((screen.getByRole('button',{name:'Submit dispute'}) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('What went wrong?'),{target:{value:'The work was not reviewed fairly.'}})
  fireEvent.click(screen.getByRole('button',{name:'Submit dispute'}))
  await screen.findByText(/Dispute submitted/)
  expect(mocks.raiseContractDispute).toHaveBeenCalledWith('contract-id','The work was not reviewed fairly.')
  await waitFor(()=>expect(mocks.fetchMyContracts).toHaveBeenCalledTimes(2))
})
it('shows a failed submission without announcing a hold',async()=>{
  mocks.raiseContractDispute.mockRejectedValue(new Error('Connection interrupted'))
  render(<ContractDisputes/> )
  fireEvent.click(await screen.findByRole('button',{name:'Report a contract issue'}))
  fireEvent.change(screen.getByLabelText('What went wrong?'),{target:{value:'The work was not reviewed fairly.'}})
  fireEvent.click(screen.getByRole('button',{name:'Submit dispute'}))
  await screen.findByRole('alert')
  expect(screen.queryByText(/Dispute submitted/)).toBeNull()
  expect((screen.getByRole('button',{name:'Submit dispute'}) as HTMLButtonElement).disabled).toBe(false)
})
