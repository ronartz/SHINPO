import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import path from 'node:path'
import { mkdirSync } from 'node:fs'

const MOCK_USER = {
  id: 1,
  email: 'founder@shinpo.dev',
  username: 'testuser',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
}

const ARTIFACTS_SCREENSHOT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/interactive-tutorial'

async function setupMockRoutes(page: any, onboardingStatus: string = 'NOT_STARTED') {
  await page.route((url: URL) => url.pathname.startsWith('/api/'), async (route: any) => {
    const url = route.request().url()

    if (url.includes('/auth/me')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_USER) })
    }
    if (url.includes('/api/onboarding')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          userId: 1,
          status: onboardingStatus,
          currentStep: 0,
          completedStepsCount: 0,
          verifiedSteps: '',
          completedAt: null,
          isCompleted: onboardingStatus === 'COMPLETED',
          canClaimReward: false,
        }),
      })
    }
    if (url.includes('/api/goals')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }
    if (url.includes('/api/missions')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }
    if (url.includes('/api/focus-sessions')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }
    if (url.includes('/api/contextual-focus')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }
    if (url.includes('/api/device/sentinel/status')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ACTIVE',
          shieldConnected: true,
          enforcementMode: 'CONTAINMENT',
          observerStatus: 'READY',
          guardianMode: 'PROTECTED',
        }),
      })
    }
    if (url.includes('/api/analytics')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          summary: { totalFocusMinutes: 0, totalSessionsCompleted: 0, currentStreak: 0 },
          stats: { totalFocusMinutes: 0, sessionsStarted: 0, missionsCompleted: 0, currentStreak: 0 },
          weeklyVelocity: [],
          recentDebriefs: [],
        }),
      })
    }
    if (url.includes('/api/progress')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          userId: 1,
          totalXp: 0,
          level: 1,
          currentLevelXp: 0,
          nextLevelThreshold: 100,
          progressPercent: 0,
          streakDays: 0,
          recentEvents: [],
        }),
      })
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })
}

test.describe('Interactive 7-Stage Onboarding Tutorial', () => {
  test.beforeAll(() => {
    mkdirSync(ARTIFACTS_SCREENSHOT_DIR, { recursive: true })
  })

  test('runs complete 7-stage interactive journey from first run to workspace entry', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chrome')

    await setupMockRoutes(page, 'NOT_STARTED')

    await page.addInitScript(() => {
      localStorage.setItem('shinpo_access_token', 'valid-mock-jwt-token')
      localStorage.setItem('shinpo_auth_user', JSON.stringify({ id: 1, username: 'testuser', email: 'founder@shinpo.dev' }))
      localStorage.setItem('shinpo_v2_preview', 'true')
      // Ensure pristine first-run state
      localStorage.removeItem('shinpo_onboarding_dismissed')
      localStorage.removeItem('shinpo_onboarding_dismissed_1')
      localStorage.removeItem('shinpo_onboarding_completed')
      localStorage.removeItem('shinpo_onboarding_completed_1')
      localStorage.removeItem('shinpo_interactive_tutorial_completed')
      localStorage.removeItem('shinpo_interactive_tutorial_completed_1')
    })

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/?tab=Dashboard&v2=true&theme=dark')
    await expect(page.locator('.app-shell')).toBeVisible({ timeout: 10000 })

    // 1. Verify First-Run Automatic Interactive Tutorial Launch
    const modalSurface = page.locator('.shinpo-tutorial-surface')
    await expect(modalSurface).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.tutorial-journey-svg')).toBeVisible()
    await expect(page.locator('.tutorial-counter')).toHaveText('Stage 1 of 7')

    // Stage 1: Direction
    await expect(page.locator('#tutorial-stage-title')).toHaveText('Define your direction')
    const betaGoalCard = page.getByRole('button', { name: /Launch SHINPO Private Beta/i })
    await expect(betaGoalCard).toBeVisible()
    await betaGoalCard.click()
    await page.screenshot({ path: path.join(ARTIFACTS_SCREENSHOT_DIR, '02_stage_1_direction.png') })

    const nextBtn = page.getByRole('button', { name: 'Next Stage' })
    await expect(nextBtn).toBeEnabled()
    await nextBtn.click()

    // Stage 2: Breakdown
    await expect(page.locator('.tutorial-counter')).toHaveText('Stage 2 of 7')
    await expect(page.locator('#tutorial-stage-title')).toHaveText('Break it down')
    const actionableObjective = page.getByRole('button', { name: /Pass all 5 automated release verification gates/i })
    await expect(actionableObjective).toBeVisible()
    await actionableObjective.click()

    await expect(page.locator('.objective-feedback-box.is-actionable')).toBeVisible()
    await page.screenshot({ path: path.join(ARTIFACTS_SCREENSHOT_DIR, '03_stage_2_breakdown.png') })
    await nextBtn.click()

    // Stage 3: Task
    await expect(page.locator('.tutorial-counter')).toHaveText('Stage 3 of 7')
    await expect(page.locator('#tutorial-stage-title')).toHaveText('Plan a task')
    await expect(page.locator('.simulated-task-card')).toBeVisible()

    // Select 45m duration
    const dur45Btn = page.getByRole('button', { name: '45m' })
    await dur45Btn.click()
    await expect(page.locator('.simulated-duration-pill')).toHaveText('45 mins')
    await page.screenshot({ path: path.join(ARTIFACTS_SCREENSHOT_DIR, '04_stage_3_task.png') })
    await nextBtn.click()

    // Stage 4: Schedule
    await expect(page.locator('.tutorial-counter')).toHaveText('Stage 4 of 7')
    await expect(page.locator('#tutorial-stage-title')).toHaveText('Schedule your work')
    const slotBtn = page.getByRole('button', { name: '14:00 - 14:45' })
    await slotBtn.click()
    await expect(page.locator('.timeline-track-preview')).toBeVisible()
    await page.screenshot({ path: path.join(ARTIFACTS_SCREENSHOT_DIR, '05_stage_4_schedule.png') })
    await nextBtn.click()

    // Stage 5: Guardian
    await expect(page.locator('.tutorial-counter')).toHaveText('Stage 5 of 7')
    await expect(page.locator('#tutorial-stage-title')).toHaveText('Meet Guardian')
    const strictCard = page.getByRole('button', { name: /Strict Mode/i })
    await strictCard.click()
    await expect(strictCard).toHaveClass(/is-active/)
    await page.screenshot({ path: path.join(ARTIFACTS_SCREENSHOT_DIR, '06_stage_5_guardian.png') })
    await nextBtn.click()

    // Stage 6: Try Focus Engine
    await expect(page.locator('.tutorial-counter')).toHaveText('Stage 6 of 7')
    await expect(page.locator('#tutorial-stage-title')).toHaveText('Try the Focus Engine')
    await expect(page.locator('.demo-timer-clock')).toHaveText('00:10')

    const startSprintBtn = page.getByRole('button', { name: 'Start Demo Sprint' })
    await startSprintBtn.click()
    await expect(page.locator('.demo-timer-status')).toContainText('Focusing')

    const finishEarlyBtn = page.getByRole('button', { name: 'Finish Early' })
    await finishEarlyBtn.click()
    await expect(page.locator('.demo-timer-status')).toContainText('Sprint Complete')
    await page.screenshot({ path: path.join(ARTIFACTS_SCREENSHOT_DIR, '07_stage_6_focus_demo.png') })
    await nextBtn.click()

    // Stage 7: Review your work
    await expect(page.locator('.tutorial-counter')).toHaveText('Stage 7 of 7')
    await expect(page.locator('#tutorial-stage-title')).toHaveText('Review your work')
    await expect(page.locator('.complete-loop-grid')).toBeVisible()
    await page.screenshot({ path: path.join(ARTIFACTS_SCREENSHOT_DIR, '08_stage_7_review.png') })

    // Axe accessibility audit on tutorial modal surface
    const scanResults = await new AxeBuilder({ page })
      .include('.shinpo-tutorial-surface')
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['region'])
      .analyze()

    const severeViolations = scanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    )
    expect(severeViolations).toEqual([])

    const openWorkspaceBtn = page.getByRole('button', { name: 'Open my workspace' })
    await expect(openWorkspaceBtn).toBeVisible()
    await openWorkspaceBtn.click()

    // Modal closes and lands on workspace
    await expect(modalSurface).not.toBeVisible({ timeout: 5000 })
  })

  test('verifies theme contrast in Aurora Light and Classic Light modes', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chrome')

    await setupMockRoutes(page, 'NOT_STARTED')

    // Test in Aurora Light
    await page.addInitScript(() => {
      localStorage.setItem('shinpo_access_token', 'valid-mock-jwt-token')
      localStorage.setItem('shinpo_auth_user', JSON.stringify({ id: 1, username: 'testuser', email: 'founder@shinpo.dev' }))
      localStorage.setItem('shinpo_v2_preview', 'true')
      localStorage.setItem('shinpo_theme', 'light')
      localStorage.removeItem('shinpo_onboarding_dismissed')
      localStorage.removeItem('shinpo_onboarding_completed')
    })

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/?tab=Dashboard&v2=true&theme=light')
    await expect(page.locator('.app-shell')).toBeVisible({ timeout: 10000 })

    const modalSurface = page.locator('.shinpo-tutorial-surface')
    await expect(modalSurface).toBeVisible({ timeout: 10000 })

    await page.screenshot({ path: path.join(ARTIFACTS_SCREENSHOT_DIR, '09_aurora_light_stage_1.png') })

    // Scan Aurora Light for accessibility
    const auroraLightScan = await new AxeBuilder({ page })
      .include('.shinpo-tutorial-surface')
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['region'])
      .analyze()

    const auroraLightViolations = auroraLightScan.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    )
    expect(auroraLightViolations).toEqual([])
  })

  test('can replay tutorial from Settings modal and skip', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chrome')

    await setupMockRoutes(page, 'COMPLETED')

    await page.addInitScript(() => {
      localStorage.setItem('shinpo_access_token', 'valid-mock-jwt-token')
      localStorage.setItem('shinpo_auth_user', JSON.stringify({ id: 1, username: 'qa_tutorial_user', email: 'qa@shinpo.local' }))
      localStorage.setItem('shinpo_v2_preview', 'true')
      localStorage.setItem('shinpo_onboarding_dismissed', 'true')
      localStorage.setItem('shinpo_onboarding_completed', 'true')
      localStorage.setItem('shinpo_interactive_tutorial_completed', 'true')
    })

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/?tab=Dashboard&v2=true&theme=dark')
    await expect(page.locator('.app-shell')).toBeVisible({ timeout: 10000 })

    // Open Settings Modal via account dropdown
    const accountBtn = page.getByRole('button', { name: /Account menu for/i })
    await expect(accountBtn).toBeVisible({ timeout: 6000 })
    await accountBtn.click()

    const settingsMenuItem = page.getByRole('menuitem', { name: /All settings/i })
    await expect(settingsMenuItem).toBeVisible({ timeout: 4000 })
    await settingsMenuItem.click()

    // Navigate to 'About & Health' tab in Settings
    const aboutNavBtn = page.getByRole('button', { name: /About & Health/i })
    await expect(aboutNavBtn).toBeVisible({ timeout: 4000 })
    await aboutNavBtn.click()

    // Click 'Replay Tutorial'
    const replayBtn = page.getByRole('button', { name: 'Replay Tutorial' })
    await expect(replayBtn).toBeVisible({ timeout: 4000 })
    await replayBtn.click()

    // Verify tutorial modal opens
    const modalSurface = page.locator('.shinpo-tutorial-surface')
    await expect(modalSurface).toBeVisible({ timeout: 4000 })

    // Click 'Skip Tutorial'
    const skipBtn = page.getByRole('button', { name: 'Skip Tutorial' })
    await skipBtn.click()

    // Modal closes
    await expect(modalSurface).not.toBeVisible({ timeout: 4000 })
  })
})
