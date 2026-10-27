import { chromium } from 'playwright'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
const fixture = '__mentorship-preview.html'
const html = '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module">\nimport React from \'react\';\nimport { createRoot } from \'react-dom/client\';\nimport Hub from \'/src/pages/MentorshipHub.tsx\';\nimport \'/src/styles.css\';\ncreateRoot(document.getElementById(\'root\')).render(React.createElement(Hub,{stageKey:\'university\',preferredLanguage:\'Amharic\',onBack:()=>{},onNavigate:()=>{}}));\n</script></body></html>\n';
await mkdir('mentorship-smoke-artifacts', { recursive: true });
await writeFile(fixture, html);
const server = spawn('npm', ['run','dev','--','--host','127.0.0.1'], { stdio: 'ignore' });
async function waitForServer() { for(let i=0;i<100;i++) { try { const r=await fetch('http://127.0.0.1:5173/mela-app/'); if(r.ok)return; }catch{} await new Promise(r=>setTimeout(r,200)); } throw new Error('Vite did not start'); }
(async()=>{
await waitForServer();
const browser = await chromium.launch({headless:true});
try {
const page=await browser.newPage({viewport:{width:360,height:800},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/src/lib/mentorship.ts',r=>r.fulfill({contentType:'application/javascript',body:`
export async function fetchVerifiedMentors(){return [{user_id:'mentor-one',full_name:'Test Mentor',headline:'Engineering and scholarship guidance',bio:'Test profile used to verify the mentorship layout.',organization:'Test organization',years_experience:5,rating_average:4.5,rating_count:2,expertise:['Engineering','Scholarships'],languages:['Amharic','English'],availability:[{id:'slot',weekday:1,start_time:'09:00:00',end_time:'10:00:00',timezone:'Africa/Addis_Ababa'}]}]}
export async function fetchMyMentorshipRequests(){return [{id:'request-one',mentor_id:'mentor-one',topic:'Engineering university preparation',status:'accepted',created_at:'2026-10-26T09:00:00Z'}]}
export async function fetchMyMentorshipSessions(){return [{id:'session-one',request_id:'request-one',mentor_id:'mentor-one',mentee_id:'learner',scheduled_at:'2099-11-01T06:00:00Z',duration_min:30,status:'scheduled',rating:null,rating_comment:null}]}
export async function requestMentor(){};export async function cancelMentorshipRequest(){};export async function cancelMentorshipSession(){};export async function rateMentorshipSession(){};
`}));
await page.route('**/src/lib/supabase.ts',r=>r.fulfill({contentType:'application/javascript',body:`export const supabase={rpc:async()=>({data:{active_plan:{title:'Prepare for an engineering scholarship',target_date:'2027-01-01'},steps:[{id:'one',title:'Study algebra',status:'completed'},{id:'two',title:'Draft my application',status:'in_progress'}]},error:null})};`}));
await page.goto('http://127.0.0.1:5173/mela-app/__mentorship-preview.html');
await page.getByText('Prepare for an engineering scholarship',{exact:true}).waitFor();
for(const [label,name] of [['Mentorship Home','home'],['Find a Mentor','directory'],['Resources','resources'],['Progress & Achievements','progress']]){
 await page.getByRole('button',{name:label,exact:true}).click();
 if(name==='directory') await page.getByRole('heading',{name:'Test Mentor'}).waitFor();
 if(name==='progress') await page.getByRole('progressbar').waitFor();
 await page.screenshot({path:'mentorship-smoke-artifacts/'+name+'.png',fullPage:true});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
 if(overflow) throw new Error('Horizontal overflow: '+name);
}
if(errors.length) throw new Error(errors.join('\n'));
console.log('Mobile 360px: home, directory, resources and progress rendered without horizontal overflow or JS errors (mock data).');
} finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{ server.kill('SIGTERM'); await rm(fixture,{force:true}); });
