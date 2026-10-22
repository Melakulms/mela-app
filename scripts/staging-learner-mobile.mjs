// Staging-only public UI mobile smoke. Does not sign in, sign up, write data or capture private screens.
import { chromium, devices } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
const address='http://127.0.0.1:4173'
if(process.env.MELA_MOBILE_STAGING!=='true')throw new Error('This smoke must be launched explicitly in staging mode')
const server=spawn('node',['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4173','--strictPort'],{stdio:'ignore'})
let browser
try {
 let up=false
 for(let i=0;i<40;i++){
   try { const r=await fetch(address,{signal:AbortSignal.timeout(1200)}); if(r.ok){up=true;break} }catch{}
   await new Promise(r=>setTimeout(r,300))
 }
 if(!up)throw new Error('Built staging learner did not serve its HTML')
 browser=await chromium.launch({headless:true})
 const context=await browser.newContext({...devices['Pixel 7'],serviceWorkers:'block'})
 const page=await context.newPage()
 const errors=[]
 const networkIssues=[]
 page.on('pageerror',error=>errors.push(error.message))
 page.on('console',message=>{if(message.type()==='error') networkIssues.push(message.text().slice(0,200))})
 page.on('requestfailed',request=>{networkIssues.push('failed '+new URL(request.url()).pathname+' '+(request.failure()?.errorText??''))})
 page.on('response',response=>{if(response.status()>=400&&new URL(response.url()).origin===address) networkIssues.push('http '+response.status()+' '+new URL(response.url()).pathname)})
 const response=await page.goto(address,{waitUntil:'domcontentloaded',timeout:20000})
 if(response?.status()!==200)throw new Error('Staging learner returned unexpected HTTP status')
 await mkdir('android-staging-artifacts',{recursive:true})
 try {
   await page.locator('input[type="password"]').first().waitFor({timeout:20000})
 } catch (cause) {
   await page.screenshot({path:'android-staging-artifacts/staging-login-diagnostic.png',fullPage:true})
   const words=(await page.locator('body').innerText().catch(()=>''))?.slice(0,700)
   console.log('STAGING_DIAGNOSTIC_HEADINGS '+JSON.stringify(await page.locator('h1,h2').allTextContents().catch(()=>[])))
   console.log('STAGING_DIAGNOSTIC_BODY '+JSON.stringify(words))
   console.log('STAGING_DIAGNOSTIC_ROOT '+JSON.stringify((await page.locator('#root').innerHTML().catch(()=>''))?.slice(0,600)))
   console.log('STAGING_DIAGNOSTIC_SCRIPT_PATHS '+JSON.stringify(await page.locator('script[src]').evaluateAll(items=>items.map(el=>el.getAttribute('src')||'')).catch(()=>[])))
   console.log('STAGING_DIAGNOSTIC_NETWORK '+JSON.stringify(networkIssues.slice(0,8)))
   console.log('STAGING_BROWSER_ERRORS '+JSON.stringify(errors.slice(0,3)))
   throw cause
 }
 const heading=await page.locator('h1').allTextContents()
 if(!heading.length)throw new Error('Mobile staging login heading missing')
 const origin=await page.evaluate(()=>window.location.origin)
 if(origin!==address)throw new Error('Unexpected origin')
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+6)
 if(overflow)throw new Error('Mobile login horizontally overflows viewport')
 await mkdir('android-staging-artifacts',{recursive:true})
 await page.screenshot({path:'android-staging-artifacts/staging-public-login.png',fullPage:true})
 if(errors.length)throw new Error('Browser script errors: '+errors.slice(0,2).join('; ').slice(0,220))
 console.log('STAGING_PIXEL_LOGIN_PASS: mobile login heading, password form, no horizontal overflow, no JS crash')
 const languageChoice=page.locator('#auth-language')
 await languageChoice.waitFor({timeout:12000})
 const options=await languageChoice.locator('option').evaluateAll(items=>items.map(el=>el.value))
 if (JSON.stringify(options)!==JSON.stringify(['en','am','om','ti','so'])) throw new Error('Language chooser does not show five supported codes: '+options.join(','))
 await languageChoice.selectOption('am')
 if(await page.locator('html').getAttribute('lang')!=='am')throw new Error('Amharic did not update page language')
 await page.reload({waitUntil:'domcontentloaded'})
 await page.locator('#auth-language').waitFor({timeout:14000})
 if(await page.locator('#auth-language').inputValue()!=='am')throw new Error('Amharic selection not restored after reload')
 await page.locator('#auth-language').selectOption('en')
 console.log('STAGING_PIXEL_LANGUAGES_PASS: five choices, Amharic setting survives reload')

 // The staging database currently has no public registration release flags.
 // Mobile UX must explain the hold instead of presenting a broken signup form.
 await page.locator('.auth-switch button').last().click()
 await page.getByRole('heading',{name:'Staging registration is closed'}).waitFor({timeout:18000})
 await page.getByText('New staging accounts are not accepting registrations yet.',{exact:false}).waitFor({timeout:16000})
 if(await page.locator('input[type="email"],input[autocomplete="new-password"]').count()){
   throw new Error('Staging exposed account creation inputs while registration is disabled')
 }
 await page.getByRole('button',{name:'Return to staging sign in'}).click()
 await page.locator('input[type="password"]').first().waitFor({timeout:14000})
 console.log('STAGING_PIXEL_REGISTRATION_GUARD_PASS: signup fails closed, user can return to login')

 const offline=await page.goto(address+'/offline.html',{waitUntil:'domcontentloaded'})
 if(offline?.status()!==200)throw new Error('Offline public resource returned '+offline?.status())
 console.log('STAGING_OFFLINE_PASS: public offline.html opens on Pixel-sized Chromium')
 await context.close()
}finally{
 if(browser)await browser.close()
 server.kill('SIGTERM')
}
