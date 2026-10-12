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
    await page.getByRole('heading', { name: /join the mela beta/i }).waitFor({ timeout: 30000 })
    assert.equal(new URL(page.url()).searchParams.get('view'), 'practice')
  })

  await step('Student, family, teacher and employer are selectable', async () => {
    const select = page.getByLabel('Account type (required)')
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
    await page.getByRole('heading', { name: /join the mela beta/i }).waitFor()
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
      const user = { id:'11111111-1111-4111-8111-111111111111', email:'navigation@example.invalid', aud:'authenticated', role:'authenticated', app_metadata:{provider:'email'}, user_metadata:{} }
      const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
      const exp = Math.floor(Date.now()/1000)+3600
      const session = { access_token: `${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:user.id,exp,role:'authenticated',aal:'aal1'})}.fixture`, refresh_token:'fixture-only', expires_at:exp, expires_in:3600, token_type:'bearer', user }
      const profile = {...user, full_name:'Navigation Test', account_status:'active', email_verified:true, profile_completion:100, coin_balance:0, education_onboarding_completed:true, education_stage_key:'university', grade_level:null, preferred_language:'English', role:'student'}
      const dashboard = {profile, passport:{profile_score:100,badge_count:0},practice:{stats:{current_streak_days:0}},arena:{arena_achievements:0},feature_flags:{}}
      await signedPage.route('https://duizgtmbptmlbyipreqg.supabase.co/**', async route => {
        const path = new URL(route.request().url()).pathname
        let data = []
        if (path === '/auth/v1/user') data = user
        else if (path === '/auth/v1/token') data = session
        else if (path === '/auth/v1/logout') { await route.fulfill({status:204}); return }
        else if (path === '/rest/v1/profiles') data = [profile]
        else if (path === '/rest/v1/rpc/get_my_dashboard_v36') data = dashboard
        await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)})
      })
      await signedPage.goto(baseUrl+'?view=dashboard', {waitUntil:'domcontentloaded'})
      await signedPage.getByRole('heading',{name:/join the mela beta/i}).waitFor()
      const login = async () => {
        if (!await signedPage.getByLabel('Email or beta username').isVisible()) await signedPage.getByRole('button',{name:'Log in',exact:true}).click()
        await signedPage.getByLabel('Email or beta username').fill(user.email)
        await signedPage.getByLabel('Password',{exact:true}).fill('Fixture-password-123')
        await signedPage.getByRole('button',{name:'Log in',exact:true}).click()
        await signedPage.getByRole('heading',{name:'Explore MELA',exact:true}).waitFor()
        assert.equal(await signedPage.locator('#mela-settings-content').count(),0)
      }
      await login()
      await signedPage.getByRole('button',{name:'Open MELA settings'}).click()
      await signedPage.getByRole('heading',{name:'Settings',exact:true}).waitFor()
      await signedPage.getByRole('button',{name:'Log out',exact:true}).click()
      await signedPage.getByLabel('Email or beta username').waitFor()
      assert.equal(await signedPage.locator('#mela-settings-content').count(),0)
      await login()
      await signedPage.getByRole('button',{name:'Open MELA settings'}).click()
      await signedPage.getByRole('link',{name:'Back to MELA Home',exact:true}).first().click()
      await signedPage.getByRole('heading',{name:'Explore MELA',exact:true}).waitFor()
      assert.equal(await signedPage.locator('#mela-settings-content').count(),0)
      assert.equal(new URL(signedPage.url()).searchParams.get('view'),'dashboard')
    } finally { await signedContext.close() }
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
