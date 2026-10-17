import { beforeEach, expect, it, vi } from 'vitest'
const invoke = vi.hoisted(() => vi.fn())
vi.mock('../src/lib/supabase', () => ({supabase:{functions:{invoke}}}))
import { askCareerCoach, explainCoachFailure } from '../src/lib/coach'

beforeEach(() => vi.resetAllMocks())

it('routes student chat to the career coaching worker with correct language and bounded history', async () => {
 invoke.mockResolvedValueOnce({data:{ok:true,response:'Consider STEM careers.',agent:{key:'career',name:'Career',domain:'career'},tool:null},error:null})
 const result=await askCareerCoach('How do I choose a career?',[
  {role:'user',text:'I enjoy science'},{role:'coach',text:'Explore research careers'},
 ],'Amharic')
 expect(result.kind).toBe('reply')
 if(result.kind==='reply')expect(result.reply.agent.key).toBe('career')
 expect(invoke).toHaveBeenCalledWith('mela-ai-execution-v2',{body:{
   purpose:'career_coach',message:'How do I choose a career?',language:'am',
   history:[{role:'user',content:'I enjoy science'},{role:'assistant',content:'Explore research careers'}],
 }})
})
it('retains a useful error when the service returns a 503, without leaking backend internals',async()=>{
 invoke.mockResolvedValueOnce({data:null,error:{message:'Function failed',context:new Response(JSON.stringify({error:'private secret details'}),{status:503})}})
 const result=await askCareerCoach('Help with careers')
 expect(result.kind).toBe('error')
 if(result.kind==='error'){
  expect(result.message).toMatch(/provider configuration/)
  expect(result.message).not.toMatch(/private secret details/)
 }
})
it('explains quota errors and does not confuse approval with a completed answer',async()=>{
 expect(explainCoachFailure(429)).toMatch(/daily request limit/)
 invoke.mockResolvedValueOnce({data:{mode:'approval_required',ok:false},error:null})
 expect(await askCareerCoach('Publish this')).toEqual({kind:'approval_required'})
})
