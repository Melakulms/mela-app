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

/**
 * Public PostgREST acceptance gate: these endpoints run against the real
 * staging database with the publishable (anonymous) key ONLY.
 * Never create an Auth user, enroll or pay in this smoke.
 */
async function publicRows(resource) {
 const response=await get('/rest/v1/'+resource)
 if (!response.ok) throw new Error('Public staging read failed: '+resource.split('?')[0]+' HTTP '+response.status)
 const data=await response.json()
 if(!Array.isArray(data)) throw new Error('Expected an array from '+resource.split('?')[0])
 return data
}
const courseId='a1e00722-2026-4722-8000-000000000001'
const publishedCourses=await publicRows('courses?select=id,slug,is_published&limit=100')
if(!publishedCourses.some(c=>c.id===courseId&&c.is_published===true)) throw new Error('Published staging QA course unavailable')
if(publishedCourses.length!==1) throw new Error('Expected exactly one sample course; unready curriculum may have leaked: '+publishedCourses.length)
console.log('STAGING_PUBLIC_COURSE_PASS: only labelled free QA course publicly listed')
const lessonSamples=await publicRows('course_lessons?select=course_id,title,is_preview&course_id=eq.'+courseId+'&order=lesson_position')
if(lessonSamples.length!==2||lessonSamples.some(x=>x.is_preview!==true))throw new Error('Staging free sample lessons missing or not preview')
console.log('STAGING_PUBLIC_LESSONS_PASS: both QA sample lessons readable')
const languages=await publicRows('platform_languages?select=language_code&enabled=eq.true&order=sort_order')
const languageCodes=languages.map(x=>x.language_code).join(',')
if(languageCodes!=='en,am,om,ti,so')throw new Error('Staging language directory incomplete or unordered: '+languageCodes)
console.log('STAGING_PUBLIC_LANGUAGES_PASS: en,am,om,ti,so')
const reviewQuestions=await get('/rest/v1/mela_question_bank?select=id&limit=4')
if(reviewQuestions.ok){
 const rows=await reviewQuestions.json()
 if(!Array.isArray(rows)||rows.length!==0)throw new Error('Unapproved staging review questions leaked to anonymous users')
}else if(![401,403,404].includes(reviewQuestions.status))throw new Error('Unexpected question security response '+reviewQuestions.status)
console.log('STAGING_REVIEW_QUESTIONS_PRIVATE_PASS: no draft questions exposed anonymously')
