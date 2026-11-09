import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import path from 'node:path'
import { mkdirSync } from 'node:fs'

const MOCK_LOCAL_APPS = [
  {
    id: 'code.desktop',
    name: 'Visual Studio Code',
    platform: 'linux',
    source: 'system',
    icon: 'vscode',
    execName: 'code',
    isRunning: true,
    policy: 'NONE',
    enforcementCapability: 'TERMINATE',
    unsupportedReason: null,
  },
  {
    id: 'discord.desktop',
    name: 'Discord Chat',
    platform: 'linux',
    source: 'system',
    icon: 'discord',
    execName: 'discord',
    isRunning: false,
    policy: 'BLOCKED',
    enforcementCapability: 'TERMINATE',
    unsupportedReason: null,
  },
  {
    id: 'firefox.desktop',
    name: 'Firefox Web Browser',
    platform: 'linux',
    source: 'system',
    icon: 'firefox',
    execName: 'firefox',
    isRunning: true,
    policy: 'ALLOWED',
    enforcementCapability: 'TERMINATE',
    unsupportedReason: null,
  },
  {
    id: 'systemd.desktop',
    name: 'System Daemon',
    platform: 'linux',
    source: 'system',
    icon: 'systemd',
    execName: 'systemd',
    isRunning: true,
    policy: 'NONE',
    enforcementCapability: 'UNSUPPORTED',
    unsupportedReason: 'Protected system application',
  },
]

const MOCK_LOCAL_STATUS = {
  status: 'READY',
  activeFocusSessionId: null,
  activeFocusSessionName: null,
  guardianMode: 'PROTECTED',
  focusPhase: null,
  observationsToday: 1,
  lastObservationAt: new Date().toISOString(),
  appCatalogVersion: 'guardian-apps-v1',
  domainCatalogVersion: 'guardian-domains-v1',
  warningOnly: false,
  interventionCapability: 'LIMITED_NO_CLOSURE_CONSENT',
  standardAllowanceSeconds: 600,
  observerStatus: 'MONITORING',
  applicationPolicyStatus: 'LIMITED_NO_CLOSURE_CONSENT',
  guardianApplicationCatalog: [
    { processName: 'discord', category: 'COMMUNICATION', rationale: 'Game and social chat platform' },
    { processName: 'steam', category: 'GAMING', rationale: 'Game launcher and store' },
  ],
  applicationCatalog: [
    { processName: 'discord', category: 'COMMUNICATION', rationale: 'Game and social chat platform' },
    { processName: 'steam', category: 'GAMING', rationale: 'Game launcher and store' },
  ],
  guardianObservations: [
    {
      id: 1,
      sessionId: 101,
      pid: 4123,
      processName: 'discord',
      catalogVersion: 'guardian-apps-v1',
      category: 'COMMUNICATION',
      rationale: 'Game and social chat platform',
      guardianMode: 'PROTECTED',
      focusPhase: 'FOCUS',
      outcome: 'WARNING_LIGHT',
      observedAt: new Date().toISOString(),
    },
  ],
}

test.describe('Focus Protection - Installed App Discovery & Policy Management', () => {
  test('discovers installed apps, filters, toggles policy, and passes WCAG AA audit', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chrome')

    // 1. Mock local vault mode in localStorage and Tauri internals bridge
    await page.addInitScript(({ mockApps, mockStatus }) => {
      localStorage.setItem('shinpo_local_vault_account', 'qa_local_user')
      localStorage.setItem('shinpo_auth_user', JSON.stringify({ id: 1, username: 'qa_local_user', email: 'qa@shinpo.local' }))
      localStorage.setItem('shinpo_v2_preview', 'true')
      localStorage.setItem('shinpo_onboarding_dismissed', 'true')
      localStorage.setItem('shinpo_onboarding_dismissed_1', 'true')
      localStorage.setItem('shinpo_session_v1', JSON.stringify({
        user: { id: 1, username: 'qa_local_user', email: 'qa@shinpo.local' },
        token: 'local-vault-token',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      }))

      const currentApps = JSON.parse(JSON.stringify(mockApps))

      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        configurable: true,
        value: {
          invoke: async (command: string, args?: any) => {
            if (command === 'local_vault_status') {
              return { unlocked: true, username: 'qa_local_user' }
            }
            if (command === 'local_platform_capabilities') {
              return {
                guardian: 'OBSERVE_AND_WARN',
                browserCompanionSupported: true,
              }
            }
            if (command === 'local_get_guardian_preferences') {
              return {
                preferredMode: 'PROTECTED',
                appMonitoringConsent: true,
                applyToNewSessions: true,
                closureConsent: true,
                backgroundRuntimeConsent: false,
              }
            }
            if (command === 'local_get_goals') return []
            if (command === 'local_get_tasks') return []
            if (command === 'local_get_sessions') return []
            if (command === 'local_get_progress') {
              return {
                userId: 1,
                totalXp: 100,
                level: 1,
                currentLevelXp: 10,
                nextLevelThreshold: 100,
                nextLevelXp: 100,
                progressPercent: 10,
                streakDays: 1,
                recentEvents: [],
              }
            }
            if (command === 'local_get_onboarding_state') {
              return { status: 'COMPLETED', completed: true, currentStep: 0, stepsCompleted: [] }
            }
            if (command === 'local_get_guardian_status') {
              return mockStatus
            }
            if (command === 'local_get_discovered_apps') {
              return currentApps
            }
            if (command === 'local_save_app_policy') {
              const req = args?.request
              const found = currentApps.find((a: any) => a.id === req.appId)
              if (found) {
                found.policy = req.policyType
              }
              return {
                id: 99,
                appId: req.appId,
                appName: req.appName,
                execName: req.execName,
                policyType: req.policyType,
                source: 'system',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
            }
            if (command === 'local_remove_app_policy') {
              const found = currentApps.find((a: any) => a.id === args?.appId)
              if (found) {
                found.policy = 'NONE'
              }
              return undefined
            }
            if (command === 'local_get_guardian_observations') {
              return mockStatus.guardianObservations
            }
            if (command === 'local_get_app_policies') {
              return currentApps
                .filter((a: any) => a.policy !== 'NONE')
                .map((a: any, i: number) => ({
                  id: i + 1,
                  appId: a.id,
                  appName: a.name,
                  execName: a.execName,
                  policyType: a.policy,
                  source: a.source,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                }))
            }
            return null
          },
        },
      })
    }, { mockApps: MOCK_LOCAL_APPS, mockStatus: MOCK_LOCAL_STATUS })

    // Set stable desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 })

    // Navigate to root with tab=Task Manager
    await page.goto('/?tab=Task%20Manager&v2=true&theme=dark')
    await expect(page.locator('.app-shell')).toBeVisible({ timeout: 15000 })

    // 2. Verify header & Guardian beta status
    await expect(page.locator('#guardian-alpha-title')).toHaveText('Guardian beta')
    await expect(page.locator('#guardian-apps-title')).toHaveText('Installed Applications')

    // 3. Verify discovered apps list renders
    const appList = page.locator('.guardian-app-list')
    await expect(appList).toBeVisible()
    await expect(page.locator('.guardian-app-item')).toHaveCount(4)

    // Verify running badge
    await expect(page.locator('.badge-running').first()).toBeVisible()

    // Verify protected system app has protected label instead of policy buttons
    await expect(page.locator('.guardian-app-protected-label')).toBeVisible()

    // 4. Test search filtering
    const searchInput = page.locator('.guardian-app-search-box input')
    await searchInput.fill('Visual')
    await expect(page.locator('.guardian-app-item')).toHaveCount(1)
    await expect(page.locator('.guardian-app-item strong')).toHaveText('Visual Studio Code')

    await searchInput.fill('')
    await expect(page.locator('.guardian-app-item')).toHaveCount(4)

    // 5. Test filter tabs
    const blockedTab = page.getByRole('tab', { name: /^Blocked/ })
    await blockedTab.click()
    await expect(page.locator('.guardian-app-item')).toHaveCount(1)
    await expect(page.locator('.guardian-app-item strong')).toHaveText('Discord Chat')

    const allowedTab = page.getByRole('tab', { name: /^Allowed/ })
    await allowedTab.click()
    await expect(page.locator('.guardian-app-item')).toHaveCount(1)
    await expect(page.locator('.guardian-app-item strong')).toHaveText('Firefox Web Browser')

    const runningTab = page.getByRole('tab', { name: /^Running/ })
    await runningTab.click()
    await expect(page.locator('.guardian-app-item')).toHaveCount(3)

    const allTab = page.getByRole('tab', { name: /^All \(/ })
    await allTab.click()
    await expect(page.locator('.guardian-app-item')).toHaveCount(4)

    // 6. Test toggling policy (Set Visual Studio Code to Blocked)
    const vsCodeItem = page.locator('.guardian-app-item:has-text("Visual Studio Code")')
    const blockButton = vsCodeItem.locator('.segmented-btn.btn-block')
    await blockButton.click()
    await expect(blockButton).toHaveClass(/is-active/)

    // 7. Test collapsible default distraction catalog
    const catalogToggle = page.locator('text=View default distraction catalog')
    await expect(catalogToggle).toBeVisible()
    await catalogToggle.click()
    await expect(page.locator('.guardian-alpha-catalog')).toBeVisible()
    await expect(page.locator('.guardian-alpha-catalog li')).toHaveCount(2)

    // 8. Capture visual acceptance screenshots
    const screenshotDir = path.resolve(process.cwd(), '../docs/qa/screenshots/focus-protection')
    mkdirSync(screenshotDir, { recursive: true })
    await page.screenshot({ path: path.join(screenshotDir, 'focus-protection-installed-apps.png'), fullPage: false })

    // 9. Run axe-core accessibility audit on Focus Protection view
    const scanResults = await new AxeBuilder({ page })
      .include('.task-manager-view')
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['region'])
      .analyze()
    const violations = scanResults.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    expect(violations, 'Accessibility violations found in Focus Protection view').toEqual([])
  })
})
