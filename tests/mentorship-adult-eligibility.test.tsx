import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import MentorshipAdultEligibility from '../src/components/MentorshipAdultEligibility'

const mocks=vi.hoisted(()=>({
  user:vi.fn(), read:vi.fn(), insert:vi.fn(),
}))
vi.mock('../src/lib/supabase',()=>({
  supabase:{
    auth:{getUser:mocks.user},
    from:()=>({
      select:()=>({eq:()=>({maybeSingle:mocks.read})}),
      insert:mocks.insert,
    }),
  },
}))
beforeEach(()=>{
 vi.clearAllMocks()
 mocks.user.mockResolvedValue({data:{user:{id:'adult-learner-1'}},error:null})
 mocks.read.mockResolvedValue({data:null,error:null})
 mocks.insert.mockResolvedValue({error:null})
})
afterEach(cleanup)

describe('Adult mentorship eligibility request',()=>{
 it('requires explicit safeguarding acknowledgement before submitting a private age-review request',async()=>{
  render(<MentorshipAdultEligibility/>)
  await screen.findByLabelText(/Date of birth \(Gregorian calendar\)/)
  const submit=screen.getByRole('button',{name:'Request private age verification'})
  expect((submit as HTMLButtonElement).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText(/Date of birth \(Gregorian calendar\)/),{target:{value:'1990-01-01'}})
  expect((submit as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByLabelText(/I confirm that I am 18 or older/))
  fireEvent.click(submit)
  await waitFor(()=>expect(mocks.insert).toHaveBeenCalledTimes(1))
  expect(mocks.insert.mock.calls[0][0]).toEqual({
   learner_id:'adult-learner-1',claimed_date_of_birth:'1990-01-01',consent_to_mentorship_rules:true,
  })
  expect(await screen.findByText(/You cannot access direct adult mentorship until an authorized administrator/)).toBeTruthy()
 })
 it('refuses underage dates before contacting the server',async()=>{
  render(<MentorshipAdultEligibility/>)
  await screen.findByLabelText(/Date of birth \(Gregorian calendar\)/)
  fireEvent.change(screen.getByLabelText(/Date of birth \(Gregorian calendar\)/),{target:{value:'2020-01-01'}})
  fireEvent.click(screen.getByLabelText(/I confirm that I am 18 or older/))
  fireEvent.click(screen.getByRole('button',{name:'Request private age verification'}))
  expect((await screen.findByRole('alert')).textContent).toContain('adults 18 or older')
  expect(mocks.insert).not.toHaveBeenCalled()
 })
 it('shows pending verification as pending, never verified',async()=>{
  mocks.read.mockResolvedValueOnce({
   data:{id:'review-1',status:'pending',created_at:'2026-10-27T10:00:00Z',reviewed_at:null},error:null,
  })
  render(<MentorshipAdultEligibility/>)
  expect(await screen.findByText('Awaiting independent administrator review')).toBeTruthy()
  expect(screen.queryByText('Adult eligibility approved')).toBeNull()
 })
})
