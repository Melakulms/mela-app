import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import MentorshipMentorSafetyReporting from '../src/components/MentorshipMentorSafetyReporting'
const mocks=vi.hoisted(()=>({getUser:vi.fn(),read:vi.fn()}))
vi.mock('../src/lib/supabase',()=>({supabase:{auth:{getUser:mocks.getUser},from:(table:string)=>({
 select:()=>({eq:()=>({order:()=>({limit:()=>mocks.read(table)})})}),
})}}))
vi.mock('../src/components/MentorshipSafetyReporting',()=>({default:({requests}:any)=><div>{requests.map((r:any)=><span key={r.id}>{r.topic}</span>)}</div>}))
beforeEach(()=>{
 vi.resetAllMocks()
 mocks.getUser.mockResolvedValue({data:{user:{id:'mentor'}},error:null})
 mocks.read.mockImplementation((table:string)=>Promise.resolve({data:table==='mentorship_requests'?[{id:'private',topic:'Confidential learner topic'}]:[],error:null}))
})
afterEach(cleanup)
it('clears mentor report targets on account change',async()=>{
 render(<MentorshipMentorSafetyReporting/>)
 await screen.findByText('Confidential learner topic')
 mocks.getUser.mockResolvedValue({data:{user:null},error:null})
 fireEvent(window,new Event('mela:session-boundary'))
 expect(screen.queryByText('Confidential learner topic')).toBeNull()
 await screen.findByRole('alert')
})
it('does not restore report targets from the previous account after a delayed read',async()=>{
 let resolveRead!:(result:unknown)=>void
 mocks.read.mockImplementationOnce(()=>new Promise(resolve=>{resolveRead=resolve}))
 render(<MentorshipMentorSafetyReporting/>)
 await waitFor(()=>expect(resolveRead).toBeTruthy())
 mocks.getUser.mockResolvedValue({data:{user:null},error:null})
 fireEvent(window,new Event('mela:session-boundary'))
 await screen.findByRole('alert')
 await act(async()=>resolveRead({data:[{id:'old',topic:'Old private topic'}],error:null}))
 expect(screen.queryByText('Old private topic')).toBeNull()
})
