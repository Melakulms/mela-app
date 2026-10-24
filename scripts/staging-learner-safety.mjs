/** No user signup, RLS modifications, production database access or payment writes. */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const stage = 'https://tungqfmypuwzeyrtaseh.supabase.co'
if (process.env.VITE_MELA_STAGING !== 'true' || process.env.VITE_SUPABASE_URL !== stage) {
  throw new Error('STAGING CHECK BLOCKED: unsafe build configuration')
}
if (!process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_')) {
  throw new Error('Missing staging public key')
}
const dir='dist'
for (const path of ['index.html','offline.html','sw.js']) {
 if(!existsSync(join(dir,path))) throw new Error('Missing staging artifact: '+path)
}
const idx=readFileSync(join(dir,'index.html'),'utf8')
if(!idx.includes('src="/assets/') && !idx.includes('href="/assets/')) throw new Error('Staging Vite root assets missing')
const all=[]
function scan(folder){
 for(const e of readdirSync(folder)){const p=join(folder,e);const t=statSync(p);if(t.isDirectory())scan(p);else if(/\.(js|html|json|css)$/.test(p))all.push(p)}
}
scan(dir)
const bundles=all.filter(p=>p.endsWith('.js') && p.includes('assets'))
if(!bundles.length)throw new Error('No staging JS assets')
let matched=false
for(const file of all){
 const s=readFileSync(file,'utf8')
 if(s.includes(stage))matched=true
 if(s.includes('https://duizgtmbptmlbyipreqg.supabase.co')) throw new Error('Production Supabase URL embedded in staging bundle: '+file)
 // Supabase JS ships harmless words such as "sb_secret_" in its SDK
 // validation logic. Detect a populated secret-looking value, not its label.
 if(/sb_secret_[A-Za-z0-9_-]{25,}/.test(s))throw new Error('Potential privileged key value in public output: '+file)
}
if(!matched)throw new Error('Staging Supabase origin missing from compiled app')
console.log('STAGING_BUILD_PASS: root assets, offline files, staging origin, no production endpoint or privileged key labels')
