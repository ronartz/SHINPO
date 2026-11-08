import { spawn } from 'node:child_process'
import { mkdirSync, copyFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium } from '../frontend/node_modules/@playwright/test/index.mjs'

const ROOT = resolve(process.cwd())
const LOCAL_DIR = join(ROOT, 'docs/qa/screenshots/polished-desktop/baseline')
const ARTIFACT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/polished-desktop/baseline'

mkdirSync(LOCAL_DIR, { recursive: true })
mkdirSync(ARTIFACT_DIR, { recursive: true })

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return true
    } catch {
      // waiting
    }
    await sleep(250)
  }
  throw new Error(`Server at ${url} failed to respond`)
}

async function setupMockRoutes(page) {
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const urlStr = route.request().url()
    if (urlStr.includes('/auth/me')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, username: 'eonx', email: 'eonx@shinpo.dev' }) })
    }
    if (urlStr.includes('/onboarding/state')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'COMPLETED' }) })
    }
    if (urlStr.includes('/goals') || urlStr.includes('/missions') || urlStr.includes('/focus/sessions') || urlStr.includes('/focus-sessions')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }
    if (urlStr.includes('/progress')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ currentStreak: 3, totalXp: 120, progressPercent: 40 }) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })
}

async function run() {
  console.log('Starting preview server for baseline captures...')
  const proc = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
    cwd: join(ROOT, 'frontend'),
    stdio: 'pipe',
  })

  try {
    await waitForServer('http://localhost:4173/')
    console.log('Preview server ready at http://localhost:4173/\n')

    const browser = await chromium.launch({ headless: true })

    async function capture(page, filename, clip = null) {
      const localPath = join(LOCAL_DIR, filename)
      const artifactPath = join(ARTIFACT_DIR, filename)
      await page.screenshot({ path: localPath, clip: clip || undefined })
      copyFileSync(localPath, artifactPath)
      console.log(`  Saved baseline: ${filename}`)
    }

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    })
    const page = await context.newPage()

    await setupMockRoutes(page)
    await page.addInitScript(() => {
      localStorage.setItem('shinpo_access_token', 'valid-mock-jwt-token')
      localStorage.setItem('shinpo_auth_user', JSON.stringify({ id: 1, username: 'eonx', email: 'eonx@shinpo.dev' }))
      localStorage.setItem('shinpo_onboarding_verified', 'true')
    })

    // 1. Topbar Aurora Dark
    console.log('1. Baseline Topbar Aurora Dark...')
    await page.goto('http://localhost:4173/?v2=true&theme=dark')
    await page.waitForSelector('.app-shell', { timeout: 10000 })
    await sleep(600)
    await capture(page, '01_baseline_topbar_aurora_dark.png', { x: 0, y: 0, width: 1440, height: 120 })

    // 2. Topbar Aurora Light
    console.log('2. Baseline Topbar Aurora Light...')
    await page.goto('http://localhost:4173/?v2=true&theme=light')
    await page.waitForSelector('.app-shell', { timeout: 10000 })
    await sleep(600)
    await capture(page, '02_baseline_topbar_aurora_light.png', { x: 0, y: 0, width: 1440, height: 120 })

    // 3. Topbar Classic Dark
    console.log('3. Baseline Topbar Classic Dark...')
    await page.goto('http://localhost:4173/?v2=false&theme=dark')
    await page.waitForSelector('.app-shell', { timeout: 10000 })
    await sleep(600)
    await capture(page, '03_baseline_topbar_classic_dark.png', { x: 0, y: 0, width: 1440, height: 120 })

    // 4. Topbar Classic Light
    console.log('4. Baseline Topbar Classic Light...')
    await page.goto('http://localhost:4173/?v2=false&theme=light')
    await page.waitForSelector('.app-shell', { timeout: 10000 })
    await sleep(600)
    await capture(page, '04_baseline_topbar_classic_light.png', { x: 0, y: 0, width: 1440, height: 120 })

    // 5. Existing Settings modal - Appearance
    console.log('5. Baseline Settings modal Appearance...')
    await page.goto('http://localhost:4173/?v2=true&theme=dark')
    await page.waitForSelector('.app-shell', { timeout: 10000 })
    await sleep(500)
    // Click settings button
    await page.click('[data-tutorial="topbar-settings-btn"]')
    await page.waitForSelector('.settings-modal-box', { timeout: 5000 })
    await sleep(400)
    await capture(page, '05_baseline_settings_appearance_aurora_dark.png')

    // 6. Settings Account
    console.log('6. Baseline Settings Account...')
    await page.click('[data-section="account"]')
    await sleep(400)
    await capture(page, '06_baseline_settings_account_aurora_dark.png')

    // 7. Settings EONPAI
    console.log('7. Baseline Settings EONPAI...')
    await page.click('[data-section="eonpai"]')
    await sleep(400)
    await capture(page, '07_baseline_settings_eonpai_aurora_dark.png')

    // Close settings
    await page.keyboard.press('Escape')
    await sleep(300)

    // 8. Focus running state with topbar visible
    console.log('8. Baseline Focus running state with topbar visible...')
    const focusBtn = await page.$('button[data-tut="nav-focus"], button:has-text("Focus")')
    if (focusBtn) {
      await focusBtn.click()
      await sleep(500)
    }
    await capture(page, '08_baseline_focus_running_topbar_visible.png')

    await context.close()
    await browser.close()
    console.log('\nAll baseline captures completed successfully!')
  } finally {
    proc.kill('SIGTERM')
  }
}

run().catch((err) => {
  console.error('Error in baseline capture:', err)
  process.exit(1)
})
