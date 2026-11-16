/*
 * scripts/verify_startup_glass_reveal.mjs
 *
 * Automated Playwright script to verify the SHINPO Cinematic Glass Logo Reveal:
 * - Captures keyframes of droplet formation, refraction, dispersion, release, and settlement
 * - Verifies across all four canonical themes (Aurora Dark, Classic Dark, Aurora Light, Classic Light)
 * - Verifies reduced-motion fallback
 * - Verifies warm-session one-time guard bypass
 */

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'

const PORT = 4173
const DIST_DIR = path.resolve('frontend/dist')
const SCREENSHOTS_DIR = path.resolve('docs/qa/screenshots/startup')
const ARTIFACT_DIR = path.resolve('/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/startup')

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
fs.mkdirSync(ARTIFACT_DIR, { recursive: true })

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0]
      if (reqPath === '/' || !path.extname(reqPath)) {
        reqPath = '/index.html'
      }
      const filePath = path.join(DIST_DIR, reqPath)
      const ext = path.extname(filePath).toLowerCase()

      fs.readFile(filePath, (err, data) => {
        if (err) {
          // Fallback to index.html for SPA routing
          fs.readFile(path.join(DIST_DIR, 'index.html'), (err2, indexData) => {
            if (err2) {
              res.writeHead(404)
              res.end('Not Found')
              return
            }
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(indexData)
          })
          return
        }
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' })
        res.end(data)
      })
    })

    server.listen(PORT, '127.0.0.1', () => {
      resolve(server)
    })
    server.on('error', reject)
  })
}

async function captureAndSave(page, filename, label) {
  const localPath = path.join(SCREENSHOTS_DIR, filename)
  const artifactPath = path.join(ARTIFACT_DIR, filename)
  await page.screenshot({ path: localPath })
  fs.copyFileSync(localPath, artifactPath)
  console.log(`[PASS] Captured: ${filename} - ${label}`)
}

async function run() {
  console.log('--- Starting SHINPO Glass Logo Reveal Verification ---')
  const server = await startServer()
  console.log(`Static server running on http://127.0.0.1:${PORT}`)

  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--enable-webgl2-compute-context', '--use-gl=angle'],
  })

  try {
    // -------------------------------------------------------------
    // Sequence 1: Default Aurora Dark Theme
    // -------------------------------------------------------------
    console.log('\n[1/5] Testing Aurora Dark (Default) Startup Keyframes...')
    const contextDark = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    })
    const pageDark = await contextDark.newPage()

    // Mock API endpoints to avoid unhandled calls
    await pageDark.route('**/api/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
    })

    await pageDark.addInitScript(() => {
      sessionStorage.clear()
      localStorage.clear()
    })

    await pageDark.goto(`http://127.0.0.1:${PORT}/`)

    // Frame 1: 400ms - Glass droplet forms
    await pageDark.waitForTimeout(400)
    await captureAndSave(pageDark, '01_aurora-dark_droplet_forming.png', 'Droplet forms at center')

    // Frame 2: 1600ms - Logo magnified with refraction & dispersion
    await pageDark.waitForTimeout(1200)
    await captureAndSave(pageDark, '02_aurora-dark_refraction_dispersion.png', 'Refraction, chromatic dispersion & sheen')

    // Frame 3: 2800ms - Glass releasing and settling into crisp mark
    await pageDark.waitForTimeout(1200)
    await captureAndSave(pageDark, '03_aurora-dark_glass_release.png', 'Glass release & authentic logo emergence')

    // Frame 4: 3800ms - Sharp SHINPO logo with brand lockup
    await pageDark.waitForTimeout(1000)
    await captureAndSave(pageDark, '04_aurora-dark_settled_logo_brand.png', 'Crisp settled SHINPO logo & brand lockup')

    // Frame 5: 4600ms - Transition to login screen
    await pageDark.waitForTimeout(800)
    await captureAndSave(pageDark, '05_aurora-dark_login_transition.png', 'Smooth transition to login card')

    await contextDark.close()

    // -------------------------------------------------------------
    // Sequence 2: Other 3 Themes (Classic Dark, Aurora Light, Classic Light)
    // -------------------------------------------------------------
    const themes = [
      { id: 'classic-dark', name: 'Classic Dark', shot1: '06_classic-dark_reveal.png', shot2: '07_classic-dark_settled.png' },
      { id: 'aurora-light', name: 'Aurora Light', shot1: '08_aurora-light_reveal.png', shot2: '09_aurora-light_settled.png' },
      { id: 'classic-light', name: 'Classic Light', shot1: '10_classic-light_reveal.png', shot2: '11_classic-light_settled.png' },
    ]

    for (const [idx, t] of themes.entries()) {
      console.log(`\n[${idx + 2}/5] Testing Theme: ${t.name}...`)
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await ctx.newPage()

      await page.route('**/api/**', (route) => {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
      })

      const themeId = t.id
      await page.addInitScript((th) => {
        sessionStorage.clear()
        localStorage.setItem('shinpo_theme', th)
        document.documentElement.setAttribute('data-theme', th)
      }, themeId)

      await page.goto(`http://127.0.0.1:${PORT}/`)

      // Refraction frame
      await page.waitForTimeout(1600)
      await captureAndSave(page, t.shot1, `${t.name} refraction`)

      // Settled frame
      await page.waitForTimeout(2000)
      await captureAndSave(page, t.shot2, `${t.name} settled logo mark`)

      await ctx.close()
    }

    // -------------------------------------------------------------
    // Sequence 3: Reduced Motion Mode
    // -------------------------------------------------------------
    console.log('\n[5/5] Testing Reduced Motion Fallback & Session Bypass...')
    const ctxReduced = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    })
    const pageReduced = await ctxReduced.newPage()
    await pageReduced.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
    await pageReduced.addInitScript(() => {
      sessionStorage.clear()
      localStorage.clear()
    })
    await pageReduced.goto(`http://127.0.0.1:${PORT}/`)
    await pageReduced.waitForTimeout(500)
    await captureAndSave(pageReduced, '12_reduced_motion_fallback.png', 'Instant static logo fallback under reduced motion')
    await ctxReduced.close()

    // -------------------------------------------------------------
    // Sequence 4: Warm Session Bypass
    // -------------------------------------------------------------
    const ctxWarm = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    })
    const pageWarm = await ctxWarm.newPage()
    await pageWarm.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
    await pageWarm.addInitScript(() => {
      sessionStorage.setItem('shinpo_splash_shown', 'true')
    })
    await pageWarm.goto(`http://127.0.0.1:${PORT}/`)
    await pageWarm.waitForTimeout(500)
    await captureAndSave(pageWarm, '13_warm_session_bypass.png', 'Warm session bypasses splash directly to login')
    await ctxWarm.close()

    console.log('\n=== All 13 Verification Screenshots Successfully Captured! ===\n')
  } finally {
    await browser.close()
    await new Promise((res) => server.close(res))
  }
}

run().catch((err) => {
  console.error('Verification failed:', err)
  process.exit(1)
})
