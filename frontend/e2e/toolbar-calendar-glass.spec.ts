import { test, expect } from '@playwright/test'

test.describe('TASK TOOLBAR, CALENDAR DEDUPLICATION & DASHBOARD LIQUID GLASS', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    page.on('console', msg => console.log('PAGE LOG:', msg.text()))
    await page.addInitScript(() => {
      localStorage.setItem('shinpo_local_vault_account', 'qa_local_user')
      localStorage.setItem('shinpo_auth_user', JSON.stringify({ id: 1, username: 'qa_local_user', email: 'qa@shinpo.local' }))
      localStorage.setItem('shinpo_v2_preview', 'true')
      localStorage.setItem('shinpo_onboarding_dismissed', 'true')
      localStorage.setItem('shinpo_onboarding_dismissed_1', 'true')
      localStorage.setItem('shinpo_onboarding_dismissed_user_qa_local_user', 'true')
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
            if (command === 'local_get_goals') {
              return [
                { id: 'goal-1', title: 'Ship SHINPO Beta', status: 'IN_PROGRESS', progress: 50, createdAt: '2026-11-01' }
              ]
            }
            if (command === 'local_get_tasks') {
              return [
                { id: 'task-1', goalId: 'goal-1', title: 'Complete toolbar verification', status: 'TODO', estimatedMinutes: 25 },
                { id: 'task-2', goalId: 'goal-1', title: 'Verify calendar deduplication', status: 'IN_PROGRESS', estimatedMinutes: 30 },
              ]
            }
            if (command === 'local_get_focus_sessions') {
              return [
                { id: 'sess-1', name: 'Morning Focus', status: 'COMPLETED', durationMinutes: 30, scheduledAt: new Date().toISOString() }
              ]
            }
            if (command === 'local_get_progress') {
              return { userId: 1, totalXp: 150, level: 1, levelTitle: 'Apprentice', currentStreak: 3, longestStreak: 7 }
            }
            if (command === 'local_get_study_resources') return []
            if (command === 'local_get_guardian_status') {
              return { status: 'READY', guardianMode: 'PROTECTED', warningOnly: true }
            }
            if (command === 'local_get_system_telemetry') return null
            return []
          }
        }
      })
    })
  })

  test('Part 1: Goals & Tasks action toolbar has consistent height and centered SVG icon', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-tab="Goals & Missions"]').click()
    await page.waitForSelector('.tasks-controls-right')

    const toolbar = page.locator('.tasks-controls-right')
    await expect(toolbar).toBeVisible()

    // 1. Search box, View toggle, New Task, Overflow trigger height consistency
    const searchBox = toolbar.locator('.tasks-search-box')
    const viewToggle = toolbar.locator('.view-mode-toggle')
    const newTaskBtn = toolbar.locator('.goals-new-task-button')
    const overflowTrigger = toolbar.locator('.btn-overflow-trigger')

    await expect(searchBox).toBeVisible()
    await expect(viewToggle).toBeVisible()
    await expect(newTaskBtn).toBeVisible()
    await expect(overflowTrigger).toBeVisible()

    const searchBoxHeight = await searchBox.evaluate(el => el.getBoundingClientRect().height)
    const viewToggleHeight = await viewToggle.evaluate(el => el.getBoundingClientRect().height)
    const newTaskBtnHeight = await newTaskBtn.evaluate(el => el.getBoundingClientRect().height)
    const overflowTriggerHeight = await overflowTrigger.evaluate(el => el.getBoundingClientRect().height)

    // All controls should have a consistent height around 36px-38px (within 2px)
    expect(Math.abs(newTaskBtnHeight - overflowTriggerHeight)).toBeLessThanOrEqual(2)
    expect(Math.abs(newTaskBtnHeight - viewToggleHeight)).toBeLessThanOrEqual(3)
    expect(Math.abs(newTaskBtnHeight - searchBoxHeight)).toBeLessThanOrEqual(3)

    // 2. Overflow trigger must contain an SVG icon, NOT the raw text glyph "···"
    const hasSvg = await overflowTrigger.locator('svg').count()
    expect(hasSvg).toBe(1)
    const rawText = await overflowTrigger.textContent()
    expect(rawText?.trim()).not.toBe('···')

    // 3. Overflow trigger click opens dropdown above page cards
    await overflowTrigger.click()
    const dropdown = page.locator('.overflow-menu-dropdown')
    await expect(dropdown).toBeVisible()

    const zIndex = await dropdown.evaluate(el => parseInt(window.getComputedStyle(el).zIndex || '0', 10))
    expect(zIndex).toBeGreaterThanOrEqual(50)

    // 4. Escape closes dropdown
    await page.screenshot({ path: '../docs/qa/screenshots/task-calendar-glass/01_goals_tasks_toolbar.png' })
    await page.keyboard.press('Escape')
    await expect(dropdown).not.toBeVisible()
  })

  test('Part 2: Calendar entry points are deduplicated to single Today and Schedule Focus button', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-tab="Schedule"]').click()
    await page.waitForSelector('.schedule-calendar-main')

    // 1. Today button check: Exactly ONE Today button in the calendar toolbar, no "Jump to today"
    const jumpToToday = page.locator('button:has-text("Jump to today")')
    await expect(jumpToToday).toHaveCount(0)

    const todayButtons = page.locator('.schedule-week-navigation button:has-text("Today")')
    await expect(todayButtons).toHaveCount(1)

    // 2. Primary scheduling button check: Exactly ONE primary button labeled "Schedule Focus"
    const sidebarBook = page.locator('.schedule-sidebar-book')
    await expect(sidebarBook).toHaveCount(0)

    const scheduleFocusBtn = page.locator('.schedule-btn-book')
    await expect(scheduleFocusBtn).toHaveCount(1)
    await expect(scheduleFocusBtn).toContainText('Schedule Focus')
    await page.screenshot({ path: '../docs/qa/screenshots/task-calendar-glass/02_calendar_deduplicated.png' })
  })

  test('Part 3: Dashboard cards render genuine liquid glass with backdrop blur and theme palettes', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.schedule-card')

    const scheduleCard = page.locator('.schedule-card')
    const heroCard = page.locator('.priority-hero-card')
    const rewardsCard = page.locator('.dashboard-rewards-summary')

    await expect(scheduleCard).toBeVisible()
    await expect(heroCard).toBeVisible()
    await expect(rewardsCard).toBeVisible()
    await page.screenshot({ path: '../docs/qa/screenshots/task-calendar-glass/03_dashboard_liquid_glass.png' })

    // Verify glass styles on dashboard cards
    const cardStyles = await scheduleCard.evaluate(el => {
      const win = el.ownerDocument.defaultView!
      const cs = win.getComputedStyle(el)
      return {
        className: el.className,
        backdropFilter: cs.backdropFilter || (cs as unknown as { webkitBackdropFilter: string }).webkitBackdropFilter || '',
        backgroundColor: cs.backgroundColor,
      }
    })

    expect(cardStyles.backdropFilter).toContain('blur')
    
    // Background should be translucent (alpha < 0.9)
    const match = cardStyles.backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
    expect(match).not.toBeNull()
    if (match && match[4] !== undefined) {
      const alpha = parseFloat(match[4])
      expect(alpha).toBeLessThanOrEqual(0.88)
    }
  })
})
