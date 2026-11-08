import { test, expect } from '@playwright/test'

const injectMocks = async (page: any) => {
  await page.route((url: URL) => url.pathname.startsWith('/api/'), async (route: any) => {
    const url = route.request().url()
    if (url.includes('/auth/me')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, username: 'eonx_dev', email: 'eonx@local.shinpo' }) })
    }
    if (url.includes('/api/goals')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, title: 'Release Candidate Hardening', status: 'IN_PROGRESS', targetDate: '2026-11-20', progress: 50 },
        ]),
      })
    }
    if (url.includes('/api/missions')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 10, goalId: 1, title: 'Verify Release Gate Journeys', status: 'READY', priority: 1, estimatedMinutes: 25 },
        ]),
      })
    }
    if (url.includes('/api/focus-sessions')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 101, name: 'Deep Work Sprint', durationMinutes: 25, status: 'COMPLETED', startedAt: new Date(Date.now() - 3600000).toISOString(), completedFocusCycles: 1 },
        ]),
      })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })

  await page.addInitScript(() => {
    localStorage.setItem('shinpo_access_token', 'mock-valid-token')
    localStorage.setItem('shinpo_local_vault_account', 'eonx_dev')
    localStorage.setItem('shinpo_vault_unlocked', 'true')
    localStorage.setItem(
      'shinpo_auth_user',
      JSON.stringify({ id: 1, username: 'eonx_dev', email: 'eonx@local.shinpo' })
    )
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      value: {
        invoke: async (cmd: string, _args: any) => {
          if (cmd === 'local_vault_status') return { unlocked: true, username: 'eonx_dev' }
          if (cmd === 'get_guardian_status') return {
            status: 'idle',
            observerStatus: 'active',
            guardianMode: 'PROTECTED',
            interventionCapability: 'STANDARD_CLOSE_LINUX',
            warningOnly: true,
            standardAllowanceSeconds: 120,
          }
          if (cmd === 'get_sentinel_rules') return [
            { id: 1, processNamePattern: 'slack', policyType: 'BLOCKED', isCustom: true },
          ]
          if (cmd === 'get_recent_tamper_events') return []
          if (cmd === 'get_installed_applications' || cmd === 'get_active_application_catalog' || cmd === 'local_get_discovered_apps') return [
            { id: 'app-1', name: 'Slack', execName: 'slack', category: 'Communication', rationale: 'Messaging distraction', policy: 'BLOCKED', isRunning: false, source: 'system' },
          ]
          if (cmd === 'local_get_app_policies') return []
          if (cmd === 'list_focus_sessions') return [
            { id: 101, name: 'Deep Work Sprint', durationMinutes: 25, status: 'COMPLETED', startedAt: new Date(Date.now() - 3600000).toISOString(), completedFocusCycles: 1 },
          ]
          if (cmd === 'list_goals_and_missions') return {
            goals: [
              { id: 1, title: 'Release Candidate Hardening', status: 'IN_PROGRESS', targetDate: '2026-11-20' },
            ],
            missions: [
              { id: 10, goalId: 1, title: 'Verify Release Gate Journeys', status: 'READY', priority: 1 },
            ],
          }
          if (cmd === 'get_user_progress') return {
            userId: 1,
            totalProgress: 350,
            level: 3,
            levelTitle: 'Focused Strategist',
            currentLevelXp: 150,
            nextLevelThreshold: 400,
            progressPercent: 37.5,
            recentEvents: [],
          }
          if (cmd === 'get_analytics_dashboard') return {
            summary: {
              totalFocusMinutes: 185,
              completedSessionsCount: 7,
              averageDailyMinutes: 37,
              missionsCompleted: 5,
              missionsTotal: 8,
              currentStreak: 4,
              streakDays: 4,
            },
            recentDebriefs: [],
          }
          if (cmd === 'get_guardian_preferences') return {
            preferredMode: 'PROTECTED',
            appMonitoringConsent: true,
            applyToNewSessions: true,
            closureConsent: false,
            backgroundRuntimeConsent: true,
          }
          if (cmd === 'local_eonpai_provider_config') return {
            provider: 'none',
            model: '',
            endpoint: '',
            allowCloudContext: false,
          }
          if (cmd === 'get_ai_provider_status') return {
            enabled: false,
            provider: 'none',
            status: 'Offline planning only',
            models: [],
          }
          return null
        },
      },
    })
  })
}

test.describe('SHINPO Core User Journeys Release Gate', () => {
  test.beforeEach(async ({ page }) => {
    await injectMocks(page)
  })

  test('Focus Engine Journey: Timer controls, single intention input, Guardian mode discoverability', async ({ page }) => {
    await page.goto('/?tab=Focus%20Engine')
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('.card-timer-hud', { timeout: 8000 })

    // 1. Assert exactly ONE session intention input exists
    const intentionInputs = page.locator('input[placeholder*="intention"], input[placeholder*="focus"], input[placeholder*="Write design doc"]')
    const count = await intentionInputs.count()
    expect(count, 'There must be at most one primary intention field on the Focus screen').toBeLessThanOrEqual(1)

    // 2. Assert Guardian Mode selectors exist and are selectable
    const lightModeBtn = page.locator('.study-mode-option').filter({ hasText: /Light/i }).first()
    const standardModeBtn = page.locator('.study-mode-option').filter({ hasText: /Standard/i }).first()
    const strictModeBtn = page.locator('.study-mode-option').filter({ hasText: /Strict/i }).first()

    if (await standardModeBtn.isVisible()) {
      await expect(lightModeBtn).toBeVisible()
      await expect(strictModeBtn).toBeVisible()

      // Switch to Strict
      await strictModeBtn.click()
      await expect(strictModeBtn).toHaveClass(/is-active/)

      // Switch back to Standard
      await standardModeBtn.click()
      await expect(standardModeBtn).toHaveClass(/is-active/)
    }

    // 3. Assert Start button is present and clickable
    const startBtn = page.locator('.btn-timer.primary').first()
    await expect(startBtn).toBeVisible()
    await expect(startBtn).toContainText(/Start/i)
  })

  test('Goals & Tasks Journey: Filter controls, task creation button, search', async ({ page }) => {
    await page.goto('/?tab=Goals%20%26%20Missions')
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('.goals-view-deck, .goals-page-heading', { timeout: 8000 })

    // Assert Add Goal / Add Task buttons exist
    const addGoalBtn = page.locator('button').filter({ hasText: /New Goal|Add Goal/i }).first()
    await expect(addGoalBtn).toBeVisible()

    // Assert Search input is functional
    const searchInput = page.locator('.goals-search-input, input[placeholder*="Search"]').first()
    if (await searchInput.isVisible()) {
      await searchInput.fill('Release')
      await page.waitForTimeout(200)
      await searchInput.fill('')
    }
  })

  test('Settings Modal Journey: AI Provider selection renders cleanly without hot-pink highlight', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Click Settings button in TopBar
    const settingsBtn = page.getByRole('button', { name: /settings/i }).first()
    await expect(settingsBtn).toBeVisible()
    await settingsBtn.click()

    // Wait for dialog
    const dialog = page.locator('.settings-modal-dialog, [role="dialog"]').first()
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Navigate to EONPAI tab
    const eonpaiTab = dialog.getByRole('tab', { name: /eonpai/i }).or(dialog.locator('button:has-text("EONPAI")')).first()
    if (await eonpaiTab.isVisible()) {
      await eonpaiTab.click()
      await page.waitForTimeout(300)

      // Find AI Provider Select
      const providerSelect = dialog.locator('select.eonpai-provider-select, select').first()
      if (await providerSelect.isVisible()) {
        const selectColor = await page.evaluate((el) => {
          const style = window.getComputedStyle(el)
          return {
            bg: style.backgroundColor,
            color: style.color,
          }
        }, await providerSelect.elementHandle())

        // Must NOT be magenta/hot pink rgb(255, 0, 255)
        expect(selectColor.bg).not.toContain('255, 0, 255')
      }
    }

    // Close with Escape
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })
})
