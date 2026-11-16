import { test, expect } from '@playwright/test'
import path from 'node:path'
import { mkdirSync } from 'node:fs'

const SCREENSHOT_DIR = path.resolve(process.cwd(), '../docs/qa/screenshots/login-brand-identity')
mkdirSync(SCREENSHOT_DIR, { recursive: true })

const injectAuthMocks = async (page: any) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('shinpo_splash_shown', 'true')
    localStorage.removeItem('shinpo_vault_unlocked')
    localStorage.removeItem('shinpo_access_token')
    localStorage.setItem('shinpo_local_vault_account', 'review-user')
    localStorage.setItem(
      'shinpo_auth_user',
      JSON.stringify({ id: 1, username: 'review-user', email: 'review-user@local.shinpo' })
    )
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      value: {
        invoke: async (command: string) => {
          if (command === 'local_vault_status') {
            return { unlocked: false, username: null }
          }
          if (command === 'local_get_onboarding_state') {
            return { status: 'COMPLETED', currentStep: 6 }
          }
          return null
        },
      },
    })
  })
}

test.describe('SHINPO Login Brand Identity Refinement', () => {
  const themes = [
    { brand: 'aurora', isV2: 'true', theme: 'dark', label: 'Aurora Dark' },
    { brand: 'aurora', isV2: 'true', theme: 'light', label: 'Aurora Light' },
    { brand: 'classic', isV2: 'false', theme: 'dark', label: 'Classic Dark' },
    { brand: 'classic', isV2: 'false', theme: 'light', label: 'Classic Light' },
  ]

  for (const t of themes) {
    test(`Brand lockup in ${t.label} matches requirements with Ubuntu typography and no circular badge`, async ({ page }) => {
      await injectAuthMocks(page)
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(`/?v2=${t.isV2}&theme=${t.theme}`)
      await page.waitForLoadState('networkidle')

      const card = page.locator('.auth-card')
      await expect(card).toBeVisible({ timeout: 5000 })

      // 1. Verify old circular badge is gone or hidden
      const circularBadge = page.locator('.animated-logo-badge')
      if (await circularBadge.count() > 0) {
        const isBadgeVisible = await circularBadge.first().isVisible()
        expect(isBadgeVisible, 'Circular badge must NOT be visible').toBe(false)
      }

      // 2. Verify new brand lockup exists
      const brandLockup = page.locator('.auth-brand-lockup')
      await expect(brandLockup).toBeVisible()

      // 3. Inspect computed dimensions and typography of lockup
      const audit = await brandLockup.evaluate((el) => {
        const symbol = el.querySelector('.auth-brand-lockup__symbol svg, .auth-brand-lockup__symbol image') as HTMLElement | null
        const wordmark = el.querySelector('.auth-brand-lockup__wordmark') as HTMLElement | null
        const kanji = el.querySelector('.auth-brand-lockup__kanji') as HTMLElement | null
        const descriptor = el.querySelector('.auth-brand-lockup__descriptor') as HTMLElement | null
        const heading = document.querySelector('.animated-card-title') as HTMLElement | null

        const lockupRect = el.getBoundingClientRect()
        const headingRect = heading ? heading.getBoundingClientRect() : null

        const wordmarkStyle = wordmark ? window.getComputedStyle(wordmark) : null
        const kanjiStyle = kanji ? window.getComputedStyle(kanji) : null
        const descriptorStyle = descriptor ? window.getComputedStyle(descriptor) : null

        return {
          symbolWidth: symbol ? symbol.getBoundingClientRect().width : 0,
          symbolHeight: symbol ? symbol.getBoundingClientRect().height : 0,
          wordmarkText: wordmark?.textContent?.trim() || '',
          wordmarkFontSize: wordmarkStyle?.fontSize || '',
          wordmarkFontWeight: wordmarkStyle?.fontWeight || '',
          wordmarkFontFamily: wordmarkStyle?.fontFamily || '',
          wordmarkColor: wordmarkStyle?.color || '',
          kanjiText: kanji?.textContent?.trim() || '',
          descriptorText: descriptor?.textContent?.trim() || '',
          isAboveHeading: headingRect ? lockupRect.bottom <= headingRect.top : false,
          gapToHeading: headingRect ? headingRect.top - lockupRect.bottom : 0,
        }
      })

      // Symbol must be in ~38-44px range
      expect(audit.symbolWidth).toBeGreaterThanOrEqual(36)
      expect(audit.symbolWidth).toBeLessThanOrEqual(46)
      expect(audit.symbolHeight).toBeGreaterThanOrEqual(36)
      expect(audit.symbolHeight).toBeLessThanOrEqual(46)

      // Wordmark must be SHINPO, ~22-24px, semibold/bold (>=600), Ubuntu font
      expect(audit.wordmarkText).toBe('SHINPO')
      const wordmarkPx = parseFloat(audit.wordmarkFontSize)
      expect(wordmarkPx).toBeGreaterThanOrEqual(21)
      expect(wordmarkPx).toBeLessThanOrEqual(25)
      expect(parseInt(audit.wordmarkFontWeight, 10)).toBeGreaterThanOrEqual(600)
      expect(audit.wordmarkFontFamily.toLowerCase()).toContain('ubuntu')

      // Kanji and descriptor must be present and legible
      expect(audit.kanjiText).toBe('進歩')
      expect(audit.descriptorText).toBe('Progress')

      // Positioned deliberately ABOVE the heading
      expect(audit.isAboveHeading).toBe(true)
      expect(audit.gapToHeading).toBeGreaterThanOrEqual(10)

      // Capture screenshot for QA review
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `login-lockup-${t.brand}-${t.theme}.png`),
        fullPage: false,
      })
    })
  }

  const viewports = [
    { width: 1920, height: 1080, name: 'desktop-1080p' },
    { width: 768, height: 1024, name: 'tablet' },
    { width: 390, height: 844, name: 'mobile-iphone' },
  ]

  for (const vp of viewports) {
    test(`Responsive Viewport Check: ${vp.name} maintains centered lockup without overflow`, async ({ page }) => {
      await injectAuthMocks(page)
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/?v2=true&theme=dark')
      await page.waitForLoadState('networkidle')

      const card = page.locator('.auth-card')
      await expect(card).toBeVisible({ timeout: 5000 })

      const lockup = page.locator('.auth-brand-lockup')
      await expect(lockup).toBeVisible()

      // Check no horizontal overflow
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 2
      })
      expect(overflow, `Horizontal overflow at viewport ${vp.name}`).toBe(false)

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `responsive-lockup-${vp.name}.png`),
      })
    })
  }
})
