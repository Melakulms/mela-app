import {afterEach,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen} from '@testing-library/react'
import {AssessmentRunner} from '../src/pages/LearnerSubsections'
const mock=vi.hoisted(()=>({rpc:vi.fn(),insert:vi.fn(),from:vi.fn(),auth:{getUser:vi.fn()}}))
vi.mock('../src/lib/supabase',()=>({supabase:mock}))
afterEach(()=>{cleanup();vi.clearAllMocks()})
it('resumes an existing attempt after question loading fails without spending another attempt',async()=>{
 mock.auth.getUser.mockResolvedValue({data:{user:{id:'learner'}}})
 mock.from.mockImplementation((table:string)=>{
  const data=table==='assessment_attempts'?[{id:'attempt',status:'in_progress',attempt_no:1}]:[{question_id:'q',response:'b'}]
  const builder:any={select:()=>builder,eq:()=>builder,insert:mock.insert,then:(resolve:any)=>Promise.resolve({data,error:null}).then(resolve)}
  return builder
 })
 mock.rpc.mockResolvedValueOnce({error:{message:'Connection lost'}}).mockResolvedValueOnce({data:[{question_id:'q',prompt:'Choose',choices:[{id:'a',text:'First'},{id:'b',text:'Second'}]}]})
 render(<AssessmentRunner assessment={{id:'assessment',title:'Skills',max_attempts:1}} onBack={()=>{}} onChanged={()=>{}} />)
 fireEvent.click(screen.getByRole('button',{name:'Start or resume assessment'}))
 await screen.findByText('Connection lost')
 fireEvent.click(screen.getByRole('button',{name:'Start or resume assessment'}))
 const selected=await screen.findByRole('radio',{name:'Second'})
 expect((selected as HTMLInputElement).checked).toBe(true)
 expect(mock.insert).not.toHaveBeenCalled()
})
