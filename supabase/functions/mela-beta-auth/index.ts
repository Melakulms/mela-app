import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2'

const STAGING_URL = 'https://tungqfmypuwzeyrtaseh.supabase.co'
const allowedOrigin = (origin: string) =>
  origin === 'https://mela-staging.vercel.app'
  || /^https:\/\/mela-staging-[a-z0-9-]+\.vercel\.app$/.test(origin)
  || /^http:\/\/localhost(?::[0-9]+)?$/.test(origin)
const encoder = new TextEncoder()
async function hash(input: string) {
  const buf = await crypto.subtle.digest('SHA-256', encoder.encode(input))
  return Array.from(new Uint8Array(buf), n=>n.toString(16).padStart(2,'0')).join('')
}
const randomCode=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('')
Deno.serve(async(req)=>{
  const origin=req.headers.get('origin')??''
  const headers:Record<string,string> = {'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'}
  if (allowedOrigin(origin)) headers['Access-Control-Allow-Origin']=origin
  headers['Access-Control-Allow-Headers']='authorization, x-client-info, apikey, content-type'
  headers['Access-Control-Allow-Methods']='POST, OPTIONS'
  const reply=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers})
  if(req.method==='OPTIONS') return allowedOrigin(origin)?reply(200,{}):reply(403,{error:'Forbidden'})
  if(req.method!=='POST'||!allowedOrigin(origin))return reply(403,{error:'Forbidden origin'})
  const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if(Deno.env.get('SUPABASE_URL')!==STAGING_URL||!serviceKey)return reply(503,{error:'Staging auth configuration unavailable'})
  const client=createClient(STAGING_URL,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}})
  let data:Record<string,unknown>
  try{const input=await req.text();if(input.length>8000)return reply(413,{error:'Payload too large'});data=JSON.parse(input)}catch{return reply(400,{error:'Invalid request'})}
  if(data.action==='status') return reply(200,{environment:'staging',mode:'single_use_student_invitation',service_ready:true,email_confirmation:'not_used_for_test_usernames'})
  const username=String(data.username??'').trim().toLowerCase()
  if(!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username))return reply(400,{error:'Choose a valid beta username'})
  const password=String(data.action==='reset_password' ? data.new_password??'' : data.password??'')
  if(password.length<12||password.length>128||!/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/\d/.test(password))return reply(400,{error:'Use a strong password with 12+ characters, uppercase, lowercase and a number'})
  const email=username+'@beta.mela.invalid'
  if(data.action==='signup'){
    const name=String(data.full_name??'').trim()
    const role=String(data.requested_role??'')
    const accessCode=String(data.access_code??'').trim()
    if(role!=='student')return reply(403,{error:'Only invited adult learner tests are open'})
    if(data.adult_confirmed!==true)return reply(403,{error:'This test is limited to adults who confirm they are at least 18'})
    if(name.length<2||name.length>100)return reply(400,{error:'Enter a name of 2 to 100 characters'})
    if(accessCode.length<32||accessCode.length>128)return reply(403,{error:'Invalid or expired invitation'})
    const {data:gate,error:gateErr}=await client.from('platform_feature_flags').select('enabled').eq('feature_key','staging_beta_invites').maybeSingle()
    if(gateErr||gate?.enabled!==true)return reply(403,{error:'Invited beta enrollment is not open'})
    const codeHash=await hash(accessCode)
    const {data:invite,error:reserveErr}=await client.from('beta_access_invites')
      .update({used_at:new Date().toISOString()})
      .eq('code_hash',codeHash).eq('role','student')
      .is('used_at',null).is('revoked_at',null)
      .gt('expires_at',new Date().toISOString())
      .select('id').maybeSingle()
    if(reserveErr||!invite)return reply(403,{error:'Invitation invalid, expired or already used'})
    let createdId:string|null=null
    const release=async()=>{
      if(createdId){await client.auth.admin.deleteUser(createdId).catch(()=>{})}
      await client.from('beta_access_invites').update({used_at:null,used_by:null}).eq('id',invite.id).is('used_by',null)
    }
    try{
      const {data:userData,error:createErr}=await client.auth.admin.createUser({
        email,password,email_confirm:true,
        app_metadata:{mela_staging_invited:'true',test_only:true},
        user_metadata:{role:'student',full_name:name,username,test_account:'true',adult_self_attested:true}
      })
      if(createErr||!userData.user){await release();return reply(400,{error:'Unable to create this beta username; it may already be taken'})}
      createdId=userData.user.id
      // The auth insert trigger may run before Auth has finished applying user metadata.
      // After validating the single-use student invitation, synchronize only this new
      // staging user's identity and test status via the trusted service-role client.
      const {data:profile,error:profileErr}=await client.from('profiles')
        .update({username,account_status:'active'})
        .eq('id',createdId).eq('role','student').eq('email',email)
        .select('id,username,account_status').maybeSingle()
      if(profileErr||!profile||profile.username!==username||profile.account_status!=='active'){
        const failureCode = profileErr ? 'profile_query_error' : !profile ? 'profile_not_found' : profile.username!==username ? 'profile_username_not_ready' : 'profile_status_not_active'
        await release()
        return reply(503,{error:'Beta profile could not be prepared ('+failureCode+'). Try again with the same invitation or contact the staging administrator.'})
      }
      const recoveryCode=randomCode()
      const {error:recErr}=await client.from('beta_auth_recovery').upsert({user_id:createdId,recovery_hash:await hash(recoveryCode)})
      if(recErr){await release();return reply(503,{error:'Beta recovery could not be prepared'})}
      const {error:usedErr}=await client.from('beta_access_invites').update({used_by:createdId}).eq('id',invite.id)
      if(usedErr){await release();return reply(503,{error:'Invitation completion failed'})}
      return reply(200,{created:true,username,role:'student',recovery_code:recoveryCode,
        recovery_notice:'Store this offline. It appears only once, is not your password and is needed to reset a beta test account.'})
    }catch{await release();return reply(503,{error:'Staging registration could not be completed'})}
  }
  if(data.action==='reset_password'){
    const recovery=String(data.recovery_code??'').trim()
    if(!/^[a-f0-9]{64}$/.test(recovery))return reply(403,{error:'Invalid beta recovery code'})
    const {data:profile}=await client.from('profiles').select('id').eq('username',username).eq('role','student').maybeSingle()
    if(!profile)return reply(403,{error:'Invalid beta recovery code'})
    const {data:record}=await client.from('beta_auth_recovery').select('user_id').eq('user_id',profile.id).eq('recovery_hash',await hash(recovery)).maybeSingle()
    if(!record)return reply(403,{error:'Invalid beta recovery code'})
    const {error:resetErr}=await client.auth.admin.updateUserById(profile.id,{password})
    if(resetErr)return reply(503,{error:'Unable to reset beta password'})
    const next=randomCode()
    const {error:rotateErr}=await client.from('beta_auth_recovery').update({recovery_hash:await hash(next),rotated_at:new Date().toISOString()}).eq('user_id',profile.id)
    if(rotateErr)return reply(503,{error:'Password changed but recovery-code rotation failed; contact the staging administrator'})
    return reply(200,{reset:true,recovery_code:next,recovery_notice:'Replace the old beta recovery code with this new code.'})
  }
  return reply(400,{error:'Unknown action'})
})
