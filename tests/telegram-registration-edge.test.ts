// @vitest-environment node
// Exercise the deployed registration handler, including fail-closed username binding.
import { readFileSync } from 'node:fs'
import { transpileModule, ModuleKind } from 'typescript'
import { describe, expect, it, vi } from 'vitest'

async function run(binding: {username:string}|null, bindingError:unknown=null, overrides:Record<string,unknown>={}) {
  const createUser=vi.fn().mockResolvedValue({data:{user:{id:'test-user'}},error:null})
  const tables:string[]=[]
  const admin={auth:{admin:{createUser,deleteUser:vi.fn()}},rpc:vi.fn().mockResolvedValue({data:true,error:null}),from:(table:string)=>{
    tables.push(table)
    const result=table==='policy_documents'?[{policy_key:'terms',version:'2026-08-14'},{policy_key:'privacy',version:'2026-08-14'}]:table==='platform_feature_flags'?{enabled:true}:table==='telegram_registration_bindings'?binding:table==='beta_access_invites'?{id:'invite',role:'student'}:null
    const query:any={select:()=>query,eq:()=>query,is:()=>query,gt:()=>query,in:()=>query,update:()=>query,insert:()=>query,
      maybeSingle:async()=>({data:result,error:table==='telegram_registration_bindings'?bindingError:null}),
      then:(resolve:any)=>Promise.resolve({error:null}).then(resolve)}
    return query
  }}
  let handler!:(req:Request)=>Promise<Response>
  const source=readFileSync(new URL('../supabase/functions/mela-beta-auth/index.ts',import.meta.url),'utf8').replace(/^import .*\n/gm,'')
  const js=transpileModule(source,{compilerOptions:{module:ModuleKind.None}}).outputText
  new Function('Deno','createClient',js)({env:{get:()=> 'test-only'},serve:(f:typeof handler)=>{handler=f}},()=>admin)
  const response=await handler(new Request('https://example.invalid',{method:'POST',headers:{Origin:'https://melakulms.github.io','Content-Type':'application/json'},body:JSON.stringify({action:'signup',username:'learner',full_name:'Test learner',password:'TestPassword12345',access_code:'a'.repeat(64),requested_role:'student',age_band:'18_plus',terms_accepted:true,privacy_acknowledged:true,terms_acknowledged_version:'2026-08-14',privacy_acknowledged_version:'2026-08-14',...overrides})}))
  return {response,body:await response.json(),createUser,tables}
}

describe('Server enforced Telegram verification',()=>{
  it('rejects missing legal acknowledgement before consuming an invitation',async()=>{
    const r=await run(null,null,{terms_accepted:false})
    expect(r.response.status).toBe(400)
    expect(r.createUser).not.toHaveBeenCalled()
    expect(r.tables).not.toContain('beta_access_invites')
  })
  it('rejects an unverified policy version before consuming an invitation',async()=>{
    const r=await run(null,null,{terms_acknowledged_version:'obsolete'})
    expect(r.response.status).toBe(409)
    expect(r.createUser).not.toHaveBeenCalled()
  })
  it('rejects a code bound to a different username before consuming it',async()=>{
    const r=await run({username:'someone.else'})
    expect(r.response.status).toBe(400)
    expect(r.createUser).not.toHaveBeenCalled()
    expect(r.tables).not.toContain('beta_access_invites')
  })
  it('fails closed when the binding lookup is unavailable',async()=>{
    const r=await run(null,{message:'database unavailable'})
    expect(r.response.status).toBe(503)
    expect(r.createUser).not.toHaveBeenCalled()
  })
  it('records Telegram verification in server controlled app metadata',async()=>{
    const r=await run({username:'learner'})
    expect(r.response.status).toBe(201)
    expect(r.createUser.mock.calls[0][0].app_metadata.mela_verification_method).toBe('telegram')
    expect(r.body.recovery_code).toMatch(/^MELA-R-/)
  })
  it('preserves administrator invitations without claiming Telegram verification',async()=>{
    const r=await run(null)
    expect(r.response.status).toBe(201)
    expect(r.createUser.mock.calls[0][0].app_metadata).toEqual({mela_verification_method:'administrator_invitation'})
  })
})
