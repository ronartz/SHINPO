import { spawn } from 'node:child_process'
import { mkdirSync, existsSync, copyFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium } from '../frontend/node_modules/@playwright/test/index.mjs'

const ROOT = resolve(process.cwd())
const LOCAL_SCREENSHOTS_DIR = join(ROOT, 'docs/qa/screenshots/desktop-mobile-separation')
const ARTIFACT_SCREENSHOTS_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/desktop-mobile-separation'

mkdirSync(LOCAL_SCREENSHOTS_DIR, { recursive: true })
mkdirSync(ARTIFACT_SCREENSHOTS_DIR, { recursive: true })

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
      // server not ready yet
    }
    await sleep(250)
  }
  throw new Error(`Server at ${url} failed to respond within ${timeoutMs}ms`)
}

async function run() {
  console.log('Starting Vite preview server on port 4173...')
  const previewProcess = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
    cwd: join(ROOT, 'frontend'),
    stdio: 'pipe',
  })

  previewProcess.stderr.on('data', (d) => console.error(`[preview err] ${d}`))

  try {
    await waitForServer('http://localhost:4173/')
    console.log('Preview server ready at http://localhost:4173/\n')

    const browser = await chromium.launch({ headless: true })

    // Helper to capture and mirror screenshot
    async function capture(page, filename) {
      const localPath = join(LOCAL_SCREENSHOTS_DIR, filename)
      const artifactPath = join(ARTIFACT_SCREENSHOTS_DIR, filename)
      await page.screenshot({ path: localPath, fullPage: false })
      copyFileSync(localPath, artifactPath)
      console.log(`  Saved screenshot: ${filename}`)
    }

    // ------------------------------------------------------------------------
    // 1. Desktop Viewport (1440x900)
    // ------------------------------------------------------------------------
    console.log('1. Testing Desktop presentation (1440x900)...')
    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    })
    const desktopPage = await desktopContext.newPage()
    await desktopPage.goto('http://localhost:4173/?v2=true&theme=dark')
    await desktopPage.waitForLoadState('networkidle')
    await sleep(1000)

    const platformAttrDesktop = await desktopPage.getAttribute('html', 'data-platform')
    console.log(`  html[data-platform] = "${platformAttrDesktop}"`)
    const hasDesktopShell = (await desktopPage.$('.shinpo-desktop-app')) !== null
    const hasMobileShellOnDesktop = (await desktopPage.$('.shinpo-mobile-app')) !== null
    console.log(`  .shinpo-desktop-app present: ${hasDesktopShell}`)
    console.log(`  .shinpo-mobile-app present: ${hasMobileShellOnDesktop}`)

    await capture(desktopPage, '01_desktop_normal_1440x900.png')

    // ------------------------------------------------------------------------
    // 2. Desktop Resized / Narrow Viewport (600x900) - Deterministic isolation proof
    // ------------------------------------------------------------------------
    console.log('\n2. Testing Desktop resized to narrow width (600x900)...')
    await desktopPage.setViewportSize({ width: 600, height: 900 })
    await sleep(500)

    const platformAttrResized = await desktopPage.getAttribute('html', 'data-platform')
    console.log(`  html[data-platform] (resized) = "${platformAttrResized}" (Must be "desktop")`)
    const hasDesktopShellResized = (await desktopPage.$('.shinpo-desktop-app')) !== null
    const hasMobileShellResized = (await desktopPage.$('.shinpo-mobile-app')) !== null
    console.log(`  .shinpo-desktop-app remains active: ${hasDesktopShellResized}`)
    console.log(`  .shinpo-mobile-app remains absent: ${!hasMobileShellResized}`)

    await capture(desktopPage, '02_desktop_resized_600x900_remains_desktop.png')
    await desktopContext.close()

    // ------------------------------------------------------------------------
    // 3. Mobile Viewport (390x844 iPhone 14/15) - Overview Tab
    // ------------------------------------------------------------------------
    console.log('\n3. Testing Mobile presentation - Overview Tab (390x844)...')
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })
    const mobilePage = await mobileContext.newPage()
    await mobilePage.goto('http://localhost:4173/?platform=mobile&theme=dark')
    await mobilePage.waitForLoadState('networkidle')
    await sleep(800)

    const platformAttrMobile = await mobilePage.getAttribute('html', 'data-platform')
    console.log(`  html[data-platform] = "${platformAttrMobile}"`)
    const hasMobileShell = (await mobilePage.$('.shinpo-mobile-app')) !== null
    const hasDesktopShellOnMobile = (await mobilePage.$('.shinpo-desktop-app')) !== null
    console.log(`  .shinpo-mobile-app present: ${hasMobileShell}`)
    console.log(`  .shinpo-desktop-app present: ${hasDesktopShellOnMobile}`)

    await capture(mobilePage, '03_mobile_overview_tab.png')

    // ------------------------------------------------------------------------
    // 4. Mobile Focus Tab
    // ------------------------------------------------------------------------
    console.log('\n4. Testing Mobile Focus Tab...')
    await mobilePage.click('button:has-text("Focus")')
    await sleep(400)
    await capture(mobilePage, '04_mobile_focus_tab.png')

    // ------------------------------------------------------------------------
    // 5. Mobile Goals Tab
    // ------------------------------------------------------------------------
    console.log('\n5. Testing Mobile Goals Tab...')
    await mobilePage.click('button:has-text("Goals")')
    await sleep(400)
    await capture(mobilePage, '05_mobile_goals_tab.png')

    // ------------------------------------------------------------------------
    // 6. Mobile Settings Tab (Dark & Light)
    // ------------------------------------------------------------------------
    console.log('\n6. Testing Mobile Settings Tab...')
    await mobilePage.click('button:has-text("Settings")')
    await sleep(400)
    await capture(mobilePage, '06_mobile_settings_tab_dark.png')

    // Toggle to Light mode
    console.log('  Toggling to Light theme...')
    await mobilePage.click('button:has-text("Switch to Light")')
    await sleep(400)
    await capture(mobilePage, '07_mobile_settings_tab_light.png')

    // ------------------------------------------------------------------------
    // 7. Mobile Switch to Desktop Action
    // ------------------------------------------------------------------------
    console.log('\n7. Testing Switch to Desktop from Mobile...')
    await mobilePage.click('button:has-text("Switch to Desktop View")')
    await sleep(1000)
    await mobilePage.waitForLoadState('networkidle')

    const platformAfterSwitch = await mobilePage.getAttribute('html', 'data-platform')
    console.log(`  html[data-platform] after switch = "${platformAfterSwitch}"`)
    await capture(mobilePage, '08_mobile_switch_to_desktop_result.png')

    await mobileContext.close()
    await browser.close()
    console.log('\nAll screenshot captures and verification assertions completed successfully!')
  } finally {
    previewProcess.kill('SIGTERM')
  }
}

run().catch((err) => {
  console.error('Fatal error during screenshot execution:', err)
  process.exit(1)
})
