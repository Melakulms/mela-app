const REF='tungqfmypuwzeyrtaseh';
export async function GET(){
 const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex,nofollow'};
 const base={environment:'staging',project_ref:REF,sign_in_ready:false,checked_at:new Date().toISOString()};
 const key=process.env.MELA_STAGING_PUBLISHABLE_KEY;
 if(!key?.startsWith('sb_publishable_'))return Response.json({...base,auth_health_confirmed:false,message:'Missing staging health-check configuration.'},{status:503,headers});
 try{const r=await fetch('https://tungqfmypuwzeyrtaseh.supabase.co/auth/v1/health',{headers:{apikey:key,Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(6500)});
 const j=await r.json().catch(()=>null);const ok=r.ok&&j?.name==='GoTrue';
 return Response.json({...base,auth_health_confirmed:ok,upstream_status:r.status,message:ok?'Staging Auth service available; live signup/login remains unverified.':'Staging Auth service did not pass the health check.'},{status:ok?200:503,headers})
 }catch{return Response.json({...base,auth_health_confirmed:false,message:'Staging service is unreachable.'},{status:503,headers})}
}