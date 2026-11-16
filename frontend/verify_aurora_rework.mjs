import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

const EVIDENCE_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/aurora-rework'
mkdirSync(EVIDENCE_DIR, { recursive: true })

const FRONTEND_URL = process.env.SHINPO_URL || 'http://localhost:5173'

console.log('=================================================================')
console.log('SHINPO — AURORA VISUAL IDENTITY REWORK & AUTH BACKDROP VERIFICATION')
console.log(`Evidence Directory: ${EVIDENCE_DIR}`)
console.log(`Frontend URL:       ${FRONTEND_URL}`)
console.log('=================================================================\n')

async function run() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // -------------------------------------------------------------------------
    // 1. AUTH SCREEN VIEWPORTS & OVERFLOW EVIDENCE (1280x720, 1400x900, 1440x900)
    // -------------------------------------------------------------------------
    console.log('--- 1. Testing Auth Overflow & Viewport Geometry ---')
    for (const vp of [
      { width: 1280, height: 720 },
      { width: 1400, height: 900 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(vp)
      await page.goto(`${FRONTEND_URL}/?v2=true&theme=dark`)
      await page.waitForSelector('.auth-card')

      // Measure dimensions
      const metrics = await page.evaluate(() => {
        const doc = document.documentElement
        const body = document.body
        const container = document.querySelector('.auth-fullscreen-container')
        const card = document.querySelector('.auth-card')
        return {
          windowWidth: window.innerWidth,
          windowHeight: window.innerHeight,
          docScrollWidth: doc.scrollWidth,
          docScrollHeight: doc.scrollHeight,
          bodyScrollWidth: body.scrollWidth,
          bodyScrollHeight: body.scrollHeight,
          containerScrollHeight: container?.scrollHeight || 0,
          containerClientHeight: container?.clientHeight || 0,
          cardHeight: card?.getBoundingClientRect().height || 0,
        }
      })

      console.log(`Viewport ${vp.width}x${vp.height}: Card height = ${metrics.cardHeight}px, Doc scrollHeight = ${metrics.docScrollHeight}px`)
      assert.ok(metrics.docScrollHeight <= vp.height, `Doc scrollHeight (${metrics.docScrollHeight}) exceeds viewport height (${vp.height}) at ${vp.width}x${vp.height}`)
      assert.ok(metrics.docScrollWidth <= vp.width, `Doc scrollWidth (${metrics.docScrollWidth}) exceeds viewport width (${vp.width})`)

      // Test wheel scrolling: dispatch wheel scroll down
      await page.mouse.wheel(0, 500)
      await page.waitForTimeout(100)

      const scrollOffsets = await page.evaluate(() => {
        const container = document.querySelector('.auth-fullscreen-container')
        return {
          windowScrollY: window.scrollY,
          docScrollTop: document.documentElement.scrollTop,
          containerScrollTop: container?.scrollTop || 0,
        }
      })
      console.log(`Wheel scroll test: windowScrollY=${scrollOffsets.windowScrollY}, docScrollTop=${scrollOffsets.docScrollTop}, containerScrollTop=${scrollOffsets.containerScrollTop}`)
      assert.equal(scrollOffsets.windowScrollY, 0, 'Page window scrolled unexpectedly on wheel input')
      assert.equal(scrollOffsets.docScrollTop, 0, 'Doc element scrolled unexpectedly on wheel input')
      assert.equal(scrollOffsets.containerScrollTop, 0, 'Container scrolled unexpectedly on wheel input')

      // Save screenshot
      const vpScreenshot = path.join(EVIDENCE_DIR, `08_create_workspace_${vp.width}x${vp.height}.png`)
      await page.screenshot({ path: vpScreenshot })
      console.log(`Saved: ${vpScreenshot}`)
    }

    // -------------------------------------------------------------------------
    // 2. CONSTRAINED VIEWPORT TEST (height 480px)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Constrained Viewport Form Accessibility ---')
    await page.setViewportSize({ width: 1000, height: 480 })
    await page.goto(`${FRONTEND_URL}/?v2=true&theme=dark`)
    await page.waitForSelector('.auth-card')

    const constrainedLayout = await page.evaluate(() => {
      const container = document.querySelector('.auth-fullscreen-container')
      const card = document.querySelector('.auth-card')
      return {
        containerOverflow: getComputedStyle(container).overflowY,
        cardOverflow: getComputedStyle(card).overflowY,
        docScrollHeight: document.documentElement.scrollHeight,
        windowHeight: window.innerHeight,
      }
    })
    console.log('Constrained height 480px:', constrainedLayout)
    assert.equal(constrainedLayout.docScrollHeight, 480, 'Outer doc grew beyond constrained 480px window')
    assert.equal(constrainedLayout.cardOverflow, 'auto', 'Card does not have internal scroll for constrained window')

    // -------------------------------------------------------------------------
    // 3. ANIMATION EVIDENCE: CHANGING PIXELS IN BACKDROP
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing 3D Perspective Warp Animation Motion Evidence ---')
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto(`${FRONTEND_URL}/?v2=true&theme=dark`)
    await page.waitForSelector('.auth-card')

    // Blur focus so cursor does not blink
    await page.evaluate(() => document.activeElement?.blur())

    // Capture frame 1
    const frame1Buffer = await page.screenshot({ clip: { x: 50, y: 50, width: 300, height: 300 } })
    const frame1Path = path.join(EVIDENCE_DIR, '07_signin_animation_frame1.png')
    writeFileSync(frame1Path, frame1Buffer)

    // Wait 2.5 seconds for animation to progress
    await page.waitForTimeout(2500)

    // Capture frame 2 (exact same clip, background only to exclude cursor)
    const frame2Buffer = await page.screenshot({ clip: { x: 50, y: 50, width: 300, height: 300 } })
    const frame2Path = path.join(EVIDENCE_DIR, '07_signin_animation_frame2.png')
    writeFileSync(frame2Path, frame2Buffer)

    // Verify buffer difference (changing pixels in the backdrop)
    let diffPixelCount = 0
    for (let i = 0; i < frame1Buffer.length; i++) {
      if (frame1Buffer[i] !== frame2Buffer[i]) diffPixelCount++
    }
    console.log(`Backdrop animation frame diff byte count: ${diffPixelCount} / ${frame1Buffer.length}`)
    assert.ok(diffPixelCount > 100, `Expected background animation pixels to change, but diff count was ${diffPixelCount}`)
    console.log(`Verified active backdrop movement between frames! (${diffPixelCount} changed bytes)`)

    // Full signin screen screenshot
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '07_signin_animated_background.png') })

    // -------------------------------------------------------------------------
    // 4. THEME COMPARISON & COLOR SYSTEM EVIDENCE (ALL 4 COMBINATIONS)
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing 4 Appearance Combinations ---')

    const userMockScript = () => {
      localStorage.setItem('shinpo_local_vault_account', 'aurora-tester')
      localStorage.setItem(
        'shinpo_auth_user',
        JSON.stringify({ id: 1, username: 'aurora-tester', email: 'aurora@shinpo.local' })
      )
      // Mock minimal Tauri IPC
      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        value: {
          invoke: async (cmd, args) => {
            if (cmd === 'local_vault_status') return { unlocked: true, username: 'aurora-tester' }
            if (cmd === 'get_guardian_status') return { status: 'idle', observerStatus: 'active' }
            if (cmd === 'get_sentinel_rules') return []
            if (cmd === 'get_recent_tamper_events') return []
            if (cmd === 'get_installed_applications' || cmd === 'get_active_application_catalog') return []
            if (cmd === 'list_focus_sessions') return []
            if (cmd === 'list_goals_and_missions') return { goals: [], missions: [] }
            if (cmd === 'get_user_progress') return { level: 1, currentXp: 120, nextLevelXp: 500, earnedMilestones: [] }
            if (cmd === 'get_analytics_dashboard') return null
            return null
          },
        },
      })
    }

    const testThemes = [
      {
        name: 'Classic Dark',
        brand: 'classic',
        theme: 'dark',
        v2: false,
        file: '01_classic_dark_dashboard.png',
        expectedBg: 'rgb(2, 6, 23)', // #020617
        expectedPrimary: '#AFF33E',
      },
      {
        name: 'Classic Light',
        brand: 'classic',
        theme: 'light',
        v2: false,
        file: '02_classic_light_dashboard.png',
        expectedBg: 'rgb(244, 237, 224)', // #F4EDE0
        expectedPrimary: '#4D7C0F',
      },
      {
        name: 'Aurora Dark',
        brand: 'aurora',
        theme: 'dark',
        v2: true,
        file: '03_aurora_dark_dashboard.png',
        expectedBg: 'rgb(11, 15, 25)', // #0B0F19
        expectedPrimary: '#9757FA',
      },
      {
        name: 'Aurora Light',
        brand: 'aurora',
        theme: 'light',
        v2: true,
        file: '04_aurora_light_dashboard.png',
        expectedBg: 'rgb(248, 250, 252)', // #F8FAFC
        expectedPrimary: '#7C3AED',
      },
    ]

    for (const t of testThemes) {
      console.log(`\nValidating: ${t.name}`)
      await page.setViewportSize({ width: 1400, height: 900 })
      await page.addInitScript(userMockScript)
      await page.goto(`${FRONTEND_URL}/?v2=${t.v2}&theme=${t.theme}&tab=Dashboard`)
      await page.waitForTimeout(600)

      const colors = await page.evaluate(() => {
        const root = document.documentElement
        const brand = root.getAttribute('data-brand')
        const theme = root.getAttribute('data-theme')
        const cs = getComputedStyle(root)
        const bg = cs.getPropertyValue('--color-background').trim()
        const primary = cs.getPropertyValue('--color-primary').trim()
        const surface1 = cs.getPropertyValue('--color-surface-1').trim()
        const text = cs.getPropertyValue('--color-text-primary').trim()
        return { brand, theme, bg, primary, surface1, text }
      })

      console.log(`  Colors: brand=${colors.brand}, theme=${colors.theme}, bg=${colors.bg}, primary=${colors.primary}`)
      assert.equal(colors.brand, t.brand, `${t.name}: brand attribute mismatch`)
      assert.equal(colors.theme, t.theme, `${t.name}: theme attribute mismatch`)
      assert.equal(colors.primary.toUpperCase(), t.expectedPrimary.toUpperCase(), `${t.name}: primary color mismatch`)

      const screenshotPath = path.join(EVIDENCE_DIR, t.file)
      await page.screenshot({ path: screenshotPath })
      console.log(`  Saved screenshot: ${screenshotPath}`)
    }

    // -------------------------------------------------------------------------
    // 5. AURORA REWARDS VIEW VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Aurora Rewards View ---')
    for (const theme of ['dark', 'light']) {
      await page.goto(`${FRONTEND_URL}/?v2=true&theme=${theme}&tab=Rewards`)
      await page.waitForTimeout(600)

      const rewardsInfo = await page.evaluate(() => {
        const hero = document.querySelector('.rewards-hero')
        const cs = hero ? getComputedStyle(hero) : null
        const eyebrow = hero?.querySelector('.rewards-eyebrow')
        return {
          heroExists: !!hero,
          heroBg: cs?.background || cs?.backgroundColor,
          heroColor: cs?.color,
          eyebrowColor: eyebrow ? getComputedStyle(eyebrow).color : null,
        }
      })

      console.log(`Rewards ${theme}:`, rewardsInfo)
      assert.ok(rewardsInfo.heroExists, 'Rewards hero not found')

      const rewardsPath = path.join(EVIDENCE_DIR, `05_aurora_rewards_${theme}.png`)
      await page.screenshot({ path: rewardsPath })
      console.log(`Saved screenshot: ${rewardsPath}`)
    }

    // -------------------------------------------------------------------------
    // 6. SETTINGS MODAL THEME NAMING & SWITCHING PERSISTENCE
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Testing Settings Modal Theme Naming & Persistence ---')
    await page.goto(`${FRONTEND_URL}/?v2=true&theme=dark&tab=Dashboard`)
    await page.waitForTimeout(500)

    // Open Settings Modal
    const settingsBtn = page.locator('button[data-tutorial="topbar-settings-btn"], button[aria-label="Settings"]').first()
    await settingsBtn.click()
    await page.waitForSelector('.settings-modal-box')

    // Click Appearance tab in Settings if needed
    const appearanceTab = page.locator('.settings-tab-btn:has-text("Appearance"), button:has-text("Appearance")').first()
    if (await appearanceTab.isVisible()) {
      await appearanceTab.click()
      await page.waitForTimeout(300)
    }

    // Inspect theme options: MUST be "Aurora" and "Classic"
    const themeLabels = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.settings-pill-btn'))
      return buttons.map((b) => b.textContent?.trim() || '').filter(Boolean)
    })
    console.log('Settings theme pill labels:', themeLabels)

    const hasAurora = themeLabels.some((l) => l.includes('Aurora') && !l.includes('V2') && !l.includes('Cinematic'))
    const hasClassic = themeLabels.some((l) => l.includes('Classic') && !l.includes('View'))
    const hasForbiddenLabels = themeLabels.some((l) => l.includes('V2') || l.includes('Cinematic'))

    assert.ok(hasAurora, 'Expected clean "Aurora" label in Settings')
    assert.ok(hasClassic, 'Expected clean "Classic" label in Settings')
    assert.ok(!hasForbiddenLabels, 'Found forbidden V2 or Cinematic label in Settings')
    console.log('Verified Settings theme labels: "Aurora" and "Classic" are present without V2/Cinematic!')

    const settingsScreenshot = path.join(EVIDENCE_DIR, '06_aurora_settings_modal.png')
    await page.screenshot({ path: settingsScreenshot })
    console.log(`Saved screenshot: ${settingsScreenshot}`)

    // Test Theme Switching Sequence:
    // Classic Light -> Aurora Light -> Aurora Dark -> Classic Dark -> Classic Light
    console.log('\n--- Testing Theme Switching Loop & LocalStorage Persistence ---')

    // Switch to Classic
    const classicBtn = page.locator('.settings-pill-btn:has-text("Classic")').first()
    await classicBtn.click()
    await page.waitForTimeout(200)

    // Switch to Light
    const lightBtn = page.locator('.settings-pill-btn:has-text("Light")').first()
    await lightBtn.click()
    await page.waitForTimeout(200)

    let state1 = await page.evaluate(() => ({
      brand: document.documentElement.getAttribute('data-brand'),
      theme: document.documentElement.getAttribute('data-theme'),
      savedBrand: localStorage.getItem('shinpo_v2_preview'),
      savedTheme: localStorage.getItem('shinpo_theme'),
    }))
    console.log('State 1 (Classic Light):', state1)
    assert.equal(state1.brand, 'classic')
    assert.equal(state1.theme, 'light')
    assert.equal(state1.savedBrand, 'false')
    assert.equal(state1.savedTheme, 'light')

    // Switch to Aurora
    const auroraBtn = page.locator('.settings-pill-btn:has-text("Aurora")').first()
    await auroraBtn.click()
    await page.waitForTimeout(200)

    let state2 = await page.evaluate(() => ({
      brand: document.documentElement.getAttribute('data-brand'),
      theme: document.documentElement.getAttribute('data-theme'),
      savedBrand: localStorage.getItem('shinpo_v2_preview'),
      savedTheme: localStorage.getItem('shinpo_theme'),
    }))
    console.log('State 2 (Aurora Light):', state2)
    assert.equal(state2.brand, 'aurora')
    assert.equal(state2.theme, 'light')
    assert.equal(state2.savedBrand, 'true')
    assert.equal(state2.savedTheme, 'light')

    // Switch to Dark
    const darkBtn = page.locator('.settings-pill-btn:has-text("Dark")').first()
    await darkBtn.click()
    await page.waitForTimeout(200)

    let state3 = await page.evaluate(() => ({
      brand: document.documentElement.getAttribute('data-brand'),
      theme: document.documentElement.getAttribute('data-theme'),
      savedBrand: localStorage.getItem('shinpo_v2_preview'),
      savedTheme: localStorage.getItem('shinpo_theme'),
    }))
    console.log('State 3 (Aurora Dark):', state3)
    assert.equal(state3.brand, 'aurora')
    assert.equal(state3.theme, 'dark')
    assert.equal(state3.savedBrand, 'true')
    assert.equal(state3.savedTheme, 'dark')

    // Close settings modal
    const closeBtn = page.locator('.settings-modal-close').first()
    if (await closeBtn.isVisible()) {
      await closeBtn.click()
      await page.waitForTimeout(200)
    }

    // Refresh page (simulating restart) and check persistence
    await page.reload()
    await page.waitForTimeout(500)
    const persistedState = await page.evaluate(() => ({
      brand: document.documentElement.getAttribute('data-brand'),
      theme: document.documentElement.getAttribute('data-theme'),
    }))
    console.log('Persisted state after reload:', persistedState)
    assert.equal(persistedState.brand, 'aurora')
    assert.equal(persistedState.theme, 'dark')
    console.log('Theme persistence verified across reload!')

    // -------------------------------------------------------------------------
    // 7. UNLOCK & RECOVERY VISUAL VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Testing Unlock & Recovery Screens ---')
    const authContext = await browser.newContext()
    const authPage = await authContext.newPage()
    await authPage.setViewportSize({ width: 1400, height: 900 })

    // 7a. Mock local unlock state (existing vault account, but locked)
    await authPage.addInitScript(() => {
      localStorage.setItem('shinpo_local_vault_account', 'recovery-tester')
      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        value: {
          invoke: async (cmd) => {
            if (cmd === 'local_vault_status') return { unlocked: false, username: null }
            return null
          },
        },
      })
    })
    await authPage.goto(`${FRONTEND_URL}/?v2=true&theme=dark`)
    await authPage.waitForSelector('.auth-card')

    const unlockScreenshot = path.join(EVIDENCE_DIR, '09_unlock_workspace.png')
    await authPage.screenshot({ path: unlockScreenshot })
    console.log(`Saved screenshot: ${unlockScreenshot}`)

    // 7b. Click Recover link/tab if available and capture Recovery screen
    const recoverBtn = authPage.locator('button:has-text("Recover"), a:has-text("Recover"), [data-testid="auth-mode-recover"]').first()
    if (await recoverBtn.isVisible()) {
      await recoverBtn.click()
      await authPage.waitForTimeout(300)
      const recoveryScreenshot = path.join(EVIDENCE_DIR, '10_recovery_workspace.png')
      await authPage.screenshot({ path: recoveryScreenshot })
      console.log(`Saved screenshot: ${recoveryScreenshot}`)
    }
    await authContext.close()

    console.log('\n=================================================================')
    console.log('ALL VERIFICATION PHASES COMPLETED AND VERIFIED WITH PROOF!')
    console.log('=================================================================')
  } finally {
    await browser.close()
  }
}

run().catch((err) => {
  console.error('Verification failed:', err)
  process.exit(1)
})
