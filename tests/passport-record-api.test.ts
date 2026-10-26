import { beforeEach,expect,it,vi } from 'vitest'
import {projectPayload,savePassportProject} from '../src/lib/passport-records'
const mocks=vi.hoisted(()=>({auth:vi.fn(),insert:vi.fn(),update:vi.fn(),eq:vi.fn(),single:vi.fn()}))
vi.mock('../src/lib/supabase',()=>({supabase:{auth:{getUser:mocks.auth},from:()=>{const q:any={insert:(p:any)=>{mocks.insert(p);return q},update:(p:any)=>{mocks.update(p);return q},eq:(...a:any[])=>{mocks.eq(...a);return q},select:()=>q,single:mocks.single};return q}}}))
const draft={title:' My project ',description:'Work',project_url:'',repository_url:'',is_public:false}
beforeEach(()=>{vi.resetAllMocks();mocks.auth.mockResolvedValue({data:{user:{id:'owner'}},error:null});mocks.single.mockResolvedValue({data:{id:'p'},error:null})})
it('allows only editable project fields and derives ownership from authentication',async()=>{
 await savePassportProject({...draft,user_id:'other',verified:true} as any)
 expect(mocks.insert).toHaveBeenCalledWith({title:'My project',description:'Work',project_url:null,repository_url:null,is_public:false,user_id:'owner'})
})
it('scopes updates to both the authenticated owner and record id',async()=>{
 await savePassportProject(draft,'p');expect(mocks.eq.mock.calls).toEqual([['id','p'],['user_id','owner']]);expect(mocks.update.mock.calls[0][0]).not.toHaveProperty('user_id')
})
it.each(['javascript:alert(1)','http://example.com','https://user:pass@example.com','https://127.0.0.1'])('rejects unsafe link %s',value=>{expect(()=>projectPayload({...draft,project_url:value})).toThrow(/HTTPS/)})
it('does not claim a successful save without a returned row',async()=>{mocks.single.mockResolvedValue({data:null,error:null});await expect(savePassportProject(draft)).rejects.toThrow(/not saved/)})
it('rejects empty titles before making a write',async()=>{await expect(savePassportProject({...draft,title:' '})).rejects.toThrow(/title/);expect(mocks.insert).not.toHaveBeenCalled()})
