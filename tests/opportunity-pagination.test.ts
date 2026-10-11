import { beforeEach, expect, it, vi } from 'vitest'
import { fetchOpenOpportunities } from '../src/lib/opportunities'
const mock = vi.hoisted(() => ({range:vi.fn()}))
vi.mock('../src/lib/supabase',()=>({supabase:{from:()=>{
 const q:any={select:()=>q,eq:()=>q,or:()=>q,order:()=>q,range:mock.range};return q
}}}))
beforeEach(()=>vi.resetAllMocks())
it('loads beyond the first server page without dropping later opportunities',async()=>{
 mock.range.mockResolvedValueOnce({data:Array.from({length:200},(_,i)=>({id:String(i)})),error:null}).mockResolvedValueOnce({data:[{id:'200'}],error:null})
 const rows=await fetchOpenOpportunities();expect(rows).toHaveLength(201);expect(rows[200].id).toBe('200')
 expect(mock.range.mock.calls).toEqual([[0,199],[200,399]])
})
it('does not present an incomplete first page as the full list after a later failure',async()=>{
 mock.range.mockResolvedValueOnce({data:Array.from({length:200},(_,i)=>({id:String(i)})),error:null}).mockResolvedValueOnce({data:null,error:new Error('network failure')})
 await expect(fetchOpenOpportunities()).rejects.toThrow('network failure')
})
