import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdirSync } from 'node:fs'

const SCREENSHOTS_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/companion-indicator'

const THEMES = [
  { name: 'Aurora Dark', theme: 'dark', brand: 'aurora', id: 'aurora-dark' },
  { name: 'Aurora Light', theme: 'light', brand: 'aurora', id: 'aurora-light' },
  { name: 'Classic Dark', theme: 'dark', brand: 'classic', id: 'classic-dark' },
  { name: 'Classic Light', theme: 'light', brand: 'classic', id: 'classic-light' },
]

test.describe('Focus Protection Card Click & Browser Companion Indicator Suite', () => {
  test.beforeAll(() => {
    mkdirSync(SCREENSHOTS_DIR, { recursive: true })
  })

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.addInitScript(() => {
      localStorage.setItem('shinpo_local_vault_account', 'qa_local_user')
      localStorage.setItem('shinpo_auth_user', JSON.stringify({ id: 1, username: 'qa_local_user', email: 'qa@shinpo.local' }))
      localStorage.setItem('shinpo_v2_preview', 'true')
      localStorage.setItem('shinpo_onboarding_dismissed', 'true')
      localStorage.setItem('shinpo_onboarding_dismissed_1', 'true')
      localStorage.setItem('shinpo_onboarding_dismissed_user_qa_local_user', 'true')
      sessionStorage.setItem('shinpo_splash_shown', 'true')
      sessionStorage.setItem('shinpo_startup_completed', 'true')
      localStorage.setItem('shinpo_session_v1', JSON.stringify({
        user: { id: 1, username: 'qa_local_user', email: 'qa@shinpo.local' },
        token: 'local-vault-token',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      }))

      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        configurable: true,
        value: {
          invoke: async (command: string) => {
            if (command === 'local_vault_status') {
              return { unlocked: true, username: 'qa_local_user' }
            }
            if (command === 'local_platform_capabilities') {
              return {
                guardian: 'OBSERVE_AND_WARN',
                browserCompanionSupported: true,
              }
            }
            if (command === 'local_get_guardian_status') {
              return {
                status: 'READY',
                activeFocusSessionId: null,
                activeFocusSessionName: null,
                enforcementMode: 'AUDIT_ONLY',
                totalInterceptedToday: 0,
                activePolicyRulesCount: 3,
                tamperEventsCount: 0,
                isPolicyLocked: false,
                recentQuarantines: [],
                lastSweepAt: null,
                daemonConnected: true,
                guardianMode: 'Standard',
                warningOnly: true,
                guardianCapability: 'OBSERVE_AND_WARN',
                browserCompanionSupported: true,
                interventionCapability: 'WARN_ONLY',
              }
            }
            if (command === 'browser_companion_local_status') {
              return { paired: true, state: 'PAIRED', detail: 'Extension is paired with SHINPO.' }
            }
            return null
          },
        },
      })
    })
  })

  for (const t of THEMES) {
    test(`renders and navigates cleanly in theme: ${t.name}`, async ({ page }) => {
      await page.goto('/')
      await page.waitForSelector('.icon-sidebar', { timeout: 10000 })

      // Apply theme
      await page.evaluate(({ theme, brand }) => {
        document.documentElement.setAttribute('data-theme', theme)
        document.documentElement.setAttribute('data-brand', brand)
        if (theme === 'light') {
          document.querySelector('.app-shell')?.classList.add('theme-light')
        } else {
          document.querySelector('.app-shell')?.classList.remove('theme-light')
        }
      }, { theme: t.theme, brand: t.brand })

      await page.waitForTimeout(300)

      // 1. Verify companion row
      const companionRow = page.locator('.protection-companion-row')
      await expect(companionRow).toBeVisible()
      await expect(companionRow).toContainText('Companion Paired')

      // Capture screenshot of sidebar card
      const panel = page.locator('.sidebar-protection-panel')
      await panel.screenshot({ path: `${SCREENSHOTS_DIR}/sidebar_card_${t.id}.png` })

      // Accessibility audit on sidebar protection panel
      const results = await new AxeBuilder({ page })
        .include('.sidebar-protection-panel')
        .analyze()

      const contrastIssues = results.violations.filter(v => v.id === 'color-contrast')
      expect(contrastIssues).toEqual([])

      // 2. Click button directly
      const viewBtn = page.locator('.protection-view-btn')
      await viewBtn.click()
      await page.waitForTimeout(300)
      await expect(page.locator('.task-manager-view')).toBeVisible()

      // 3. Return to Dashboard
      await page.locator('.sidebar-btn[data-tab="Dashboard"]').click()
      await page.waitForTimeout(200)

      // 4. Click whole card surface
      await page.locator('.sidebar-protection-panel').click()
      await page.waitForTimeout(300)
      await expect(page.locator('.task-manager-view')).toBeVisible()
    })
  }
})
