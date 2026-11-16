import { spawn } from 'node:child_process'
import { mkdirSync, copyFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium } from '../frontend/node_modules/@playwright/test/index.mjs'

const ROOT = resolve(process.cwd())
const LOCAL_DIR = join(ROOT, 'docs/qa/screenshots/animated-login')
const ARTIFACT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/animated-login'

mkdirSync(LOCAL_DIR, { recursive: true })
mkdirSync(ARTIFACT_DIR, { recursive: true })

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
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

async function run() {
  console.log('Starting preview server for animated login verification...')
  const proc = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
    cwd: join(ROOT, 'frontend'),
    stdio: 'pipe',
  })

  try {
    await waitForServer('http://localhost:4173/')
    console.log('Preview server ready at http://localhost:4173/\n')

    const browser = await chromium.launch({ headless: true })

    async function capture(page, filename) {
      const localPath = join(LOCAL_DIR, filename)
      const artifactPath = join(ARTIFACT_DIR, filename)
      await page.screenshot({ path: localPath })
      copyFileSync(localPath, artifactPath)
      console.log(`  Saved: ${filename}`)
    }

    const themes = [
      { name: 'aurora_dark', url: 'http://localhost:4173/?v2=true&theme=dark' },
      { name: 'aurora_light', url: 'http://localhost:4173/?v2=true&theme=light' },
      { name: 'classic_dark', url: 'http://localhost:4173/?v2=false&theme=dark' },
      { name: 'classic_light', url: 'http://localhost:4173/?v2=false&theme=light' },
    ]

    const sizes = [
      { name: '1440x900', width: 1440, height: 900 },
      { name: '1280x720', width: 1280, height: 720 },
      { name: '960x600', width: 960, height: 600 },
      { name: '1920x1080', width: 1920, height: 1080 },
    ]

    // 1. Capture 4 themes across 4 viewports
    console.log('=== Step 1: Capturing 4 Themes Across 4 Viewports ===')
    for (const theme of themes) {
      console.log(`Capturing theme: ${theme.name}...`)
      for (const size of sizes) {
        const context = await browser.newContext({
          viewport: { width: size.width, height: size.height },
          deviceScaleFactor: 1,
        })
        const page = await context.newPage()
        await page.addInitScript(() => {
          sessionStorage.setItem('shinpo_splash_shown', 'true')
        })
        await page.goto(theme.url)
        await page.waitForSelector('.animated-login-stage', { timeout: 10000 })
        await page.waitForSelector('.shinpo-silk-canvas', { timeout: 10000 })
        await sleep(400)
        await capture(page, `animated_login_${theme.name}_${size.name}.png`)
        await context.close()
      }
    }

    // 2. Interactive Form State: Filled inputs, password toggled, remember me
    console.log('\n=== Step 2: Capturing Interactive Filled & Focus State ===')
    {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
      })
      const page = await context.newPage()
      await page.addInitScript(() => {
        sessionStorage.setItem('shinpo_splash_shown', 'true')
      })
      await page.goto('http://localhost:4173/?v2=true&theme=dark')
      await page.waitForSelector('.animated-login-stage', { timeout: 10000 })

      const idInput = page.locator('#auth-identifier')
      await idInput.click()
      await idInput.fill('ronartz')

      const pwInput = page.locator('#auth-password')
      await pwInput.click()
      await pwInput.fill('ProtectedMasterVault2026!')

      // Toggle remember me checkbox
      const rememberCheckbox = page.locator('.animated-checkbox-btn')
      if (await rememberCheckbox.isVisible()) {
        await rememberCheckbox.click()
      }

      // Toggle show password
      const pwToggle = page.locator('.animated-password-toggle')
      if (await pwToggle.isVisible()) {
        await pwToggle.click()
      }

      await sleep(300)
      await capture(page, 'animated_login_filled_1440x900.png')
      await context.close()
    }

    // 3. 3D Hover Tilt Simulation
    console.log('\n=== Step 3: Capturing 3D Hover Tilt State ===')
    {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
      })
      const page = await context.newPage()
      await page.addInitScript(() => {
        sessionStorage.setItem('shinpo_splash_shown', 'true')
      })
      await page.goto('http://localhost:4173/?v2=true&theme=dark')
      await page.waitForSelector('.animated-card-tilt-wrapper', { timeout: 10000 })

      // Hover over corner of card to trigger perspective 3D tilt
      const card = page.locator('.animated-card-tilt-wrapper')
      const box = await card.boundingBox()
      if (box) {
        await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.15)
        await sleep(300)
      }
      await capture(page, 'animated_login_tilt_3d_1440x900.png')
      await context.close()
    }

    // 4. Reduced Motion Mode
    console.log('\n=== Step 4: Capturing Reduced Motion Mode ===')
    {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
        reducedMotion: 'reduce',
      })
      const page = await context.newPage()
      await page.addInitScript(() => {
        sessionStorage.setItem('shinpo_splash_shown', 'true')
      })
      await page.goto('http://localhost:4173/?v2=true&theme=dark')
      await page.waitForSelector('.animated-login-stage', { timeout: 10000 })
      await sleep(300)
      await capture(page, 'animated_login_reduced_motion_1440x900.png')
      await context.close()
    }

    // 5. Preserved Rollback: Legacy Login Card (?loginCard=legacy-login)
    console.log('\n=== Step 5: Capturing Preserved Legacy Card Rollback ===')
    {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
      })
      const page = await context.newPage()
      await page.addInitScript(() => {
        sessionStorage.setItem('shinpo_splash_shown', 'true')
      })
      await page.goto('http://localhost:4173/?v2=true&theme=dark&loginCard=legacy-login')
      await page.waitForSelector('.auth-card', { timeout: 10000 })
      await sleep(300)
      await capture(page, 'rollback_login_card_legacy_1440x900.png')
      console.log('  Confirmed: legacy login card rendered cleanly via ?loginCard=legacy-login!')
      await context.close()
    }

    // 6. Full Legacy Rollback: Legacy Card + Legacy Warp Background
    console.log('\n=== Step 6: Capturing Full Legacy Rollback ===')
    {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
      })
      const page = await context.newPage()
      await page.addInitScript(() => {
        sessionStorage.setItem('shinpo_splash_shown', 'true')
      })
      await page.goto('http://localhost:4173/?v2=true&theme=dark&loginCard=legacy-login&loginBg=legacy-warp')
      await page.waitForSelector('.auth-card', { timeout: 10000 })
      await page.waitForSelector('.auth-warp', { timeout: 10000 })
      await sleep(300)
      await capture(page, 'rollback_login_full_legacy_1440x900.png')
      console.log('  Confirmed: full legacy stack (card + warp) rendered cleanly!')
      await context.close()
    }

    await browser.close()
    console.log('\nAll animated login review captures completed successfully!')
  } finally {
    proc.kill('SIGTERM')
  }
}

run().catch((err) => {
  console.error('Error during animated login captures:', err)
  process.exit(1)
})
