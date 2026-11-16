import { spawn } from 'node:child_process'
import { mkdirSync, copyFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium } from '../frontend/node_modules/@playwright/test/index.mjs'

const ROOT = resolve(process.cwd())
const LOCAL_DIR = join(ROOT, 'docs/qa/screenshots/polished-desktop/after')
const ARTIFACT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/polished-desktop/after'

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

async function setupMockRoutes(page, hasActiveSession = false) {
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const urlStr = route.request().url()
    if (urlStr.includes('/auth/me')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, username: 'eonx', email: 'eonx@shinpo.dev' }) })
    }
    if (urlStr.includes('/onboarding/state')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'COMPLETED' }) })
    }
    if (urlStr.includes('/focus/sessions') || urlStr.includes('/focus-sessions')) {
      if (hasActiveSession) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'sess-active-1',
              title: 'Deep Architecture Sprint',
              status: 'ACTIVE',
              durationMinutes: 45,
              remainingSeconds: 2100,
              startedAt: new Date().toISOString(),
              targetDurationSeconds: 2700,
            }
          ])
        })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }
    if (urlStr.includes('/goals') || urlStr.includes('/missions')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }
    if (urlStr.includes('/progress')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ currentStreak: 5, totalXp: 450, progressPercent: 65 }) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })
}

async function run() {
  console.log('Building frontend before capture...')
  const buildProc = spawn('npm', ['--prefix', 'frontend', 'run', 'build'], { stdio: 'inherit' })
  await new Promise((resolve, reject) => {
    buildProc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Build failed with code ${code}`))))
  })

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
      console.log(`  Saved: ${filename}`)
    }

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    })
    const page = await context.newPage()

    await setupMockRoutes(page, false)
    await page.addInitScript(() => {
      localStorage.setItem('shinpo_access_token', 'valid-mock-jwt-token')
      localStorage.setItem('shinpo_auth_user', JSON.stringify({ id: 1, username: 'eonx', email: 'eonx@shinpo.dev' }))
      localStorage.setItem('shinpo_onboarding_verified', 'true')
    })

    // 1. Topbar with menus closed - Aurora Dark
    console.log('1. Topbar with menus closed (Aurora Dark)...')
    await page.goto('http://localhost:4173/?v2=true&theme=dark')
    await page.waitForSelector('.app-shell', { timeout: 10000 })
    await sleep(600)
    await capture(page, '01_after_topbar_aurora_dark_closed.png', { x: 0, y: 0, width: 1440, height: 120 })

    // 2. Account Dropdown Open - Aurora Dark
    console.log('2. Account Dropdown Open (Aurora Dark)...')
    await page.click('[data-tutorial="profile-badge-card"]')
    await page.waitForSelector('.shinpo-account-dropdown', { timeout: 5000 })
    await sleep(300)
    await capture(page, '02_after_account_dropdown_open_dark.png', { x: 1050, y: 0, width: 390, height: 420 })

    // 3. Account Dropdown Open - Aurora Light
    console.log('3. Account Dropdown Open (Aurora Light)...')
    await page.goto('http://localhost:4173/?v2=true&theme=light')
    await page.waitForSelector('.app-shell', { timeout: 10000 })
    await sleep(600)
    await page.click('[data-tutorial="profile-badge-card"]')
    await page.waitForSelector('.shinpo-account-dropdown', { timeout: 5000 })
    await sleep(300)
    await capture(page, '03_after_account_dropdown_open_light.png', { x: 1050, y: 0, width: 390, height: 420 })

    // 4. Power Dropdown Open - Aurora Dark
    console.log('4. Power Dropdown Open (Aurora Dark)...')
    await page.goto('http://localhost:4173/?v2=true&theme=dark')
    await page.waitForSelector('.app-shell', { timeout: 10000 })
    await sleep(600)
    await page.click('button[aria-label="Power menu"]')
    await page.waitForSelector('.shinpo-power-dropdown', { timeout: 5000 })
    await sleep(300)
    await capture(page, '04_after_power_dropdown_open_dark.png', { x: 1100, y: 0, width: 340, height: 320 })

    // 5. Power Dropdown Open - Aurora Light
    console.log('5. Power Dropdown Open (Aurora Light)...')
    await page.goto('http://localhost:4173/?v2=true&theme=light')
    await page.waitForSelector('.app-shell', { timeout: 10000 })
    await sleep(600)
    await page.click('button[aria-label="Power menu"]')
    await page.waitForSelector('.shinpo-power-dropdown', { timeout: 5000 })
    await sleep(300)
    await capture(page, '05_after_power_dropdown_open_light.png', { x: 1100, y: 0, width: 340, height: 320 })

    // 6. Settings Modal Navigation via Account Dropdown (Route Check)
    console.log('6. Open Settings Modal via Account Dropdown "My profile"...')
    await page.goto('http://localhost:4173/?v2=true&theme=dark')
    await page.waitForSelector('.app-shell', { timeout: 10000 })
    await sleep(600)
    await page.click('[data-tutorial="profile-badge-card"]')
    await page.waitForSelector('.shinpo-account-dropdown', { timeout: 5000 })
    await page.click('button:has-text("My profile")')
    await page.waitForSelector('.settings-modal-box', { timeout: 5000 })
    await sleep(400)
    await capture(page, '06_after_settings_account_tab_animated.png')

    // 7. Settings Modal Appearance Tab
    console.log('7. Settings Modal Appearance Tab...')
    await page.click('[data-section="appearance"]')
    await sleep(400)
    await capture(page, '07_after_settings_appearance_tab_animated.png')

    // 8. Settings Modal EONPAI Tab
    console.log('8. Settings Modal EONPAI Tab...')
    await page.click('[data-section="eonpai"]')
    await sleep(400)
    await capture(page, '08_after_settings_eonpai_tab_animated.png')

    // 9. Active Focus Session Protection Confirmation Dialog
    console.log('9. Active Focus Session Protection Confirmation Dialog...')
    await page.keyboard.press('Escape')
    await sleep(300)

    // Unroute and re-route with active session
    await page.unrouteAll({ behavior: 'ignoreErrors' })
    await setupMockRoutes(page, true)

    await page.goto('http://localhost:4173/?v2=true&theme=dark')
    await page.waitForSelector('.app-shell', { timeout: 10000 })
    await sleep(600)

    // Open power menu while session is active
    await page.click('button[aria-label="Power menu"]')
    await page.waitForSelector('.shinpo-power-dropdown', { timeout: 5000 })
    await sleep(250)

    // Click Exit SHINPO
    await page.click('button:has-text("Exit SHINPO")')
    await page.waitForSelector('.confirmation-dialog-overlay', { timeout: 5000 })
    await sleep(400)
    await capture(page, '09_after_focus_active_exit_confirmation_dialog.png')

    // Close dialog
    await page.click('button:has-text("Keep Focusing")')
    await sleep(300)

    await context.close()
    await browser.close()
    console.log('\nAll after verification captures completed successfully!')
  } finally {
    proc.kill('SIGTERM')
  }
}

run().catch((err) => {
  console.error('Error in after capture:', err)
  process.exit(1)
})
