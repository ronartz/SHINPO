import { spawn } from 'node:child_process'
import { mkdirSync, copyFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium } from '../frontend/node_modules/@playwright/test/index.mjs'

const ROOT = resolve(process.cwd())
const LOCAL_DIR = join(ROOT, 'docs/qa/screenshots/silk-login/baseline')
const ARTIFACT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/silk-login/baseline'

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
  console.log('Starting preview server for login baseline...')
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
      console.log(`  Saved baseline: ${filename}`)
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

    for (const theme of themes) {
      console.log(`Capturing ${theme.name}...`)
      for (const size of sizes) {
        const context = await browser.newContext({
          viewport: { width: size.width, height: size.height },
          deviceScaleFactor: 1,
        })
        const page = await context.newPage()
        await page.addInitScript(() => {
          sessionStorage.setItem('shinpo_splash_shown', 'true') // skip startup splash to capture login directly
        })
        await page.goto(theme.url)
        await page.waitForSelector('.auth-card', { timeout: 10000 })
        await sleep(400)
        await capture(page, `baseline_login_${theme.name}_${size.name}.png`)
        await context.close()
      }
    }

    await browser.close()
    console.log('\nAll login baseline captures completed!')
  } finally {
    proc.kill('SIGTERM')
  }
}

run().catch((err) => {
  console.error('Error in baseline capture:', err)
  process.exit(1)
})
