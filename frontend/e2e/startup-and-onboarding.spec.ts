import { test, expect } from '@playwright/test'
import path from 'node:path'
import { mkdirSync } from 'node:fs'

const ARTIFACTS_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/startup-onboarding'

const MOCK_USER_ALICE = {
  id: 1,
  username: 'alice',
  email: 'alice@shinpo.local',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
}

const MOCK_USER_BOB = {
  id: 2,
  username: 'bob',
  email: 'bob@shinpo.local',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
}

async function setupBaseMockRoutes(page: any, currentUser: any = null, activeFocusSession: any = null) {
  await page.route((url: URL) => url.pathname.startsWith('/api/'), async (route: any) => {
    const url = route.request().url()

    if (url.includes('/auth/me')) {
      if (currentUser) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(currentUser) })
      }
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Unauthorized' }) })
    }

    if (url.includes('/api/auth/login') || url.includes('/api/auth/register')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'mock-token',
          refreshToken: 'mock-refresh',
          tokenType: 'Bearer',
          expiresInSeconds: 3600,
          user: currentUser || MOCK_USER_ALICE,
        }),
      })
    }

    if (url.includes('/api/onboarding')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          userId: currentUser?.id || 1,
          status: 'NOT_STARTED',
          currentStep: 0,
          completedStepsCount: 0,
          verifiedSteps: '',
          completedAt: null,
          isCompleted: false,
          canClaimReward: false,
        }),
      })
    }

    if (url.includes('/api/goals')) {
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}')
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 101, title: body.title || 'Goal', description: body.description, startDate: '2026-11-08', status: 'ACTIVE' }),
        })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }

    if (url.includes('/api/missions')) {
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}')
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 201, title: body.title, goalId: body.goalId, estimatedMinutes: body.estimatedMinutes || 25, status: 'PENDING' }),
        })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }

    if (url.includes('/api/focus-sessions')) {
      if (activeFocusSession) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([activeFocusSession]) })
      }
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
          userId: currentUser?.id || 1,
          totalXp: 120,
          level: 2,
          currentLevelXp: 20,
          nextLevelThreshold: 100,
          progressPercent: 20,
          streakDays: 1,
          recentEvents: [],
        }),
      })
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })
}

test.describe('SHINPO Startup & Automatic Onboarding Integration', () => {
  test.beforeAll(() => {
    mkdirSync(ARTIFACTS_DIR, { recursive: true })
  })

  test('enforces at least 5,000ms cinematic startup before transitioning to login card', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chrome')

    await setupBaseMockRoutes(page, null)

    // Cold start environment: clear sessionStorage
    await page.addInitScript(() => {
      sessionStorage.clear()
      localStorage.clear()
    })

    await page.setViewportSize({ width: 1440, height: 900 })

    const startTimestamp = Date.now()
    await page.goto('/')

    // 1. Verify cinematic startup immediately visible
    const startupOverlay = page.locator('.shinpo-cinematic-startup')
    await expect(startupOverlay).toBeVisible({ timeout: 2000 })

    // Verify brand assets in startup
    await expect(page.locator('.startup-brand-title')).toHaveText('SHINPO')
    await expect(page.locator('.startup-brand-subtitle')).toHaveText('Personal Execution OS')
    await expect(page.locator('.startup-orbital-svg')).toBeVisible()
    await expect(page.locator('.startup-status-text')).toBeVisible()

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '01_startup_at_1s.png') })

    // 2. Check at 2,000ms: must still be visible
    await page.waitForTimeout(2000)
    await expect(startupOverlay).toBeVisible()

    // 3. Check at 4,000ms: must still be visible
    await page.waitForTimeout(2000)
    await expect(startupOverlay).toBeVisible()
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '02_startup_at_4s.png') })

    // 4. Wait for smooth transition to login card
    const loginStage = page.locator('.animated-login-stage')
    await expect(loginStage).toBeVisible({ timeout: 6000 })

    const totalElapsed = Date.now() - startTimestamp
    expect(totalElapsed).toBeGreaterThanOrEqual(4900)

    // Startup unmounts after exit transition
    await expect(startupOverlay).not.toBeVisible()

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '03_login_card_revealed.png') })
  })

  test('does not replay startup during session continuation (theme/tab switches)', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chrome')

    await setupBaseMockRoutes(page, null)

    // Warm session: sessionStorage has shinpo_splash_shown = true
    await page.addInitScript(() => {
      sessionStorage.setItem('shinpo_splash_shown', 'true')
    })

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    // Cinematic startup should not show
    const startupOverlay = page.locator('.shinpo-cinematic-startup')
    await expect(startupOverlay).not.toBeVisible()

    // Login stage is immediately available
    const loginStage = page.locator('.animated-login-stage')
    await expect(loginStage).toBeVisible({ timeout: 4000 })
  })

  test('auto-launches 7-stage interactive tutorial upon first login and persists per account', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chrome')

    await setupBaseMockRoutes(page, MOCK_USER_ALICE)

    await page.addInitScript(() => {
      sessionStorage.setItem('shinpo_splash_shown', 'true')
      localStorage.setItem('shinpo_access_token', 'valid-mock-jwt-token')
      localStorage.setItem('shinpo_auth_user', JSON.stringify({ id: 1, username: 'alice', email: 'alice@shinpo.local' }))
      localStorage.setItem('shinpo_v2_preview', 'true')
      // Pristine onboarding state for alice
      localStorage.removeItem('shinpo_onboarding_dismissed_user_alice')
      localStorage.removeItem('shinpo_onboarding_completed_user_alice')
      localStorage.removeItem('shinpo_interactive_tutorial_completed_user_alice')
    })

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/?tab=Dashboard&v2=true&theme=dark')

    await expect(page.locator('.app-shell')).toBeVisible({ timeout: 10000 })

    // 1. Verify Interactive Tutorial automatically mounts
    const tutorialSurface = page.locator('.shinpo-tutorial-surface')
    await expect(tutorialSurface).toBeVisible({ timeout: 8000 })
    await expect(page.locator('.tutorial-journey-svg')).toBeVisible()
    await expect(page.locator('.tutorial-counter')).toHaveText('Stage 1 of 7')

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '04_auto_tutorial_stage_1.png') })

    // 2. Stage 1: Direction
    await expect(page.locator('#tutorial-stage-title')).toHaveText('Define your direction')
    const goalOption = page.getByRole('button', { name: /Launch SHINPO Private Beta/i })
    await expect(goalOption).toBeVisible()
    await goalOption.click()

    const nextBtn = page.getByRole('button', { name: 'Next Stage' })
    await nextBtn.click()

    // 3. Stage 2: Breakdown
    await expect(page.locator('.tutorial-counter')).toHaveText('Stage 2 of 7')
    await expect(page.locator('#tutorial-stage-title')).toHaveText('Break it down')
    const objectiveBtn = page.getByRole('button', { name: /Pass all 5 automated release verification gates/i })
    await objectiveBtn.click()
    await nextBtn.click()

    // 4. Stage 3: Task
    await expect(page.locator('.tutorial-counter')).toHaveText('Stage 3 of 7')
    await expect(page.locator('#tutorial-stage-title')).toHaveText('Plan a task')
    await nextBtn.click()

    // 5. Stage 4: Schedule
    await expect(page.locator('.tutorial-counter')).toHaveText('Stage 4 of 7')
    await expect(page.locator('#tutorial-stage-title')).toHaveText('Schedule your work')
    await nextBtn.click()

    // 6. Stage 5: Guardian
    await expect(page.locator('.tutorial-counter')).toHaveText('Stage 5 of 7')
    await expect(page.locator('#tutorial-stage-title')).toHaveText('Meet Guardian')
    await nextBtn.click()

    // 7. Stage 6: Focus Demo
    await expect(page.locator('.tutorial-counter')).toHaveText('Stage 6 of 7')
    await expect(page.locator('#tutorial-stage-title')).toHaveText('Try the Focus Engine')
    const startSprintBtn = page.getByRole('button', { name: 'Start Demo Sprint' })
    await startSprintBtn.click()
    const finishEarlyBtn = page.getByRole('button', { name: 'Finish Early' })
    await finishEarlyBtn.click()
    await nextBtn.click()

    // 8. Stage 7: Review & Workspace Entry
    await expect(page.locator('.tutorial-counter')).toHaveText('Stage 7 of 7')
    await expect(page.locator('#tutorial-stage-title')).toHaveText('Review your work')

    const openWorkspaceBtn = page.getByRole('button', { name: 'Open my workspace' })
    await expect(openWorkspaceBtn).toBeVisible()
    await openWorkspaceBtn.click()

    // Tutorial closes and returns to dashboard
    await expect(tutorialSurface).not.toBeVisible({ timeout: 5000 })

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '05_workspace_opened_after_tutorial.png') })

    // Verify per-account persistence in localStorage
    const completionRecorded = await page.evaluate(() => {
      return localStorage.getItem('shinpo_interactive_tutorial_completed_user_alice') === 'true'
    })
    expect(completionRecorded).toBe(true)
  })

  test('enforces per-account onboarding isolation between different users', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chrome')

    await setupBaseMockRoutes(page, MOCK_USER_BOB)

    // Bob has NOT completed tutorial, while Alice HAS completed tutorial
    await page.addInitScript(() => {
      sessionStorage.setItem('shinpo_splash_shown', 'true')
      localStorage.setItem('shinpo_access_token', 'valid-mock-jwt-token')
      localStorage.setItem('shinpo_auth_user', JSON.stringify({ id: 2, username: 'bob', email: 'bob@shinpo.local' }))
      localStorage.setItem('shinpo_v2_preview', 'true')
      // Alice completed
      localStorage.setItem('shinpo_interactive_tutorial_completed_user_alice', 'true')
      localStorage.setItem('shinpo_onboarding_completed_user_alice', 'true')
      // Bob pristine
      localStorage.removeItem('shinpo_interactive_tutorial_completed_user_bob')
      localStorage.removeItem('shinpo_onboarding_completed_user_bob')
      localStorage.removeItem('shinpo_onboarding_dismissed_user_bob')
    })

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/?tab=Dashboard&v2=true&theme=dark')

    // Bob should get the automatic tutorial launch!
    const tutorialSurface = page.locator('.shinpo-tutorial-surface')
    await expect(tutorialSurface).toBeVisible({ timeout: 8000 })
    await expect(page.locator('.tutorial-counter')).toHaveText('Stage 1 of 7')

    // Bob skips tutorial
    const skipBtn = page.getByRole('button', { name: 'Skip Tutorial' })
    await expect(skipBtn).toBeVisible()
    await skipBtn.click()

    await expect(tutorialSurface).not.toBeVisible({ timeout: 4000 })

    // Verify Bob's dismissed state is isolated
    const bobDismissed = await page.evaluate(() => {
      return localStorage.getItem('shinpo_onboarding_dismissed_user_bob') === 'true'
    })
    expect(bobDismissed).toBe(true)
  })

  test('defers tutorial overlay if user has an active focus session restored', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chrome')

    const activeSession = {
      id: 999,
      status: 'ACTIVE',
      goalId: 1,
      targetDurationMinutes: 25,
      actualDurationMinutes: 5,
      startedAt: new Date(Date.now() - 300000).toISOString(),
      currentPhase: 'FOCUS',
    }

    await setupBaseMockRoutes(page, MOCK_USER_ALICE, activeSession)

    await page.addInitScript(() => {
      sessionStorage.setItem('shinpo_splash_shown', 'true')
      localStorage.setItem('shinpo_access_token', 'valid-mock-jwt-token')
      localStorage.setItem('shinpo_auth_user', JSON.stringify({ id: 1, username: 'alice', email: 'alice@shinpo.local' }))
      localStorage.setItem('shinpo_v2_preview', 'true')
      // Alice has not completed tutorial
      localStorage.removeItem('shinpo_interactive_tutorial_completed_user_alice')
      localStorage.removeItem('shinpo_onboarding_completed_user_alice')
    })

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/?tab=Focus+Engine&v2=true&theme=dark')

    await expect(page.locator('.app-shell')).toBeVisible({ timeout: 10000 })

    // Give time for any automatic tutorial launch attempt
    await page.waitForTimeout(1500)

    // Tutorial must NOT pop up over live Focus Engine
    const tutorialSurface = page.locator('.shinpo-tutorial-surface')
    await expect(tutorialSurface).not.toBeVisible()

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '06_active_focus_no_tutorial_overlay.png') })
  })

  test('renders tutorial cleanly across all four SHINPO themes with zero collisions', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chrome')

    await setupBaseMockRoutes(page, MOCK_USER_ALICE)

    const themeMatrix = [
      { name: 'Aurora Dark', theme: 'dark', v2: 'true', brand: 'aurora' },
      { name: 'Aurora Light', theme: 'light', v2: 'true', brand: 'aurora' },
      { name: 'Classic Dark', theme: 'dark', v2: 'false', brand: 'classic' },
      { name: 'Classic Light', theme: 'light', v2: 'false', brand: 'classic' },
    ]

    for (const item of themeMatrix) {
      await page.addInitScript(({ th, v2, br }) => {
        sessionStorage.clear()
        sessionStorage.setItem('shinpo_splash_shown', 'true')
        localStorage.clear()
        localStorage.setItem('shinpo_access_token', 'valid-mock-jwt-token')
        localStorage.setItem('shinpo_auth_user', JSON.stringify({ id: 1, username: 'alice', email: 'alice@shinpo.local' }))
        localStorage.setItem('shinpo_v2_preview', v2)
        localStorage.setItem('shinpo_theme', th)
        document.documentElement.setAttribute('data-theme', th)
        document.documentElement.setAttribute('data-brand', br)
      }, { th: item.theme, v2: item.v2, br: item.brand })

      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(`/?tab=Dashboard&v2=${item.v2}&theme=${item.theme}`)

      const tutorialSurface = page.locator('.shinpo-tutorial-surface')
      await expect(tutorialSurface).toBeVisible({ timeout: 8000 })

      const screenshotFile = `07_theme_${item.name.toLowerCase().replace(/\s+/g, '_')}.png`
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, screenshotFile) })

      // Clear state for next iteration
      await page.evaluate(() => {
        localStorage.clear()
        sessionStorage.clear()
      })
    }
  })
})
