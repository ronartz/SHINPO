import { spawn } from 'node:child_process'
import { copyFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium } from '../frontend/node_modules/@playwright/test/index.mjs'

const ROOT = resolve(process.cwd())
const LOCAL_DIR = join(ROOT, 'docs/qa/screenshots/visual-craft-density/startup')
const ARTIFACT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/visual-craft-density/startup'

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

async function run() {
  const proc = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
    cwd: join(ROOT, 'frontend'),
    stdio: 'pipe',
  })

  try {
    await waitForServer('http://localhost:4173/')
    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    })
    const page = await context.newPage()

    // Ensure session storage is empty so splash displays
    await page.addInitScript(() => {
      sessionStorage.clear()
    })

    // Capture startup frame at ~400ms (emblem formation & orbital motion)
    await page.goto('http://localhost:4173/')
    await sleep(400)
    const local1 = join(LOCAL_DIR, '01_startup_emblem_formation.png')
    const art1 = join(ARTIFACT_DIR, '01_startup_emblem_formation.png')
    await page.screenshot({ path: local1 })
    copyFileSync(local1, art1)
    console.log('Saved: 01_startup_emblem_formation.png')

    // Capture startup frame at ~1000ms (wordmark and progress bar)
    await sleep(600)
    const local2 = join(LOCAL_DIR, '02_startup_wordmark_progress.png')
    const art2 = join(ARTIFACT_DIR, '02_startup_wordmark_progress.png')
    await page.screenshot({ path: local2 })
    copyFileSync(local2, art2)
    console.log('Saved: 02_startup_wordmark_progress.png')

    // Wait for exit transition into login
    await page.waitForSelector('.auth-card', { timeout: 10000 })
    await sleep(400)
    const local3 = join(LOCAL_DIR, '03_startup_handoff_to_login.png')
    const art3 = join(ARTIFACT_DIR, '03_startup_handoff_to_login.png')
    await page.screenshot({ path: local3 })
    copyFileSync(local3, art3)
    console.log('Saved: 03_startup_handoff_to_login.png')

    await context.close()
    await browser.close()
    console.log('Startup animation captures complete!')
  } finally {
    proc.kill('SIGTERM')
  }
}

run().catch((err) => {
  console.error('Error in startup capture:', err)
  process.exit(1)
})
