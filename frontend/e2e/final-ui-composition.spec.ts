import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

test.describe('SHINPO — Operation Final UI Consistency & Composition Repair', () => {
  const screenshotsDir = path.resolve(process.cwd(), '../docs/qa/screenshots/final-ui-repair')

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true })
    }
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
      sessionStorage.setItem('shinpo_startup_completed', 'true')
      sessionStorage.setItem('shinpo_splash_shown', 'true')
      localStorage.setItem('shinpo_session_v1', JSON.stringify({
        user: { id: 1, username: 'qa_local_user', email: 'qa@shinpo.local' },
        token: 'local-vault-token',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      }))

      // Mock 1 goal and 1 ready task
      const mockGoals = [
        {
          id: 1,
          userId: 1,
          title: 'Master Execution System',
          description: 'Build complete discipline and consistent deep work habit',
          targetDate: '2026-11-30',
          status: 'IN_PROGRESS',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]

      const mockMissions = [
        {
          id: 10,
          userId: 1,
          goalId: 1,
          title: 'Starter task: First Focus Session',
          description: 'Starter example — edit or replace this with a concrete next action for your goal.',
          status: 'READY',
          estimatedMinutes: 25,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]

      const mockSessions = [
        {
          id: 100,
          userId: 1,
          name: '30m Focus Session',
          intention: 'Writing & planning',
          durationMinutes: 30,
          activeSeconds: 30 * 60,
          accumulatedPausedSeconds: 0,
          status: 'COMPLETED',
          endedAt: new Date().toISOString(),
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          completionQuality: 5,
          accomplishment: 'Planned next actions',
          reflectionNote: 'Clean focus',
        },
      ]

      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        configurable: true,
        value: {
          invoke: async (command: string) => {
            if (command === 'local_vault_status') {
              return { unlocked: true, username: 'qa_local_user' }
            }
            if (command === 'local_get_goals') return mockGoals
            if (command === 'local_get_tasks' || command === 'local_get_missions') return mockMissions
            if (command === 'local_get_focus_sessions') return mockSessions
            if (command === 'local_get_study_resources') return []
            if (command === 'local_get_guardian_status') {
              return {
                status: 'READY',
                guardianMode: 'STANDARD',
                interventionCapability: 'LIMITED_NO_CLOSURE_CONSENT',
                standardAllowanceSeconds: 600,
                warningOnly: true,
              }
            }
            if (command === 'local_get_guardian_preferences') {
              return {
                preferredMode: 'STANDARD',
                appMonitoringConsent: true,
                applyToNewSessions: true,
                closureConsent: false,
                backgroundRuntimeConsent: false,
              }
            }
            if (command === 'local_get_discovered_apps') return []
            if (command === 'local_get_app_policies') return []
            if (command === 'local_get_system_telemetry') return null
            if (command === 'local_get_process_snapshot') return null
            return null
          },
        },
      })
    })

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
  })

  test('Contract 1: Floating Navigation Bar floats on canvas without a visible solid background slab', async ({ page }) => {
    const topBar = page.locator('.cockpit-top-bar')
    await expect(topBar).toBeVisible()

    // The topbar wrapper itself must be transparent, not a full-width background slab
    const bg = await topBar.evaluate((el) => window.getComputedStyle(el).backgroundColor)
    expect(bg).toMatch(/rgba\(0,\s*0,\s*0,\s*0\)|transparent/)

    // Floating search pill should have frosted glass styling
    const searchPill = page.locator('.top-search-command')
    await expect(searchPill).toBeVisible()
    const searchBackdrop = await searchPill.evaluate((el) => window.getComputedStyle(el).backdropFilter || (window.getComputedStyle(el) as any).webkitBackdropFilter)
    expect(searchBackdrop).not.toBe('none')

    // Dropdown menu must appear above ordinary page cards with z-index >= 1000
    const profileBtn = page.locator('.profile-badge-card')
    await profileBtn.click()
    const dropdown = page.locator('#account-dropdown-menu')
    await expect(dropdown).toBeVisible()
    const zIndex = await dropdown.evaluate((el) => parseInt(window.getComputedStyle(el).zIndex, 10))
    expect(zIndex).toBeGreaterThanOrEqual(1000)
    await page.keyboard.press('Escape')
  })

  test('Contract 2: Tasks Board outer container is frosted glass while inner Kanban columns are solid sharp surfaces', async ({ page }) => {
    const tasksBoard = page.locator('#aurora-tasks-board')
    await expect(tasksBoard).toBeVisible()

    // Outer board must have frosted glass material
    const boardBackdrop = await tasksBoard.evaluate((el) => window.getComputedStyle(el).backdropFilter || (window.getComputedStyle(el) as any).webkitBackdropFilter)
    expect(boardBackdrop).not.toBe('none')

    // Inner columns must NOT have double-glass backdrop-filter blur!
    const columns = page.locator('#aurora-tasks-board .status-column')
    const count = await columns.count()
    expect(count).toBeGreaterThanOrEqual(1)
    for (let i = 0; i < count; i++) {
      const col = columns.nth(i)
      const colBackdrop = await col.evaluate((el) => window.getComputedStyle(el).backdropFilter || (window.getComputedStyle(el) as any).webkitBackdropFilter)
      expect(colBackdrop).toBe('none')
    }
  })

  test('Contract 3: Settings Modal removes Cloud Connection from normal navigation', async ({ page }) => {
    // Open settings via account dropdown
    const profileBtn = page.locator('.profile-badge-card')
    await profileBtn.click()
    const dropdown = page.locator('#account-dropdown-menu')
    await expect(dropdown).toBeVisible()

    const allSettingsBtn = page.locator('#account-dropdown-menu button:has-text("All settings"), #account-dropdown-menu button:has-text("Appearance")').first()
    await allSettingsBtn.click()

    const modal = page.locator('.settings-modal, [role="dialog"]').first()
    await expect(modal).toBeVisible({ timeout: 5000 })

    // Cloud Connection tab should NOT be present in normal navigation
    const cloudTab = page.locator('button:has-text("Cloud Connection")')
    await expect(cloudTab).toHaveCount(0)

    // Close modal
    await page.keyboard.press('Escape')
  })

  test('Contract 4: Focus Engine HUD avoids intention collision with Start button and has balanced spacing', async ({ page }) => {
    // Navigate to Focus Engine
    const focusNav = page.locator('button[data-tut="nav-focus"], .sidebar-btn:has-text("Focus")').first()
    await focusNav.click()

    await expect(page.locator('.focus-workspace-container')).toBeVisible({ timeout: 10000 })

    // Select intention tag 'Writing & planning'
    const intentionTag = page.locator('button.intention-tag-chip:has-text("Writing & planning")')
    await expect(intentionTag).toBeVisible()
    await intentionTag.click()

    // Get bounding boxes of timer orbit core and Start Session button
    const startBtn = page.locator('button:has-text("Start 30m Session"), .btn-timer.primary')
    await expect(startBtn).toBeVisible()

    const startBtnBox = await startBtn.boundingBox()
    expect(startBtnBox).not.toBeNull()

    const intentionInTimer = page.locator('.focus-stage-task')
    await expect(intentionInTimer).toBeVisible()
    const intentionBox = await intentionInTimer.boundingBox()
    expect(intentionBox).not.toBeNull()

    // The intention text in timer MUST NOT overlap the start button!
    if (startBtnBox && intentionBox) {
      const overlap = (intentionBox.y + intentionBox.height) - startBtnBox.y
      expect(overlap).toBeLessThanOrEqual(0)
    }
  })

  test('Contract 5: Goals & Tasks toolbar controls have aligned heights and goal footer has readable text without hardcoded styles', async ({ page }) => {
    // Navigate to Goals & Tasks
    const goalsNav = page.locator('button[data-tut="nav-goals"], .sidebar-btn:has-text("Goals")').first()
    await goalsNav.click()

    await expect(page.locator('.goals-view-deck, .goals-kanban-view')).toBeVisible({ timeout: 10000 })

    // Search input and New Task button should share consistent height (within 4px)
    const searchBox = page.locator('.tasks-search-box')
    const newTaskBtn = page.locator('.goals-new-task-button')
    await expect(searchBox).toBeVisible()
    await expect(newTaskBtn).toBeVisible()

    const searchBoxRect = await searchBox.boundingBox()
    const newTaskRect = await newTaskBtn.boundingBox()
    if (searchBoxRect && newTaskRect) {
      const heightDiff = Math.abs(searchBoxRect.height - newTaskRect.height)
      expect(heightDiff).toBeLessThanOrEqual(4)
    }

    // Goal footer target date text should NOT have hardcoded #a9bfd8 color in light mode
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light')
    })
    await page.waitForTimeout(200)

    const targetDateSpan = page.locator('.goal-card-footer span').first()
    if (await targetDateSpan.isVisible()) {
      const color = await targetDateSpan.evaluate((el) => window.getComputedStyle(el).color)
      expect(color).not.toContain('rgb(169, 191, 216)')
    }
  })

  test('Contract 6: Four-theme frosted glass tokens resolve appropriate background tints and borders', async ({ page }) => {
    // 1. Aurora Dark
    await page.goto('/?v2=true&theme=dark')
    await page.waitForLoadState('networkidle')
    let glassBg = await page.evaluate(() => window.getComputedStyle(document.documentElement).getPropertyValue('--glass-surface').trim())
    expect(glassBg).toMatch(/rgba\(1[59],\s*(17|27),\s*(35|46)|#131b2e/i)

    // 2. Aurora Light
    await page.goto('/?v2=true&theme=light')
    await page.waitForLoadState('networkidle')
    glassBg = await page.evaluate(() => window.getComputedStyle(document.documentElement).getPropertyValue('--glass-surface').trim())
    expect(glassBg).toMatch(/rgba\(255,\s*255,\s*255|#ffffff/i)

    // 3. Classic Dark
    await page.goto('/?v2=false&theme=dark')
    await page.waitForLoadState('networkidle')
    glassBg = await page.evaluate(() => window.getComputedStyle(document.documentElement).getPropertyValue('--glass-surface').trim())
    expect(glassBg).toMatch(/rgba\(18,\s*(20|22),\s*(18|28)|#12161c/i)

    // 4. Classic Light
    await page.goto('/?v2=false&theme=light')
    await page.waitForLoadState('networkidle')
    glassBg = await page.evaluate(() => window.getComputedStyle(document.documentElement).getPropertyValue('--glass-surface').trim())
    expect(glassBg).toMatch(/rgba\(250,\s*248,\s*245|#faf8f5/i)
  })
})
