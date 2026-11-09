import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import path from 'node:path'
import fs from 'node:fs'

const SCREENSHOT_DIR = path.resolve('../docs/qa/screenshots/browser-extension/desktop-settings')
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })

test.describe('Desktop Settings — Browser Companion Rebuilt UI & Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('shinpo_splash_shown', 'true')
      sessionStorage.setItem('shinpo_startup_completed', 'true')
      localStorage.setItem('shinpo_access_token', 'mock_jwt_token_for_visual_qa')
      localStorage.setItem('shinpo_local_vault_account', 'visual_qa_lead')
      localStorage.setItem('shinpo_vault_unlocked', 'true')
      localStorage.setItem('shinpo_tutorial_completed', 'true')
      localStorage.setItem('shinpo_interactive_tutorial_completed', 'true')
      localStorage.setItem('shinpo_interactive_tutorial_dismissed', 'true')
      localStorage.setItem('shinpo_interactive_tutorial_dismissed_1', 'true')
      localStorage.setItem('shinpo_interactive_tutorial_dismissed_user_1', 'true')
      localStorage.setItem('shinpo_interactive_tutorial_completed_1', 'true')
      localStorage.setItem('shinpo_onboarding_dismissed', 'true')
      localStorage.setItem('shinpo_onboarding_dismissed_1', 'true')
      localStorage.setItem('shinpo_auth_user', JSON.stringify({
        id: 1,
        username: 'visual_qa_lead',
        email: 'visual.qa@shinpo.local',
      }))
      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        value: {
          invoke: async (cmd: string) => {
            if (cmd === 'local_vault_status') return { unlocked: true, username: 'visual_qa_lead' }
            if (cmd === 'browser_companion_local_status') return {
              paired: false,
              state: 'STANDBY',
              detail: 'Extension is not yet paired. Generate a 10-minute code below to link your browser.',
            }
            if (cmd === 'browser_companion_pairing_code') return 'SHINPO-8942-F0C8'
            if (cmd === 'browser_companion_revoke') return { ok: true }
            if (cmd === 'get_guardian_status' || cmd === 'local_get_guardian_status') return {
              status: 'READY',
              daemonConnected: true,
              observerStatus: 'ready',
              guardianMode: 'PROTECTED',
              interventionCapability: 'LIMITED_NO_CLOSURE_CONSENT',
              warningOnly: true,
              applicationPolicyStatus: 'LIMITED_NO_CLOSURE_CONSENT',
            }
            return { ok: true }
          },
        },
      })
    })

    await page.route((url: URL) => url.pathname.startsWith('/api/'), async (route: any) => {
      const u = route.request().url()
      if (u.includes('/auth/me')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, username: 'visual_qa_lead' }) })
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    })
  })

  test('Settings Modal: Browser Companion section renders cleanly across all 4 themes', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/?v2=true&theme=dark')
    await page.waitForLoadState('networkidle')

    const skipTutorial = page.getByRole('button', { name: /Skip Tutorial|Skip and close tutorial/i })
    if (await skipTutorial.isVisible({ timeout: 1500 }).catch(() => false)) {
      await skipTutorial.click()
    }

    // Open Settings via Account menu
    const profileBtn = page.getByRole('button', { name: /Account menu/i }).or(page.locator('.profile-badge-card')).first()
    await expect(profileBtn).toBeVisible({ timeout: 10000 })
    await profileBtn.click()

    const allSettingsBtn = page.locator('button:has-text("All settings"), [role="menuitem"]:has-text("All settings")').first()
    await expect(allSettingsBtn).toBeVisible({ timeout: 5000 })
    await allSettingsBtn.click()

    const dialog = page.locator('.settings-modal-dialog, [role="dialog"]').first()
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Switch to Browser Companion tab
    const companionTab = dialog.locator('button:has-text("Browser Companion"), [data-tab="companion"]').first()
    await companionTab.click()

    // Verify Header
    await expect(dialog.locator('.settings-section-title:has-text("Browser Companion")')).toBeVisible()
    await expect(dialog.locator('.companion-header-pill')).toBeVisible()

    // Verify 4 Steps are rendered
    const steps = dialog.locator('.companion-step')
    await expect(steps).toHaveCount(4)

    // Verify Troubleshooting Accordion
    const accordion = dialog.locator('.companion-troubleshooting-accordion')
    await expect(accordion).toBeVisible()

    // Test themes
    const themes = [
      { id: 'aurora-dark', brand: 'aurora', theme: 'dark' },
      { id: 'aurora-light', brand: 'aurora', theme: 'light' },
      { id: 'classic-dark', brand: 'classic', theme: 'dark' },
      { id: 'classic-light', brand: 'classic', theme: 'light' },
    ]

    for (const t of themes) {
      await page.evaluate(({ brand, theme }) => {
        document.documentElement.setAttribute('data-brand', brand)
        document.documentElement.setAttribute('data-theme', theme)
        document.body.className = `theme-${theme} ${brand === 'aurora' ? 'theme-aurora' : ''}`
      }, t)
      await page.waitForTimeout(200)

      const ssPath = path.join(SCREENSHOT_DIR, `desktop-settings-companion-${t.id}.png`)
      await dialog.screenshot({ path: ssPath })

      // Accessibility audit on settings modal
      const a11y = await new AxeBuilder({ page })
        .include('[role="dialog"]')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze()
      const violations = a11y.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
      expect(violations, `A11y violations in theme ${t.id}`).toEqual([])
    }
  })

  test('Settings Modal: Pairing code generation and accordion interaction', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/?v2=true&theme=dark')
    await page.waitForLoadState('networkidle')

    const skipTutorial = page.getByRole('button', { name: /Skip Tutorial|Skip and close tutorial/i })
    if (await skipTutorial.isVisible({ timeout: 1500 }).catch(() => false)) {
      await skipTutorial.click()
    }

    const profileBtn = page.getByRole('button', { name: /Account menu/i }).or(page.locator('.profile-badge-card')).first()
    await expect(profileBtn).toBeVisible({ timeout: 10000 })
    await profileBtn.click()

    const allSettingsBtn = page.locator('button:has-text("All settings"), [role="menuitem"]:has-text("All settings")').first()
    await expect(allSettingsBtn).toBeVisible({ timeout: 5000 })
    await allSettingsBtn.click()

    const dialog = page.locator('.settings-modal-dialog, [role="dialog"]').first()
    await expect(dialog).toBeVisible({ timeout: 5000 })

    await dialog.locator('button:has-text("Browser Companion"), [data-tab="companion"]').first().click()

    // Generate pairing code
    const generateBtn = dialog.locator('button:has-text("Generate 10-minute pairing code")')
    await expect(generateBtn).toBeVisible()
    await generateBtn.click()

    // Verify code display box appears with active code
    const codeDisplay = dialog.locator('.companion-code-display')
    await expect(codeDisplay).toBeVisible()
    await expect(codeDisplay.locator('code')).toHaveText('SHINPO-8942-F0C8')

    // Open accordion
    const accordion = dialog.locator('.companion-troubleshooting-accordion')
    await accordion.locator('summary').click()
    await expect(accordion).toHaveAttribute('open', '')
    await expect(dialog.locator('.companion-developer-area')).toBeVisible()

    // Screenshot pairing state
    await dialog.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop-settings-companion-code-generated.png') })
  })
})
