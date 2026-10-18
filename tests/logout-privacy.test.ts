import { afterEach, expect, it, vi } from 'vitest'
const mocks=vi.hoisted(()=>({signOut:vi.fn()}))
vi.mock('../src/lib/supabase',()=>({AUTH_STORAGE_KEY:'mela-users-supabase-auth-v1',supabase:{auth:{signOut:mocks.signOut}}}))
import { logoutUser } from '../src/lib/auth'
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();localStorage.clear();sessionStorage.clear()})
it('removes only learner credentials and chats even when logout fails offline',async()=>{
  const replace=vi.fn(),dispatchEvent=vi.fn()
  localStorage.setItem('mela-users-supabase-auth-v1','private token')
  localStorage.setItem('mela-users-supabase-auth-v1-code-verifier','private verifier')
  localStorage.setItem('other-app','keep')
  localStorage.setItem('mela-public-ai-last-unit-v1','18')
  sessionStorage.setItem('mela_coach_v1:learner','private conversation')
  vi.stubGlobal('window',{localStorage,sessionStorage,location:{replace},dispatchEvent})
  mocks.signOut.mockRejectedValue(new Error('offline'))
  await logoutUser()
  expect(localStorage.getItem('mela-users-supabase-auth-v1')).toBeNull()
  expect(localStorage.getItem('mela-users-supabase-auth-v1-code-verifier')).toBeNull()
  expect(sessionStorage.getItem('mela_coach_v1:learner')).toBeNull()
  expect(localStorage.getItem('other-app')).toBe('keep')
  expect(localStorage.getItem('mela-public-ai-last-unit-v1')).toBe('18')
  expect(replace).toHaveBeenCalledWith(expect.stringContaining('?signed_out=1'))
})
it('bounds logout waiting so a stalled connection cannot retain the private screen',async()=>{
 vi.useFakeTimers();const replace=vi.fn()
 vi.stubGlobal('window',{localStorage,sessionStorage,location:{replace},dispatchEvent:vi.fn()})
 mocks.signOut.mockReturnValue(new Promise(()=>{}))
 const done=logoutUser();await vi.advanceTimersByTimeAsync(4000);await done
 expect(replace).toHaveBeenCalledOnce()
})
