import { chromium, devices } from 'playwright'
import { mkdir } from 'node:fs/promises'
import assert from 'node:assert/strict'

const baseUrl = process.env.MELA_APP_URL || 'https://melakulms.github.io/mela-app/'
const browser = await chromium.launch({ headless: true })
const report = []
const pixel = devices['Pixel 7'] ?? devices['Pixel 5']
const context = await browser.newContext({ ...pixel, locale: 'en-US', serviceWorkers: 'allow' })
const page = await context.newPage()
const expectedRelease = process.env.MELA_EXPECTED_SHA || ''
let pageError = ''
page.on('pageerror', error => { pageError = String(error) })

async function step(name, operation) {
  try {
    await operation()
    report.push('PASS ' + name)
  } catch (error) {
    report.push('FAIL ' + name + ': ' + String(error))
    throw error
  }
}

try {
  await step('Public MELA loads the real signup screen on mobile Chromium', async () => {
    await page.goto(baseUrl + '?view=practice', { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.getByRole('heading', { name: /create your mela account/i }).waitFor({ timeout: 30000 })
    assert.equal(new URL(page.url()).searchParams.get('view'), 'practice')
  })

  await step('Student, family, teacher and employer are selectable', async () => {
    const select = page.getByLabel('I am registering as')
    for (const role of ['student', 'parent', 'teacher', 'company']) {
      await select.selectOption(role)
      assert.equal(await select.inputValue(), role)
    }
  })

  await step('Settings navigation stays in the app without anchor history', async () => {
    await page.getByRole('button', { name: 'Settings & downloads — app version' }).click()
    assert.equal(await page.locator('#mela-settings-content').isVisible(), true)
    const before = page.url()
    await page.locator('.settings-jump').getByRole('button', { name: 'Learning' }).click()
    assert.equal(page.url(), before)
  })

  await step('Back to MELA Home closes Settings and resets app section', async () => {
    await page.getByRole('link', { name: 'Back to MELA Home' }).first().click()
    await page.waitForURL('**/?view=dashboard')
    await page.getByRole('heading', { name: /create your mela account/i }).waitFor()
    assert.equal(await page.locator('#mela-settings-content').isVisible(), false)
    assert.equal(await page.getByRole('heading', { name: 'Settings', exact: true }).isVisible(), false)
    assert.equal(new URL(page.url()).searchParams.get('view'), 'dashboard')
  })

  await step('Android browser Back closes Settings without leaving MELA', async () => {
    await page.getByRole('button', { name: 'Settings & downloads — app version' }).click()
    assert.equal(await page.locator('#mela-settings-content').isVisible(), true)
    const beforeBack = await page.evaluate(() => ({ state: history.state, url: location.href }))
    assert.equal(beforeBack.state?.melaSettingsOpen, true, 'Settings must add an Android Back history entry')
    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 })
    const afterBack = await page.evaluate(() => ({ state: history.state, url: location.href, open: !!document.getElementById('mela-settings-content') }))
    console.log('Android Back evidence:', JSON.stringify({ beforeBack, afterBack }))
    await page.waitForFunction(() => document.getElementById('mela-settings-content') === null, null, { timeout: 10000 })
    assert.equal(new URL(page.url()).origin, new URL(baseUrl).origin)
    assert.equal(page.url().includes('/mela-app/'), true)
  })

  await step('Settings and signup have no horizontal overflow at Android dimensions', async () => {
    const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, viewport: window.innerWidth }))
    assert.ok(dimensions.scrollWidth <= dimensions.viewport + 2, JSON.stringify(dimensions))
  })

  await step('Live release marker matches this deployment when supplied', async () => {
    const response = await page.request.get(new URL('mela-release.json', baseUrl).toString(), { timeout: 20000 })
    assert.equal(response.ok(), true)
    const marker = await response.json()
    assert.match(marker.commit, /^[a-f0-9]{40}$/)
    if (expectedRelease) assert.equal(marker.commit, expectedRelease)
    report.push('RELEASE ' + marker.commit)
  })

  await step('Signed-in Settings closes through logout, login and Home (isolated API fixtures)', async () => {
    // Exercise the published UI without creating accounts or sending test tokens
    // to production. Every Supabase request in this isolated context is fulfilled.
    const signedContext = await browser.newContext({ ...pixel, locale: 'en-US', serviceWorkers: 'block' })
    try {
      const signedPage = await signedContext.newPage()
      signedPage.on('pageerror', error => { throw error })
      const user = { id:'11111111-1111-4111-8111-111111111111', email:'navigation@example.invalid', aud:'authenticated', role:'authenticated', app_metadata:{provider:'email'}, user_metadata:{} }
      const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
      const exp = Math.floor(Date.now()/1000)+3600
      const session = { access_token: `${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:user.id,exp,role:'authenticated',aal:'aal1'})}.fixture`, refresh_token:'fixture-only', expires_at:exp, expires_in:3600, token_type:'bearer', user }
      let hasSubjects = true
      const profile = {...user, full_name:'Navigation Test', account_status:'active', email_verified:true, profile_completion:100, coin_balance:0, education_onboarding_completed:true, education_stage_key:'university', grade_level:null, preferred_language:'English', role:'student'}
      const dashboard = {profile, passport:{profile_score:100,badge_count:0},practice:{stats:{current_streak_days:0}},arena:{arena_achievements:0},feature_flags:{}}
      await signedPage.route('https://duizgtmbptmlbyipreqg.supabase.co/**', async route => {
        const path = new URL(route.request().url()).pathname
        let data = []
        if (path === '/auth/v1/user') data = user
        else if (path === '/auth/v1/token') data = session
        else if (path === '/auth/v1/logout') { await route.fulfill({status:204}); return }
        else if (path === '/rest/v1/profiles') data = [profile]
        else if (path === '/rest/v1/student_profiles') data = [{subjects:hasSubjects?['mathematics']:[]}]
        else if (path === '/rest/v1/rpc/get_my_dashboard_v36') data = dashboard
        await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)})
      })
      await signedPage.goto(baseUrl+'?view=dashboard', {waitUntil:'domcontentloaded'})
      await signedPage.getByRole('heading',{name:/create your mela account/i}).waitFor()
      const login = async (homeHeading = 'Explore MELA') => {
        if (!await signedPage.getByLabel('Email or beta username').isVisible()) await signedPage.getByRole('button',{name:'Log in',exact:true}).click()
        await signedPage.getByLabel('Email or beta username').fill(user.email)
        await signedPage.getByLabel('Password',{exact:true}).fill('Fixture-password-123')
        await signedPage.getByRole('button',{name:'Log in',exact:true}).click()
        await signedPage.getByRole('heading',{name:homeHeading,exact:true}).waitFor().catch(async error => { console.error('Signed-in test page:', await signedPage.locator('body').innerText()); throw error })
        assert.equal(await signedPage.locator('#mela-settings-content').count(),0)
      }
      await login()

      // Verify the exact production features requested by the owner, using
      // isolated mock authentication rather than real production accounts.
      const dashboardArena=signedPage.locator('button.module-card.mc-arena')
      await dashboardArena.waitFor({timeout:30000})
      assert.equal(await dashboardArena.isEnabled(),true,'Arena student dashboard card must be enabled')
      await dashboardArena.click()
      await signedPage.getByRole('heading',{name:'Arena',exact:true}).waitFor({timeout:30000})
      const livePracticeButtons=signedPage.getByRole('button',{name:'Try interactive practice'})
      await livePracticeButtons.first().waitFor({timeout:20000}).catch(async cause => {
        console.error('Arena page content:',(await signedPage.locator('body').innerText()).slice(0,1800))
        throw cause
      })
      assert.equal(await livePracticeButtons.count(),8,'All eight Arena practice entries must be on published mobile UI')
      await livePracticeButtons.last().click()
      await signedPage.getByRole('heading',{name:/Tournaments.*Interactive demo/i}).waitFor()
      assert.equal(await signedPage.getByText(/Practice simulation, NOT an official match/i).count()>0,true)

      await signedPage.locator('.bottom-nav button').nth(3).click()
      await signedPage.getByText('Scholarship research is not an offer, award or admission decision').waitFor({timeout:30000})
      await signedPage.locator('.bottom-nav button').first().click()
      await signedPage.getByRole('heading',{name:'Explore MELA',exact:true}).waitFor({timeout:30000})

      await signedPage.getByRole('button',{name:'Open MELA settings'}).click()
      await signedPage.getByRole('heading',{name:'Settings',exact:true}).waitFor()
      await signedPage.getByRole('button',{name:'Log out',exact:true}).click()
      await signedPage.getByLabel('Email or beta username').waitFor()
      assert.equal(await signedPage.locator('#mela-settings-content').count(),0)
      await login()
      await signedPage.getByRole('button',{name:'Open MELA settings'}).click()
      await signedPage.getByRole('link',{name:'Back to MELA Home',exact:true}).first().click()
      await signedPage.getByRole('heading',{name:'Explore MELA',exact:true}).waitFor().catch(async error => { console.error('Signed-in test page:', await signedPage.locator('body').innerText()); throw error })
      assert.equal(await signedPage.locator('#mela-settings-content').count(),0)
      assert.equal(new URL(signedPage.url()).searchParams.get('view'),'dashboard')
      // Reproduce the real account condition: complete flag but no saved subjects.
      hasSubjects = false
      await signedPage.reload({waitUntil:'domcontentloaded'})
      await signedPage.getByRole('heading',{name:'MELA Home',exact:true}).waitFor()
      await signedPage.getByRole('button',{name:'Complete my profile',exact:true}).click()
      await signedPage.getByRole('heading',{name:'Complete your education profile',exact:true}).waitFor()
      await signedPage.getByRole('link',{name:'MELA Home',exact:true}).click()
      await signedPage.getByRole('heading',{name:'MELA Home',exact:true}).waitFor()
      assert.equal(await signedPage.getByRole('heading',{name:'Complete your education profile',exact:true}).count(),0)
      await signedPage.getByRole('button',{name:'Settings & downloads — app version'}).click()
      await signedPage.getByRole('button',{name:'Sign out',exact:true}).click()
      await signedPage.getByLabel('Email or beta username').waitFor()
      assert.equal(await signedPage.locator('#mela-settings-content').count(),0)
      await login('MELA Home')
      assert.equal(await signedPage.getByRole('heading',{name:'Complete your education profile',exact:true}).count(),0)

    } finally { await signedContext.close() }
  })

  await step('Verified teacher can fill and save grade-specific teaching profile on Android (isolated fixtures)', async () => {
    // No real production account is created, impersonated or modified.
    const teacherContext=await browser.newContext({ ...pixel, locale:'en-US', serviceWorkers:'block' })
    try {
      const teacherPage=await teacherContext.newPage()
      teacherPage.on('pageerror', error=>{ throw error })
      const teacher={id:'22222222-2222-4222-8222-222222222222',email:'teacher-fixture@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{}}
      const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url')
      const exp=Math.floor(Date.now()/1000)+3600
      const session={access_token:`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:teacher.id,exp,role:'authenticated',aal:'aal1'})}.fixture`,refresh_token:'fixture-only',expires_at:exp,expires_in:3600,token_type:'bearer',user:teacher}
      let saved=false,readBack=false
      const baseProfile={id:teacher.id,email:teacher.email,role:'teacher',full_name:'Verified Teacher',account_status:'active',email_verified:true,role_selected_at:new Date().toISOString(),profile_completion:0,preferred_language:'English',coin_balance:0}
      await teacherPage.route('https://duizgtmbptmlbyipreqg.supabase.co/**',async route=>{
        const path=new URL(route.request().url()).pathname
        let data=[]
        if(path==='/auth/v1/user')data=teacher
        else if(path==='/auth/v1/token')data=session
        else if(path==='/rest/v1/profiles'){
          if(saved)readBack=true
          data=[{...baseProfile,profile_completion:saved?100:0}]
        }
        else if(path==='/rest/v1/teacher_profiles')data=saved?[{user_id:teacher.id}]:[]
        else if(path==='/rest/v1/mela_learning_programs')data=[{subject_title:'Mathematics'}]
        else if(path==='/rest/v1/rpc/complete_my_profile_v37'){
          saved=true
          data={...baseProfile,profile_completion:100}
        }
        else if(path==='/rest/v1/rpc/get_my_dashboard_v36')data={profile:{...baseProfile,profile_completion:100},feature_flags:{}}
        await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)})
      })
      await teacherPage.goto(baseUrl+'?view=dashboard',{waitUntil:'domcontentloaded'})
      await teacherPage.getByRole('heading',{name:/create your mela account/i}).waitFor()
      await teacherPage.getByRole('button',{name:'Log in',exact:true}).click()
      await teacherPage.getByLabel('Email or beta username').fill(teacher.email)
      await teacherPage.getByLabel('Password',{exact:true}).fill('Fixture-password-123')
      await teacherPage.getByRole('button',{name:'Log in',exact:true}).click()
      await teacherPage.getByRole('heading',{name:'Teacher profile',exact:true}).waitFor({timeout:30000})
      await teacherPage.getByLabel('School / teaching institution (required)').fill('Demo School')
      await teacherPage.getByLabel('Teaching qualification (required)').fill('Sample certification for UI testing')
      await teacherPage.getByLabel('Add an existing MELA curriculum subject').selectOption('Mathematics')
      assert.equal((await teacherPage.getByLabel('Subjects you teach (required, comma separated)').inputValue()).includes('Mathematics'),true)
      await teacherPage.getByRole('button',{name:'Grade 7'}).click()
      await teacherPage.getByRole('button',{name:'Save teacher profile'}).click()
      await teacherPage.waitForFunction(()=>!document.querySelector('h1')?.textContent?.includes('Teacher profile'),null,{timeout:30000})
      assert.equal(saved,true,'Profile completion RPC must run')
      assert.equal(readBack,true,'Saved profile must be independently re-read')
      const dimensions=await teacherPage.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth}))
      assert.ok(dimensions.width<=dimensions.viewport+2,'Teacher setup must fit Android viewport')
    } finally { await teacherContext.close() }
  })

  await step('No uncaught mobile page errors', async () => {
    assert.equal(pageError, '')
  })
} catch (error) {
  console.error(String(error))
  process.exitCode = 1
} finally {
  await mkdir('android-smoke-artifacts', { recursive: true })
  await page.screenshot({ path: 'android-smoke-artifacts/mobile-mela.png', fullPage: true }).catch(() => {})
  console.log(report.join('\n'))
  await context.close()
  await browser.close()
}
