import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { requestPassportVerification, fetchMyPassportVerificationRequests } from '../src/lib/passport-verification'
import PassportVerificationPanel from '../src/components/PassportVerificationPanel'
const mocks = vi.hoisted(()=>({rpc:vi.fn()}))
vi.mock('../src/lib/supabase',()=>({supabase:{rpc:mocks.rpc}}))
beforeEach(()=>{vi.resetAllMocks();mocks.rpc.mockResolvedValue({data:[],error:null})})
afterEach(cleanup)
it('submits only the requested record via authenticated RPC without verification flags',async()=>{
  mocks.rpc.mockResolvedValueOnce({data:'request-id',error:null})
  await expect(requestPassportVerification('education','record-id','Independent check')).resolves.toBe('request-id')
  expect(mocks.rpc).toHaveBeenCalledWith('submit_passport_verification_request',{
    p_kind:'education',p_record_id:'record-id',p_note:'Independent check',
  })
  expect(mocks.rpc.mock.calls[0][1]).not.toHaveProperty('verified')
})
it('preserves backend errors and requires a valid server acknowledgement',async()=>{
  mocks.rpc.mockResolvedValueOnce({data:null,error:new Error('not yours')})
  await expect(requestPassportVerification('experience','no','note')).rejects.toThrow('not yours')
  mocks.rpc.mockResolvedValueOnce({data:null,error:null})
  await expect(requestPassportVerification('experience','id','note')).rejects.toThrow(/not confirmed/)
})
it('reads status only through the owner-scoped RPC',async()=>{
  const data=[{id:'r',record_id:'x',record_kind:'education',status:'pending'}]
  mocks.rpc.mockResolvedValueOnce({data,error:null})
  expect(await fetchMyPassportVerificationRequests()).toEqual(data)
  expect(mocks.rpc).toHaveBeenCalledWith('get_my_passport_verification_requests')
})
it('shows pending requests without an approval button',async()=>{
  mocks.rpc.mockResolvedValueOnce({data:[{id:'r',record_id:'x',record_kind:'education',status:'pending'}],error:null})
  render(<PassportVerificationPanel kind="education" records={[{id:'x',institution:'School',verified:false,is_public:false}]}/>)
  await screen.findByText('Awaiting reviewer decision')
  expect(screen.queryByText('Request verification')).toBeNull()
  expect(screen.queryByText(/Approve verified/)).toBeNull()
})
it('requests a verification and displays the pending status after submission',async()=>{
  mocks.rpc.mockResolvedValueOnce({data:[],error:null})
    .mockResolvedValueOnce({data:'request-id',error:null})
    .mockResolvedValueOnce({data:[{id:'r',record_id:'x',record_kind:'experience',status:'pending'}],error:null})
  render(<PassportVerificationPanel kind="experience" records={[{id:'x',organization:'Community volunteer',verified:false,is_public:false}]}/>)
  fireEvent.click(await screen.findByText('Request verification'))
  fireEvent.click(screen.getByText('Submit verification request'))
  await screen.findByText('Awaiting reviewer decision')
  expect(mocks.rpc).toHaveBeenCalledWith('submit_passport_verification_request',expect.objectContaining({p_kind:'experience',p_record_id:'x'}))
})

it('refuses an invalid verification-status response instead of reporting no pending reviews',async()=>{
  mocks.rpc.mockResolvedValueOnce({data:null,error:null})
  await expect(fetchMyPassportVerificationRequests()).rejects.toThrow(/Verification status could not be confirmed/)
})

it('keeps unverified records locked and hides request actions if review status cannot be read',async()=>{
  mocks.rpc.mockResolvedValueOnce({data:null,error:null})
  const onPendingChange=vi.fn()
  render(<PassportVerificationPanel kind="education" onPendingChange={onPendingChange}
    records={[{id:'record-a',institution:'School',verified:false,is_public:false}]} />)
  const error=await screen.findByRole('alert')
  expect(error.textContent).toContain('Verification status could not be confirmed')
  expect(screen.queryByRole('button',{name:'Request verification'})).toBeNull()
  expect(onPendingChange).toHaveBeenCalledWith(new Set(['record-a']))
  expect(screen.getByText(/Requests and record editing must wait/)).toBeTruthy()
})
