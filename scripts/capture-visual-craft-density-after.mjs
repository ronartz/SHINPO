import { spawn } from 'node:child_process'
import { mkdirSync, copyFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium } from '../frontend/node_modules/@playwright/test/index.mjs'

const ROOT = resolve(process.cwd())
const LOCAL_DIR = join(ROOT, 'docs/qa/screenshots/visual-craft-density/after')
const ARTIFACT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/visual-craft-density/after'

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
    if (urlStr.includes('/goals')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }
    if (urlStr.includes('/missions')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }
    if (urlStr.includes('/focus/sessions') || urlStr.includes('/focus-sessions')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }
    if (urlStr.includes('/progress')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ currentStreak: 3, totalXp: 180, progressPercent: 45, level: 2 }) })
    }
    if (urlStr.includes('/device/processes') || urlStr.includes('/processes')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
        { pid: 101, name: 'code', cpuPercent: 2.1, memoryBytes: 524288000, category: 'DEVELOPMENT', status: 'RUNNING' },
        { pid: 102, name: 'firefox', cpuPercent: 4.5, memoryBytes: 1048576000, category: 'BROWSER', status: 'RUNNING' },
        { pid: 103, name: 'discord', cpuPercent: 1.2, memoryBytes: 314572800, category: 'COMMUNICATION', status: 'RUNNING' },
        { pid: 104, name: 'spotify', cpuPercent: 0.8, memoryBytes: 209715200, category: 'MEDIA', status: 'RUNNING' }
      ]) })
    }
    if (urlStr.includes('/device/sentinel') || urlStr.includes('/sentinel')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ active: true, mode: 'PROTECTED', appsObserved: 4, blockedAttempts: 0 }) })
    }
    if (urlStr.includes('/analytics/dashboard') || urlStr.includes('/analytics')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        totalFocusMinutes: 180,
        completedSessions: 4,
        dailyBreakdown: [
          { date: '2026-11-02', focusMinutes: 45 },
          { date: '2026-11-03', focusMinutes: 30 },
          { date: '2026-11-04', focusMinutes: 60 },
          { date: '2026-11-05', focusMinutes: 0 },
          { date: '2026-11-06', focusMinutes: 45 }
        ],
        streakDays: 3
      }) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })
}

async function run() {
  console.log('Starting preview server for after captures...')
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
      console.log(`  Saved after: ${filename}`)
    }

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    })
    const page = await context.newPage()

    // Setup authenticated session
    await setupMockRoutes(page)
    await page.addInitScript(() => {
      localStorage.setItem('shinpo_access_token', 'valid-mock-jwt-token')
      localStorage.setItem('shinpo_auth_user', JSON.stringify({ id: 1, username: 'eonx', email: 'eonx@shinpo.dev' }))
      localStorage.setItem('shinpo_onboarding_verified', 'true')
      sessionStorage.setItem('shinpo_splash_shown', 'true') // prevent startup from intercepting tab views
    })

    // 1. Dashboard across all 4 themes
    console.log('1. Dashboard across 4 themes...')
    await page.goto('http://localhost:4173/?v2=true&theme=dark&tab=Dashboard')
    await page.waitForSelector('.app-shell', { timeout: 10000 })
    await sleep(600)
    await capture(page, '01_after_dashboard_aurora_dark.png')

    await page.goto('http://localhost:4173/?v2=true&theme=light&tab=Dashboard')
    await page.waitForSelector('.app-shell', { timeout: 10000 })
    await sleep(600)
    await capture(page, '01_after_dashboard_aurora_light.png')

    await page.goto('http://localhost:4173/?v2=false&theme=dark&tab=Dashboard')
    await page.waitForSelector('.app-shell', { timeout: 10000 })
    await sleep(600)
    await capture(page, '01_after_dashboard_classic_dark.png')

    await page.goto('http://localhost:4173/?v2=false&theme=light&tab=Dashboard')
    await page.waitForSelector('.app-shell', { timeout: 10000 })
    await sleep(600)
    await capture(page, '01_after_dashboard_classic_light.png')

    // 2. Focus Engine
    console.log('2. Focus Engine after...')
    await page.goto('http://localhost:4173/?v2=true&theme=dark&tab=Focus+Engine')
    await page.waitForSelector('.app-shell', { timeout: 10000 })
    await sleep(600)
    await capture(page, '02_after_focus_aurora_dark.png')

    // 3. Focus Protection / Task Manager
    console.log('3. Focus Protection after...')
    await page.goto('http://localhost:4173/?v2=true&theme=dark&tab=Task+Manager')
    await page.waitForSelector('.app-shell', { timeout: 10000 })
    await sleep(600)
    await capture(page, '03_after_focus_protection_aurora_dark.png')

    // 4. Schedule / Calendar
    console.log('4. Calendar after...')
    await page.goto('http://localhost:4173/?v2=true&theme=dark&tab=Schedule')
    await page.waitForSelector('.app-shell', { timeout: 10000 })
    await sleep(600)
    await capture(page, '04_after_calendar_aurora_dark.png')

    // 5. Goals & Missions
    console.log('5. Goals & Tasks after...')
    await page.goto('http://localhost:4173/?v2=true&theme=dark&tab=Goals+%26+Missions')
    await page.waitForSelector('.app-shell', { timeout: 10000 })
    await sleep(600)
    await capture(page, '05_after_goals_aurora_dark.png')

    // 6. Analytics
    console.log('6. Analytics after...')
    await page.goto('http://localhost:4173/?v2=true&theme=dark&tab=Analytics')
    await page.waitForSelector('.app-shell', { timeout: 10000 })
    await sleep(600)
    await capture(page, '06_after_analytics_aurora_dark.png')

    // 7. EONPAI
    console.log('7. EONPAI after...')
    await page.goto('http://localhost:4173/?v2=true&theme=dark&tab=AI+Assistant')
    await page.waitForSelector('.app-shell', { timeout: 10000 })
    await sleep(600)
    await capture(page, '07_after_eonpai_aurora_dark.png')

    // 8. Rewards
    console.log('8. Rewards after...')
    await page.goto('http://localhost:4173/?v2=true&theme=dark&tab=Rewards')
    await page.waitForSelector('.app-shell', { timeout: 10000 })
    await sleep(600)
    await capture(page, '08_after_rewards_aurora_dark.png')

    await context.close()
    await browser.close()
    console.log('\nAll after captures completed successfully!')
  } finally {
    proc.kill('SIGTERM')
  }
}

run().catch((err) => {
  console.error('Error in after capture:', err)
  process.exit(1)
})
