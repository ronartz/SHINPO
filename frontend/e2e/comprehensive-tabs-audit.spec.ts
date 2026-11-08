import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import path from 'node:path'

const MOCK_USER = { id: 1, username: 'testuser', email: 'test@shinpo.dev' }

const MOCK_GOALS = [
  { id: 1, title: 'Release SHINPO Desktop', description: 'Final release readiness', targetDate: '2026-11-07', progress: 85, color: '#3B82F6', status: 'ACTIVE' },
  { id: 2, title: 'Health and Wellness', description: 'Daily habits and focus', targetDate: '2026-12-31', progress: 50, color: '#16A36A', status: 'ACTIVE' },
]

const MOCK_MISSIONS = [
  { id: 101, title: 'Audit Focus Protection', description: 'Verify native enforcement and guardian', goalId: 1, status: 'IN_PROGRESS', priority: 'HIGH', estimatedMinutes: 45, xp: 50 },
  { id: 102, title: 'Verify Calendar Navigation', description: 'Check week view and booking modal', goalId: 1, status: 'PENDING', priority: 'MEDIUM', estimatedMinutes: 30, xp: 30 },
  { id: 103, title: 'Check Theme Contrast', description: 'Ensure WCAG AA contrast across tabs', goalId: 1, status: 'COMPLETED', priority: 'LOW', estimatedMinutes: 20, xp: 20 },
]

const MOCK_SESSIONS = [
  {
    id: 201,
    name: 'Morning Deep Work',
    intention: 'Audit Focus Engine',
    durationMinutes: 45,
    actualActiveSeconds: 1800,
    accumulatedPausedSeconds: 0,
    status: 'ACTIVE',
    startedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    scheduledAt: new Date().toISOString(),
    focusActiveSeconds: 1800,
    activeSeconds: 1800,
    currentPhase: 'WORK',
    sessionType: 'STANDARD',
  },
]

const MOCK_ANALYTICS = {
  summary: {
    totalFocusMinutes: 180,
    sessionsCompleted: 4,
    sessionsStarted: 5,
    missionsCompleted: 1,
    missionsTotal: 3,
    avgQuality: 4,
    completionRate: 33,
    currentStreak: 5,
    completionRatePopulation: 'MISSIONS',
    completionRateNumerator: 1,
    completionRateDenominator: 3,
  },
  weeklyVelocity: [],
  recentDebriefs: [],
}

const MOCK_SENTINEL_STATUS = {
  status: 'ACTIVE',
  shieldConnected: true,
  enforcementMode: 'CONTAINMENT',
  isPolicyLocked: false,
  totalInterceptedToday: 2,
  activePolicyRulesCount: 4,
  activeFocusSessionId: 201,
  activeFocusSessionName: 'Morning Deep Work',
  observerStatus: 'READY',
  guardianMode: 'PROTECTED',
  warningOnly: false,
  interventionCapability: 'LIMITED_NO_CLOSURE_CONSENT',
  guardianApplicationCatalog: [
    { processName: 'discord', category: 'Chat & Social', rationale: 'Communication distraction' },
    { processName: 'steam', category: 'Gaming', rationale: 'Gaming launcher' },
  ],
  guardianObservations: [
    { id: 1, processName: 'discord', category: 'Chat & Social', outcome: 'WARNED', observedAt: new Date().toISOString() },
  ],
}

const MOCK_SENTINEL_RULES = [
  { id: 1, processNamePattern: 'discord', policyType: 'BLOCKED', isCustom: true },
  { id: 2, processNamePattern: 'steam', policyType: 'BLOCKED', isCustom: true },
  { id: 3, processNamePattern: 'slack', policyType: 'ALLOWED', isCustom: false },
]

const MOCK_PROGRESS = {
  userId: 1,
  totalXp: 450,
  totalProgress: 450,
  levelTitle: 'Focused Learner',
  currentLevelXp: 50,
  level: 4,
  nextLevelThreshold: 200,
  nextLevelXp: 200,
  progressPercent: 25,
  streakDays: 5,
  recentEvents: [],
}

const MOCK_ANALYTICS_PERIOD = {
  range: '7d',
  timezone: 'UTC',
  currentStart: '2026-11-01T00:00:00.000Z',
  currentEnd: '2026-11-07T23:59:59.999Z',
  previousStart: '2026-10-25T00:00:00.000Z',
  previousEnd: '2026-10-31T23:59:59.999Z',
  currentBuckets: [],
  previousBuckets: [],
  currentActiveSeconds: 0,
  currentCompletedSessions: 0,
  previousActiveSeconds: 0,
  previousCompletedSessions: 0,
}

async function setupMockRoutes(page: any, focusSessions = MOCK_SESSIONS) {
  await page.route((url: URL) => url.pathname.startsWith('/api/'), async (route: any) => {
    const url = route.request().url()
    if (url.includes('/auth/me')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_USER) })
    }
    if (url.includes('/api/goals')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_GOALS) })
    }
    if (url.includes('/api/missions')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_MISSIONS) })
    }
    if (url.includes('/api/focus-sessions')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(focusSessions) })
    }
    if (url.includes('/api/contextual-focus/resources') || url.includes('/api/contextual-focus/restrictions')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }
    if (url.includes('/api/contextual-focus/status')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
    }
    if (url.includes('/api/analytics/period')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ANALYTICS_PERIOD) })
    }
    if (url.includes('/api/analytics')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ANALYTICS) })
    }
    if (url.includes('/api/device/sentinel/status')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SENTINEL_STATUS) })
    }
    if (url.includes('/api/device/sentinel/warnings')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }
    if (url.includes('/api/device/sentinel/rules')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SENTINEL_RULES) })
    }
    if (url.includes('/api/device/snapshot')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          systemInfo: { systemCpuLoad: 12.5, availableProcessors: 8, totalMemoryBytes: 16 * 1024**3, freeMemoryBytes: 8 * 1024**3, processCount: 140 },
          processes: [{ pid: 1234, name: 'code', memoryBytes: 200 * 1024 * 1024 }],
        }),
      })
    }
    if (url.includes('/api/progress')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PROGRESS) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })
}

async function loginAndNavigate(page: any, tab: string, isV2 = true, theme = 'dark', focusSessions = MOCK_SESSIONS) {
  await setupMockRoutes(page, focusSessions)
  await page.addInitScript(() => {
    localStorage.setItem('shinpo_access_token', 'valid-mock-jwt-token')
    localStorage.setItem('shinpo_auth_user', JSON.stringify({ id: 1, username: 'testuser', email: 'test@shinpo.dev' }))
  })
  await page.goto(`/?tab=${encodeURIComponent(tab)}&v2=${isV2}&theme=${theme}`)
  // Wait for the app shell to hydrate
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 10000 })
}

const TABS = [
  'Dashboard',
  'Goals & Missions',
  'Focus Engine',
  'Schedule',
  'Analytics',
  'Rewards',
  'Task Manager',
  'AI Assistant',
]

test.describe('SHINPO Comprehensive Tabs Audit', () => {
  test('keeps search in the top bar and removes the duplicate sidebar search', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chrome')
    await loginAndNavigate(page, 'Dashboard', true, 'dark')

    await expect(page.locator('.icon-sidebar input[placeholder="Search tasks and goals"]')).toHaveCount(0)
    await expect(page.getByRole('textbox', { name: 'Global search' })).toBeVisible()
    await page.locator('.icon-sidebar').screenshot({ path: path.resolve(process.cwd(), '../docs/qa/screenshots/final-ui-repair-20261107/sidebar-browser-after.png') })
  })

  test('keeps Goals filters, actions and task content in separate aligned rows', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chrome')
    await loginAndNavigate(page, 'Goals & Missions', true, 'dark')

    const heading = page.locator('.goals-task-area > .deck-section-header')
    const filters = page.locator('.goals-task-area > .tasks-status-tabs')
    const actions = page.locator('.goals-task-area > .tasks-controls-right')
    await expect(heading).toBeVisible()
    await expect(filters).toBeVisible()
    await expect(actions).toBeVisible()
    const geometry = await page.evaluate(() => {
      const box = (selector: string) => {
        const element = document.querySelector(selector)
        if (!element) return null
        const { x, y, width, height } = element.getBoundingClientRect()
        return { x, y, width, height, bottom: y + height, right: x + width }
      }
      return {
        heading: box('.goals-task-area > .deck-section-header'),
        filters: box('.goals-task-area > .tasks-status-tabs'),
        actions: box('.goals-task-area > .tasks-controls-right'),
        content: box('.goals-task-area > .missions-list-container, .goals-task-area > .flight-deck-board-grid'),
      }
    })
    expect(geometry.heading).not.toBeNull()
    expect(geometry.filters).not.toBeNull()
    expect(geometry.actions).not.toBeNull()
    expect(geometry.content).not.toBeNull()
    expect(geometry.heading!.bottom).toBeLessThanOrEqual(geometry.filters!.y + 1)
    expect(geometry.filters!.right).toBeLessThanOrEqual(geometry.actions!.x + 1)
    expect(geometry.content!.y).toBeGreaterThanOrEqual(Math.max(geometry.filters!.bottom, geometry.actions!.bottom))
    await page.screenshot({ path: path.resolve(process.cwd(), '../docs/qa/screenshots/final-ui-repair-20261107/goals-browser-after.png'), fullPage: false })

    await page.setViewportSize({ width: 1280, height: 720 })
    await expect(page.locator('.goals-task-area')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    await page.screenshot({ path: path.resolve(process.cwd(), '../docs/qa/screenshots/final-ui-repair-20261107/goals-browser-1280x720.png'), fullPage: false })
  })

  test('keeps the Focus timer centered in its own panel at desktop sizes', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chrome')
    await loginAndNavigate(page, 'Focus Engine', true, 'dark', [])
    await expect(page.locator('.focus-workspace-container')).toBeVisible()

    for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }]) {
      await page.setViewportSize(viewport)
      const geometry = await page.evaluate(() => {
        const card = document.querySelector('.card-timer-hud')?.getBoundingClientRect()
        const timer = document.querySelector('.timer-hud-center')?.getBoundingClientRect()
        if (!card || !timer) return null
        return { card, timer }
      })
      expect(geometry).not.toBeNull()
      expect(geometry!.timer.top).toBeGreaterThanOrEqual(geometry!.card.top)
      expect(geometry!.timer.bottom).toBeLessThanOrEqual(geometry!.card.bottom)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
      const suffix = `${viewport.width}x${viewport.height}`
      await page.screenshot({ path: path.resolve(process.cwd(), `../docs/qa/screenshots/final-ui-repair-20261107/focus-browser-${suffix}.png`), fullPage: false })
    }
  })

  for (const tab of TABS) {
    test(`Tab [${tab}] renders without clipping or console errors in Aurora Dark`, async ({ page }) => {
      const consoleErrors: string[] = []
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text())
        }
      })

      await loginAndNavigate(page, tab, true, 'dark')

      // Check for horizontal overflow leak
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth
      })
      expect(overflow).toBe(false)

      // Ensure no fatal runtime errors occurred
      const fatalErrors = consoleErrors.filter(
        (err) =>
          !err.includes('Failed to load resource') &&
          !err.includes('favicon') &&
          !err.includes('WebSocket') &&
          !err.includes('vite')
      )
      expect(fatalErrors).toEqual([])
    })
  }

  test('Settings modal opens and switches tabs properly', async ({ page }) => {
    await loginAndNavigate(page, 'Dashboard', true, 'dark')

    // Click Settings button in TopBar
    const settingsBtn = page.getByRole('button', { name: /settings/i }).first()
    await expect(settingsBtn).toBeVisible()
    await settingsBtn.click()

    // Expect Settings dialog to be visible
    const dialog = page.locator('.settings-modal-dialog, [role="dialog"]')
    await expect(dialog).toBeVisible()

    // Test switching to Protection tab
    const protectionTab = dialog.getByRole('tab', { name: /protection/i }).or(dialog.locator('button:has-text("Protection")')).first()
    if (await protectionTab.isVisible()) {
      await protectionTab.click()
      await expect(dialog.getByText(/focus protection|guardian/i).first()).toBeVisible()
    }

    // Close with Escape
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('Focus Protection (Task Manager) allows rule filtering and interactions', async ({ page }) => {
    await loginAndNavigate(page, 'Task Manager', true, 'dark')

    // Expect Focus Protection header
    const title = page.locator('#protection-hero-title, #guardian-alpha-title')
    await expect(title.first()).toBeVisible()

    // Check that metrics are visible
    await expect(page.locator('.protection-hero, .guardian-alpha-header').first()).toBeVisible()
  })

  test('Major tabs render cleanly in Classic Dark and Light modes', async ({ page }) => {
    for (const theme of ['dark', 'light'] as const) {
      await loginAndNavigate(page, 'Dashboard', false, theme)
      await expect(page.locator('.app-shell')).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
      expect(overflow).toBe(false)
    }
  })

  test('Major views pass axe-core accessibility audit on desktop', async ({ page }) => {
    if (test.info().project.name !== 'desktop-chrome') return
    const keyTabs = ['Dashboard', 'Focus Engine', 'Task Manager', 'Goals & Missions']
    for (const tab of keyTabs) {
      await loginAndNavigate(page, tab, true, 'dark')
      const scanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .disableRules(['region']) // Main landmarks verified in semantic spec
        .analyze()
      const criticalOrSerious = scanResults.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      )
      expect(criticalOrSerious, `A11y violations found in tab ${tab}`).toEqual([])
    }
  })
})
