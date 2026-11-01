import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
const mocks=vi.hoisted(()=>({load:vi.fn(),save:vi.fn()}))
vi.mock('../src/lib/supabase',()=>({supabase:{}}))
vi.mock('../src/lib/user-information',async()=>{
  const original=await vi.importActual<typeof import('../src/lib/user-information')>('../src/lib/user-information')
  return {...original,loadUserInformation:mocks.load,saveUserInformation:mocks.save}
})
import UserInformationSetup from '../src/pages/UserInformationSetup'
import type { MelaProfile } from '../src/lib/auth'
const profile={id:'user-a',role:'student',full_name:'Learner',preferred_language:'English'} as MelaProfile
const valid={age_group:'13–17',preferred_language:'English',learning_goal:'Prepare for exams',notice_acknowledged:'Yes'}
beforeEach(()=>{vi.resetAllMocks();mocks.load.mockResolvedValue(null);mocks.save.mockResolvedValue(undefined)})
afterEach(cleanup)
it('does not open features when saved information cannot load',async()=>{
  mocks.load.mockRejectedValue(new Error('Connection failed'))
  const done=vi.fn();render(<UserInformationSetup profile={profile} onComplete={done} onSignOut={vi.fn()}/>)
  await screen.findByRole('alert');expect(done).not.toHaveBeenCalled()
  expect(screen.queryByRole('button',{name:'Save information & continue'})).toBeNull()
  mocks.load.mockResolvedValue(null);fireEvent.click(screen.getByText('Try again'))
  await screen.findByRole('button',{name:'Save information & continue'})
})
it('saves an incomplete draft without opening features',async()=>{
  const done=vi.fn();render(<UserInformationSetup profile={profile} onComplete={done} onSignOut={vi.fn()}/>)
  fireEvent.click(await screen.findByText('Save draft for later'))
  await screen.findByText(/Draft saved to your account/)
  expect(mocks.save).toHaveBeenCalledWith('user-a','student',expect.any(Object),false)
  expect(done).not.toHaveBeenCalled()
})
it('opens only after the server accepts completed information',async()=>{
  mocks.load.mockResolvedValue({role:'student',details:valid,completed:false,notice_version:'2026-11-01-v1'})
  mocks.save.mockRejectedValueOnce(new Error('Save failed'))
  const done=vi.fn();render(<UserInformationSetup profile={profile} onComplete={done} onSignOut={vi.fn()}/>)
  fireEvent.click(await screen.findByText('Save information & continue'))
  await screen.findByRole('alert');expect(done).not.toHaveBeenCalled()
  expect((screen.getByLabelText('Age group (self-reported) (required)') as HTMLSelectElement).value).toBe('13–17')
  fireEvent.click(screen.getByText('Save information & continue'))
  await waitFor(()=>expect(done).toHaveBeenCalledTimes(1))
})
it('does not reuse completion after the account role changes',async()=>{
  mocks.load.mockResolvedValue({role:'student',details:valid,completed:true,notice_version:'2026-11-01-v1'})
  const done=vi.fn();render(<UserInformationSetup profile={{...profile,role:'mentor'}} onComplete={done} onSignOut={vi.fn()}/>)
  await screen.findByLabelText('Professional title (required)');expect(done).not.toHaveBeenCalled()
})
it('reopens a completed form for editing',async()=>{
  mocks.load.mockResolvedValue({role:'student',details:valid,completed:true,notice_version:'2026-11-01-v1'})
  const done=vi.fn();render(<UserInformationSetup profile={profile} editMode onComplete={done} onSignOut={vi.fn()}/>)
  await screen.findByLabelText('Age group (self-reported) (required)');expect(done).not.toHaveBeenCalled()
})
