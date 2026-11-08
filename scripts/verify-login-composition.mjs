import { mkdirSync, copyFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium } from '../frontend/node_modules/@playwright/test/index.mjs'

const ROOT = resolve(process.cwd())
const LOCAL_DIR = join(ROOT, 'docs/qa/screenshots/login-composition-repair')
const ARTIFACT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/login-composition-repair'

mkdirSync(LOCAL_DIR, { recursive: true })
mkdirSync(ARTIFACT_DIR, { recursive: true })

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function capture(page, filename) {
  const localPath = join(LOCAL_DIR, filename)
  const artifactPath = join(ARTIFACT_DIR, filename)
  await page.screenshot({ path: localPath })
  copyFileSync(localPath, artifactPath)
  console.log(`  Saved screenshot: ${filename}`)
}

async function run() {
  console.log('=== SHINPO ANIMATED LOGIN CARD COMPOSITION VERIFICATION ===\n')

  const browser = await chromium.launch({ headless: true })

  const themes = [
    { name: 'aurora_dark', url: 'http://localhost:5173/?v2=true&theme=dark' },
    { name: 'aurora_light', url: 'http://localhost:5173/?v2=true&theme=light' },
    { name: 'classic_dark', url: 'http://localhost:5173/?v2=false&theme=dark' },
    { name: 'classic_light', url: 'http://localhost:5173/?v2=false&theme=light' },
  ]

  const viewports = [
    { name: '1920x1080', width: 1920, height: 1080 },
    { name: '1440x900', width: 1440, height: 900 },
    { name: '1280x720', width: 1280, height: 720 },
    { name: '960x600', width: 960, height: 600 },
  ]

  const testReport = {
    assertions: [],
    themeResults: [],
    compositionMetrics: null,
  }

  // 1. Verify 4 Themes across 4 Viewports
  console.log('1. Testing 4 Themes Across 4 Viewports (16 permutations)...')
  for (const theme of themes) {
    for (const vp of viewports) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
      })
      const page = await context.newPage()
      await page.addInitScript(() => {
        sessionStorage.setItem('shinpo_splash_shown', 'true')
      })
      await page.goto(theme.url)
      await page.waitForSelector('.animated-glass-card.auth-card')

      // Validate exact single card count
      const cardCount = await page.evaluate(() => document.querySelectorAll('.auth-card').length)
      if (cardCount !== 1) {
        throw new Error(`Expected exactly 1 .auth-card in ${theme.name} @ ${vp.name}, found ${cardCount}`)
      }

      // Check centering and geometry
      const geometry = await page.evaluate(() => {
        const stage = document.querySelector('.animated-login-stage')
        const tilt = document.querySelector('.animated-card-tilt-wrapper')
        const card = document.querySelector('.animated-glass-card')
        const beams = document.querySelector('.animated-beam-container')
        const sRect = stage.getBoundingClientRect()
        const tRect = tilt.getBoundingClientRect()
        const cRect = card.getBoundingClientRect()
        const bRect = beams.getBoundingClientRect()
        const tStyle = window.getComputedStyle(tilt)
        const cStyle = window.getComputedStyle(card)

        return {
          stage: { x: sRect.x, y: sRect.y, w: sRect.width, h: sRect.height },
          tilt: {
            bg: tStyle.backgroundColor,
            border: tStyle.border,
            padding: tStyle.padding,
            boxShadow: tStyle.boxShadow,
          },
          card: {
            x: cRect.x,
            y: cRect.y,
            w: cRect.width,
            h: cRect.height,
            bg: cStyle.backgroundColor,
            border: cStyle.border,
            padding: cStyle.padding,
            boxShadow: cStyle.boxShadow,
            borderRadius: cStyle.borderRadius,
            backdropFilter: cStyle.backdropFilter || cStyle.webkitBackdropFilter,
          },
          beams: { x: bRect.x, y: bRect.y, w: bRect.width, h: bRect.height },
          viewport: { w: window.innerWidth, h: window.innerHeight },
        }
      })

      // Assertion: Tilt wrapper is purely structural with zero visible styling
      if (geometry.tilt.bg !== 'rgba(0, 0, 0, 0)' && geometry.tilt.bg !== 'transparent') {
        throw new Error(`Tilt wrapper has non-transparent background: ${geometry.tilt.bg}`)
      }
      if (geometry.tilt.padding !== '0px') {
        throw new Error(`Tilt wrapper has non-zero padding: ${geometry.tilt.padding}`)
      }

      // Check card is centered
      const cardCenterHorizontal = geometry.card.x + geometry.card.w / 2
      const viewportCenterHorizontal = geometry.viewport.w / 2
      const hDelta = Math.abs(cardCenterHorizontal - viewportCenterHorizontal)
      if (hDelta > 4) {
        throw new Error(`Card is not horizontally centered! Card center: ${cardCenterHorizontal}, Vp center: ${viewportCenterHorizontal}`)
      }

      // Save screenshot for primary sizes
      if (vp.name === '1440x900' || vp.name === '1920x1080') {
        await capture(page, `login_${theme.name}_${vp.name}.png`)
      }

      await context.close()
    }
    console.log(`  ✓ Theme ${theme.name} passed all 4 viewports`)
  }

  // 2. Comprehensive Interactions & State Tests at 1440x900 Aurora Dark
  console.log('\n2. Testing Comprehensive Interactive Controls & States...')
  {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    })
    const page = await context.newPage()
    await page.addInitScript(() => {
      sessionStorage.setItem('shinpo_splash_shown', 'true')
    })
    await page.goto('http://localhost:5173/?v2=true&theme=dark')
    await page.waitForSelector('.animated-glass-card.auth-card')

    // State A: Default Sign In
    await capture(page, '01_default_signin_mode.png')

    // State B: Input Focus and Typing
    const idInput = page.locator('#auth-identifier')
    await idInput.click()
    await idInput.fill('shinpo_beta_tester')

    const pwInput = page.locator('#auth-password')
    await pwInput.click()
    await pwInput.fill('SuperEncryptedPass2026!')

    // Check input is not clipped
    const idBox = await idInput.boundingBox()
    const pwBox = await pwInput.boundingBox()
    if (!idBox || !pwBox || idBox.width < 250 || pwBox.width < 250) {
      throw new Error('Input fields are clipped or width too narrow!')
    }

    // State C: Password Visibility Toggle
    const toggleBtn = page.locator('.animated-pwd-toggle')
    await toggleBtn.click()
    const pwType = await pwInput.getAttribute('type')
    if (pwType !== 'text') {
      throw new Error(`Expected password type="text" after toggle, got "${pwType}"`)
    }
    await capture(page, '02_password_revealed_interaction.png')

    // State D: Remember Username Checkbox
    const rememberCheckbox = page.locator('#remember-me')
    await rememberCheckbox.click()
    const isChecked = await rememberCheckbox.isChecked()
    if (!isChecked) {
      throw new Error('Remember Me checkbox did not toggle!')
    }
    await capture(page, '03_remember_me_toggled.png')

    // State E: Mode Switching: Create Workspace Mode
    const createWorkspaceTab = page.locator('.animated-tab-btn', { hasText: /create workspace|create account/i })
    await createWorkspaceTab.click()
    await page.waitForSelector('#auth-email')
    const emailInput = page.locator('#auth-email')
    const emailVisible = await emailInput.isVisible()
    if (!emailVisible) {
      throw new Error('Email field is not visible in Create Workspace mode!')
    }
    await capture(page, '04_create_workspace_mode.png')

    // State F: Mode Switching: Forgot Password / Recovery Mode
    const signinTab = page.locator('.animated-tab-btn', { hasText: /sign in/i })
    await signinTab.click()
    await page.waitForTimeout(200)

    const forgotBtn = page.locator('.animated-forgot-btn')
    await forgotBtn.click()
    await page.waitForSelector('#auth-recovery-key')
    const recoveryInput = page.locator('#auth-recovery-key')
    if (!await recoveryInput.isVisible()) {
      throw new Error('Recovery key field is not visible in Recover mode!')
    }
    await capture(page, '05_forgot_password_recovery_mode.png')

    // Return to sign in
    const backBtn = page.locator('.animated-tab-btn', { hasText: /back to sign in/i })
    await backBtn.click()

    // State G: 3D Perspective Tilt on Hover
    const card = page.locator('.animated-glass-card')
    const box = await card.boundingBox()
    await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.15)
    await page.waitForTimeout(250)

    const tiltValues = await page.evaluate(() => {
      const tiltEl = document.querySelector('.animated-card-tilt-wrapper')
      const cardEl = document.querySelector('.animated-glass-card')
      return {
        wrapperTransform: tiltEl.style.transform,
        tiltX: cardEl.style.getPropertyValue('--auth-tilt-x'),
        tiltY: cardEl.style.getPropertyValue('--auth-tilt-y'),
      }
    })
    console.log('  Live 3D Tilt Values:', tiltValues)
    if (!tiltValues.wrapperTransform || tiltValues.wrapperTransform.includes('rotateX(0.00deg) rotateY(0.00deg)')) {
      throw new Error(`3D tilt did not activate on mouse hover: ${JSON.stringify(tiltValues)}`)
    }
    await capture(page, '06_3d_tilt_hover_active.png')

    // Move mouse away: Tilt resets to 0deg
    await page.mouse.move(4, 4)
    await page.waitForTimeout(300)
    const resetTilt = await page.evaluate(() => {
      const cardEl = document.querySelector('.animated-glass-card')
      return cardEl.style.getPropertyValue('--auth-tilt-y')
    })
    if (resetTilt !== '0deg' && resetTilt !== '') {
      throw new Error(`Tilt did not reset to 0deg on mouse leave, got: "${resetTilt}"`)
    }
    console.log('  ✓ 3D tilt resets cleanly to 0deg on mouse leave')

    await context.close()
  }

  // 3. Reduced Motion Test
  console.log('\n3. Testing Reduced Motion Accessibility Mode...')
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
    await page.goto('http://localhost:5173/?v2=true&theme=dark')
    await page.waitForSelector('.animated-glass-card.auth-card')

    const motionStyles = await page.evaluate(() => {
      const stage = document.querySelector('.animated-login-stage')
      const tilt = document.querySelector('.animated-card-tilt-wrapper')
      const card = document.querySelector('.animated-glass-card')
      return {
        stageAnimation: window.getComputedStyle(stage).animationName,
        tiltTransform: window.getComputedStyle(tilt).transform,
        cardAnimation: window.getComputedStyle(card).animationName,
      }
    })
    console.log('  Reduced motion styles:', motionStyles)
    if (motionStyles.stageAnimation !== 'none' || motionStyles.cardAnimation !== 'none') {
      throw new Error('Animations are still running under prefers-reduced-motion: reduce!')
    }
    await capture(page, '07_reduced_motion_mode.png')
    await context.close()
  }

  // 4. Preserved Rollback: Legacy Login Mode (?loginCard=legacy-login)
  console.log('\n4. Testing Preserved Legacy Login Rollback Mode...')
  {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    })
    const page = await context.newPage()
    await page.addInitScript(() => {
      sessionStorage.setItem('shinpo_splash_shown', 'true')
    })
    await page.goto('http://localhost:5173/?v2=true&theme=dark&loginCard=legacy-login')
    await page.waitForSelector('.auth-card')
    const isLegacy = await page.evaluate(() => {
      return !document.querySelector('.animated-glass-card') && !!document.querySelector('.auth-card')
    })
    if (!isLegacy) {
      throw new Error('Legacy rollback mode did not render the preserved legacy card!')
    }
    await capture(page, '08_legacy_card_rollback_mode.png')
    await context.close()
  }

  await browser.close()
  console.log('\n======================================================')
  console.log('ALL VERIFICATION SUITES PASSED WITH ZERO DEFECTS!')
  console.log('======================================================')
}

run().catch((err) => {
  console.error('\nFAILED VERIFICATION:', err)
  process.exit(1)
})
