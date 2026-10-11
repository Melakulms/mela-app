import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Arena from '../src/pages/Arena'
import HostedCompetitions from '../src/components/HostedCompetitions'
const mocks = vi.hoisted(() => ({join:vi.fn(),rpc:vi.fn(),rows:[] as any[],from:vi.fn()}))
vi.mock('../src/lib/arena',()=>({fetchLeaderboard:async()=>[],checkMyQueueStatus:async()=>null,joinMatchmaking:mocks.join,cancelMatchmaking:vi.fn()}))
vi.mock('../src/lib/supabase',()=>({supabase:{from:mocks.from,rpc:mocks.rpc,auth:{getUser:async()=>({data:{user:{id:'me'}},error:null})}}}))
beforeEach(()=>{
 vi.resetAllMocks();mocks.rows=[]
 mocks.from.mockImplementation((table:string)=>{
  const query:any={select:()=>query,eq:()=>query,gte:()=>query,in:()=>query,order:()=>query,range:async()=>({data:mocks.rows,error:null}),then:(resolve:any)=>Promise.resolve({data:table==='skill_assessments'?[{id:'assessment',title:'Math quiz',question_count:8}]:[],error:null}).then(resolve)}
  return query
 })
 mocks.join.mockResolvedValue(undefined);mocks.rpc.mockResolvedValue({data:null,error:null})
})
afterEach(cleanup)
it('shows eight competition paths and sends quiz_battle through the supported assessment contract',async()=>{
 render(<Arena onBack={vi.fn()} />)
 await screen.findByRole('option',{name:'Math quiz · 8 questions'})
 for(const name of ['Quiz Battle','Speed Quiz','Skill Sprint','Interview Practice','Case Sprint','Team Battle','Employer Challenge','Tournaments']) expect(screen.getByRole('heading',{name,exact:true})).toBeTruthy()
 expect(screen.getByText(/Cash earning and payouts remain unavailable/)).toBeTruthy()
 fireEvent.click(screen.getAllByRole('button',{name:'Search for opponent'})[0])
 await waitFor(()=>expect(mocks.join).toHaveBeenCalledExactlyOnceWith('quiz_battle','assessment'))
})
it.each(['employer_challenge','tournament'] as const)('keeps %s joining disabled until live authorization is verified',async(kind)=>{
 mocks.rows=[{id:'one',title:'Hosted event',team_mode:false,status:kind==='tournament'?'registration':'open'}]
 const onMatch=vi.fn();render(<HostedCompetitions kind={kind} onBack={vi.fn()} onMatch={onMatch}/>)
 const button=await screen.findByRole('button',{name:kind==='tournament'?'Register for tournament':'Join match'})
 expect((button as HTMLButtonElement).disabled).toBe(true)
 fireEvent.click(button)
 expect(onMatch).not.toHaveBeenCalled();expect(mocks.rpc).not.toHaveBeenCalled()
 expect(screen.getByText(/Joining is paused/)).toBeTruthy()
})
