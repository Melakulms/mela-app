/** Network checks are GET-only, anonymous and staging-only; no secrets and no user identities printed. */
const url='https://tungqfmypuwzeyrtaseh.supabase.co'
if(process.env.VITE_MELA_STAGING!=='true'||process.env.VITE_SUPABASE_URL!==url) throw new Error('Refusing a non-staging target')
const key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY
if(!key?.startsWith('sb_publishable_'))throw new Error('Missing publishable key')
const get=async(p)=>{
 const r=await fetch(url+p,{method:'GET',headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(12000)})
 return r
}
const health=await get('/auth/v1/health')
if(!health.ok) throw new Error('Staging Auth health returned HTTP '+health.status)
console.log('STAGING_AUTH_HEALTH_PASS: HTTP '+health.status)
const profiles=await get('/rest/v1/profiles?select=id&limit=1')
if(profiles.ok){
 const rows=await profiles.json()
 if(!Array.isArray(rows)||rows.length!==0) throw new Error('Anonymous profiles returned nonempty data')
}else if(![401,403].includes(profiles.status)) throw new Error('Unexpected profile access status '+profiles.status)
console.log('STAGING_ANONYMOUS_PROFILES_PASS: no records exposed')
const disabled=await get('/functions/v1/mela-staging-auth-test')
if(disabled.ok)throw new Error('Staging Auth test endpoint should not be available')
console.log('STAGING_DISABLED_TEST_ENDPOINT_PASS: HTTP '+disabled.status)
