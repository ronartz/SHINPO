import { test, expect } from '@playwright/test'

test.describe('SHINPO — Global Scrollbar System & Goals Header Regression Acceptance', () => {
  const themes = [
    { name: 'classic-dark', query: 'v2=false&theme=dark' },
    { name: 'classic-light', query: 'v2=false&theme=light' },
    { name: 'aurora-dark', query: 'v2=true&theme=dark' },
    { name: 'aurora-light', query: 'v2=true&theme=light' },
  ]

  const setupMockEnvironment = () => {
    localStorage.setItem('shinpo_local_vault_account', 'qa_local_user')
    localStorage.setItem(
      'shinpo_auth_user',
      JSON.stringify({ id: 1, username: 'qa_local_user', email: 'qa@shinpo.local' })
    )
    localStorage.setItem('shinpo_onboarding_dismissed', 'true')
    localStorage.setItem('shinpo_onboarding_dismissed_1', 'true')
    localStorage.setItem('shinpo_onboarding_dismissed_user_qa_local_user', 'true')
    localStorage.setItem('shinpo_tutorial_completed', 'true')
    localStorage.setItem('shinpo_tutorial_dismissed', 'true')
    sessionStorage.setItem('shinpo_startup_completed', 'true')
    sessionStorage.setItem('shinpo_splash_shown', 'true')

    const mockGoals = [
      {
        id: 1,
        userId: 1,
        title: 'Deep Architecture Mastery',
        description: 'Complete standalone desktop execution engine',
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
        title: 'Verify universal scrollbar styling and token contracts',
        description: 'Ensure 8px rounded thumb, semantic active state, and scrollbar-gutter stability',
        status: 'READY',
        estimatedMinutes: 25,
        priority: 'HIGH',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 11,
        userId: 1,
        goalId: 1,
        title: 'Complete goals header eyebrow elimination verification',
        description: 'Zero redundant eyebrow occurrences in DOM across all themes and view modes',
        status: 'IN_PROGRESS',
        estimatedMinutes: 25,
        priority: 'HIGH',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]

    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {
        invoke: async (command: string) => {
          if (command === 'local_vault_status') {
            return { unlocked: true, username: 'qa_local_user' }
          }
          if (command === 'local_get_onboarding_state') return { status: 'COMPLETED', currentStep: 6 }
          if (command === 'local_platform_capabilities') {
            return {
              hasAppMonitoring: true,
              hasAppClosure: false,
              hasWindowTracking: true,
              platform: 'linux',
              warningOnlyRelease: true,
            }
          }
          if (command === 'local_get_guardian_preferences' || command === 'get_guardian_preferences') {
            return {
              preferredMode: 'PROTECTED',
              appMonitoringConsent: true,
              applyToNewSessions: true,
              closureConsent: false,
              backgroundRuntimeConsent: false,
            }
          }
          if (command === 'local_get_guardian_status' || command === 'get_guardian_status') {
            return {
              status: 'READY',
              guardianMode: 'PROTECTED',
              interventionCapability: 'LIMITED_NO_CLOSURE_CONSENT',
              standardAllowanceSeconds: 600,
              warningOnly: true,
            }
          }
          if (command === 'local_get_goals' || command === 'list_goals_and_missions') {
            return command === 'list_goals_and_missions'
              ? { goals: mockGoals, missions: mockMissions }
              : mockGoals
          }
          if (command === 'local_get_tasks') return mockMissions
          if (command === 'local_get_focus_sessions' || command === 'list_focus_sessions') return []
          if (command === 'local_get_progress' || command === 'get_user_progress') {
            return {
              userId: 1,
              totalXp: 150,
              level: 1,
              levelTitle: 'Initiate',
              currentLevelXp: 50,
              nextLevelThreshold: 200,
              progressPercent: 25,
              currentStreak: 3,
              longestStreak: 7,
              recentEvents: [],
            }
          }
          if (command === 'local_get_study_resources') return []
          if (command === 'local_get_discovered_apps') return []
          if (command === 'local_get_app_policies') return []
          if (command === 'local_eonpai_provider_config') {
            return { provider: 'none', model: '', endpoint: '', allowCloudContext: false }
          }
          if (command === 'get_ai_provider_status') {
            return {
              enabled: false,
              available: false,
              status: 'OFFLINE',
              message: 'AI service unreachable (offline fallback mode active)',
            }
          }
          return null
        },
      },
    })
  }

  for (const theme of themes) {
    test(`[${theme.name}] Goals & Tasks: absolute absence of PORTFOLIO & ROADMAP in List mode`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.addInitScript(setupMockEnvironment)
      await page.goto(`/?${theme.query}`)

      // Navigate to Goals & Tasks
      const goalsNav = page.locator('button[data-tab="Goals & Missions"]')
      await expect(goalsNav).toBeVisible({ timeout: 10000 })
      await goalsNav.click()

      // Mandatory regression check: zero occurrences of "PORTFOLIO & ROADMAP" (case-insensitive regex)
      await expect(page.getByText(/portfolio\s*&\s*roadmap/i)).toHaveCount(0)

      // Mandatory assertion: Goals & Tasks heading is visible
      const heading = page.locator('.goals-page-copy h1')
      await expect(heading).toBeVisible()
      await expect(heading).toHaveText('Goals & Tasks')
      await expect(page.getByRole('heading', { name: 'Goals & Tasks' }).first()).toBeVisible()

      // Verify page description is intact
      await expect(page.getByText('Turn your goals into focused action')).toBeVisible()

      // Verify no orphan empty spans inside goals-page-copy
      const emptySpans = await page.locator('.goals-page-copy > span').count()
      expect(emptySpans).toBe(0)
    })

    test(`[${theme.name}] Goals & Tasks: absolute absence of PORTFOLIO & ROADMAP in Board mode`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.addInitScript(setupMockEnvironment)
      await page.goto(`/?${theme.query}`)

      // Navigate to Goals & Tasks
      const goalsNav = page.locator('button[data-tab="Goals & Missions"]')
      await expect(goalsNav).toBeVisible({ timeout: 10000 })
      await goalsNav.click()

      // Switch to Kanban Board view
      const boardToggle = page.locator('.view-mode-toggle button:has-text("Board")')
      await expect(boardToggle).toBeVisible()
      await boardToggle.click()

      // Mandatory regression check: zero occurrences of "PORTFOLIO & ROADMAP" in Board mode
      await expect(page.getByText(/portfolio\s*&\s*roadmap/i)).toHaveCount(0)

      // Mandatory assertion: Goals & Tasks heading remains visible in Board mode
      const heading = page.locator('.goals-page-copy h1')
      await expect(heading).toBeVisible()
      await expect(heading).toHaveText('Goals & Tasks')
      await expect(page.getByRole('heading', { name: 'Goals & Tasks' }).first()).toBeVisible()

      // Verify Kanban board columns rendered properly
      const kanbanBoard = page.locator('.kanban-board-grid, .missions-board-container, .goals-task-area')
      await expect(kanbanBoard).toBeVisible()
    })

    test(`[${theme.name}] Global Scrollbar: theme token integrity, scrollbar-gutter and container compliance`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.addInitScript(setupMockEnvironment)
      await page.goto(`/?${theme.query}`)
      await page.waitForSelector('.app-shell', { timeout: 10000 })

      // 1. Verify semantic scrollbar tokens are computed and defined on :root / html
      const scrollbarTokens = await page.evaluate(() => {
        const style = window.getComputedStyle(document.documentElement)
        return {
          track: style.getPropertyValue('--scrollbar-track').trim(),
          thumb: style.getPropertyValue('--scrollbar-thumb').trim(),
          thumbHover: style.getPropertyValue('--scrollbar-thumb-hover').trim(),
          thumbActive: style.getPropertyValue('--scrollbar-thumb-active').trim(),
        }
      })

      expect(scrollbarTokens.thumb.length).toBeGreaterThan(0)
      expect(scrollbarTokens.thumbHover.length).toBeGreaterThan(0)
      expect(scrollbarTokens.thumbActive.length).toBeGreaterThan(0)

      // 2. Verify .app-main has scrollbar-gutter: stable to prevent layout shifting
      const appMainStyles = await page.evaluate(() => {
        const el = document.querySelector('.app-main')
        if (!el) return null
        const s = window.getComputedStyle(el)
        return {
          scrollbarGutter: s.scrollbarGutter,
          overflowX: s.overflowX,
          overflowY: s.overflowY,
          scrollbarWidth: s.scrollbarWidth,
        }
      })

      expect(appMainStyles).not.toBeNull()
      expect(appMainStyles?.scrollbarGutter).toContain('stable')
      expect(appMainStyles?.overflowX).toBe('hidden')

      // 3. Verify horizontal overflow is absent
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth
      })
      expect(hasHorizontalOverflow).toBe(false)
    })
  }
})
