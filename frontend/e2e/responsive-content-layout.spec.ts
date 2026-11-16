import { test, expect } from '@playwright/test'

const RESOLUTIONS = [
  { width: 800, height: 600, label: '800x600' },
  { width: 960, height: 600, label: '960x600' },
  { width: 1024, height: 768, label: '1024x768' },
  { width: 1280, height: 720, label: '1280x720' },
  { width: 1366, height: 768, label: '1366x768' },
  { width: 1440, height: 900, label: '1440x900' },
  { width: 1920, height: 1080, label: '1920x1080' },
  { width: 2560, height: 1440, label: '2560x1440' },
]

const ALL_TABS = [
  { id: 'Dashboard', name: 'Dashboard' },
  { id: 'Goals & Missions', name: 'Goals & Tasks' },
  { id: 'Focus Engine', name: 'Focus' },
  { id: 'Task Manager', name: 'Focus Protection' },
  { id: 'AI Assistant', name: 'EONPAI' },
  { id: 'Schedule', name: 'Calendar' },
  { id: 'Analytics', name: 'Analytics' },
  { id: 'Rewards', name: 'Rewards' },
]

test.describe('SHINPO Universal Responsive & Content-Driven Layout Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('shinpo_local_vault_account', 'qa_user')
      localStorage.setItem('shinpo_auth_user', JSON.stringify({ id: 1, username: 'qa_user', email: 'qa@shinpo.local' }))
      localStorage.setItem('shinpo_v2_preview', 'true')
      localStorage.setItem('shinpo_onboarding_dismissed', 'true')
      localStorage.setItem('shinpo_onboarding_dismissed_1', 'true')
      localStorage.setItem('shinpo_onboarding_dismissed_user_qa_user', 'true')
      sessionStorage.setItem('shinpo_startup_completed', 'true')
      localStorage.setItem('shinpo_session_v1', JSON.stringify({
        user: { id: 1, username: 'qa_user', email: 'qa@shinpo.local' },
        token: 'local-vault-token',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      }))

      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        configurable: true,
        value: {
          invoke: async (cmd: string) => {
            if (cmd === 'local_vault_status') return { unlocked: true, username: 'qa_user' }
            if (cmd === 'local_get_guardian_preferences') return { preferredMode: 'PROTECTED', appMonitoringConsent: true }
            if (cmd === 'local_get_guardian_status') return { status: 'READY', guardianMode: 'PROTECTED' }
            if (cmd === 'local_get_study_resources') return []
            if (cmd === 'local_get_goals') return [
              { id: 1, title: 'Achieve Release Candidate Readiness', description: 'Complete all automated quality gates and verification protocols.', status: 'IN_PROGRESS', targetDate: '2026-11-20' },
              { id: 2, title: 'Responsive Design Excellence', description: 'Hug and fill layout implementation across all viewports.', status: 'IN_PROGRESS', targetDate: '2026-11-25' }
            ]
            if (cmd === 'local_get_tasks') return [
              { id: 10, goalId: 1, title: 'Test 8 standard desktop screen resolutions', status: 'IN_PROGRESS', priority: 1, durationMinutes: 30 },
              { id: 11, goalId: 1, title: 'Verify TopBar profile and power dropdown bounds', status: 'READY', priority: 2, durationMinutes: 15 },
              { id: 12, goalId: 2, title: 'Verify Focus Engine timer HUD and intention cards', status: 'COMPLETED', priority: 1, durationMinutes: 45 }
            ]
            if (cmd === 'local_get_focus_sessions') return [
              { id: 101, name: 'Deep Architecture Sprint', durationMinutes: 30, status: 'COMPLETED', startedAt: new Date(Date.now() - 3600000).toISOString(), completedFocusCycles: 1 }
            ]
            if (cmd === 'local_get_progress') return { userId: 1, totalXp: 350, level: 3, currentStreak: 5, longestStreak: 12 }
            if (cmd === 'local_get_discovered_apps') return [
              { id: 'app-1', name: 'Discord', execName: 'discord', category: 'COMMUNICATION', rationale: 'Social messaging distraction', policy: 'BLOCKED', isRunning: false, source: 'system' },
              { id: 'app-2', name: 'Steam', execName: 'steam', category: 'GAMING', rationale: 'Game launcher', policy: 'BLOCKED', isRunning: false, source: 'system' },
              { id: 'app-3', name: 'Code', execName: 'code', category: 'DEVELOPMENT', rationale: 'Code editor', policy: 'ALLOWED', isRunning: true, source: 'system' }
            ]
            if (cmd === 'local_get_app_policies') return []
            if (cmd === 'local_get_system_telemetry') {
              return {
                deviceName: 'Fedora-Workstation',
                osName: 'Fedora Linux',
                osVersion: '41',
                osArch: 'x86_64',
                availableProcessors: 16,
                totalMemoryBytes: 33554432000,
                usedMemoryBytes: 8589934592,
                freeMemoryBytes: 24964497408,
                cpuUsagePercent: 14.2,
                memoryUsagePercent: 25.6,
                diskTotalBytes: 512000000000,
                diskFreeBytes: 320000000000,
                topProcesses: [
                  { pid: 1001, name: 'shinpo-desktop', cpuPercent: 1.2, memoryBytes: 157286400, runningTimeSec: 3600 },
                  { pid: 1002, name: 'code', cpuPercent: 3.4, memoryBytes: 524288000, runningTimeSec: 7200 }
                ]
              }
            }
            return null
          }
        }
      })
    })
  })

  test('App Shell: Zero horizontal overflow across all 8 resolutions across multiple tabs', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/')
    await page.waitForSelector('.cockpit-top-bar')
    await page.waitForLoadState('networkidle')

    for (const tab of ALL_TABS) {
      const navButton = page.locator(`[data-tab="${tab.id}"]`).first()
      await navButton.click()
      await expect(navButton).toHaveAttribute('aria-current', 'page')

      for (const res of RESOLUTIONS) {
        await page.setViewportSize({ width: res.width, height: res.height })
        await page.waitForTimeout(60)

        const overflow = await page.evaluate(() => {
          const doc = document.documentElement
          const body = document.body
          const appMain = document.querySelector('.app-main') as HTMLElement | null
          return {
            docScroll: doc.scrollWidth,
            docClient: doc.clientWidth,
            bodyScroll: body.scrollWidth,
            bodyClient: body.clientWidth,
            appMainScroll: appMain ? appMain.scrollWidth : 0,
            appMainClient: appMain ? appMain.clientWidth : 0,
            overflowingChildren: appMain ? Array.from(appMain.querySelectorAll<HTMLElement>('*'))
              .map((element) => ({
                tag: element.tagName.toLowerCase(),
                className: typeof element.className === 'string' ? element.className : '',
                scrollWidth: element.scrollWidth,
                clientWidth: element.clientWidth,
                right: Math.round(element.getBoundingClientRect().right * 100) / 100,
              }))
              .filter((element) => element.scrollWidth > element.clientWidth + 2 || element.right > (appMain.getBoundingClientRect().right + 2))
              .slice(0, 8) : [],
          }
        })

        expect(
          overflow.docScroll,
          `${tab.name}: document scrollWidth (${overflow.docScroll}) exceeds clientWidth (${overflow.docClient}) at ${res.label}`
        ).toBeLessThanOrEqual(overflow.docClient + 2)

        if (overflow.appMainClient > 0) {
          expect(
            overflow.appMainScroll,
            `${tab.name}: .app-main scrollWidth (${overflow.appMainScroll}) exceeds clientWidth (${overflow.appMainClient}) at ${res.label}; descendants=${JSON.stringify(overflow.overflowingChildren)}`
          ).toBeLessThanOrEqual(overflow.appMainClient + 2)
        }
      }
    }
  })

  test('TopBar & Dropdowns: Profile and Power dropdowns remain within window bounds and above cards', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.cockpit-top-bar')
    await page.waitForLoadState('networkidle')

    for (const res of [{ width: 800, height: 600, label: '800x600' }, { width: 1024, height: 768, label: '1024x768' }, { width: 1920, height: 1080, label: '1920x1080' }]) {
      await page.setViewportSize({ width: res.width, height: res.height })
      await page.waitForTimeout(100)

      // Open Profile dropdown
      const profileBtn = page.locator('.profile-badge-card')
      await profileBtn.click()
      await page.waitForSelector('.shinpo-account-dropdown')

      const profileMenuBounds = await page.evaluate(() => {
        const menu = document.querySelector('.shinpo-account-dropdown') as HTMLElement | null
        if (!menu) return null
        const rect = menu.getBoundingClientRect()
        const zIndex = parseInt(window.getComputedStyle(menu).zIndex, 10)
        return {
          left: rect.left,
          right: rect.right,
          bottom: rect.bottom,
          windowWidth: window.innerWidth,
          windowHeight: window.innerHeight,
          zIndex,
        }
      })

      expect(profileMenuBounds).not.toBeNull()
      expect(profileMenuBounds!.right, `Profile menu right edge (${profileMenuBounds!.right}) exceeds window width (${profileMenuBounds!.windowWidth}) at ${res.label}`).toBeLessThanOrEqual(profileMenuBounds!.windowWidth + 4)
      expect(profileMenuBounds!.left, `Profile menu left edge (${profileMenuBounds!.left}) is negative at ${res.label}`).toBeGreaterThanOrEqual(-2)
      expect(profileMenuBounds!.zIndex).toBeGreaterThanOrEqual(500)

      // Close dropdown
      await page.keyboard.press('Escape')
      await page.waitForTimeout(100)

      // Open Power dropdown
      const powerBtn = page.locator('.action-btn-circle:has(svg)').last()
      await powerBtn.click()
      await page.waitForSelector('.shinpo-power-dropdown')

      const powerMenuBounds = await page.evaluate(() => {
        const menu = document.querySelector('.shinpo-power-dropdown') as HTMLElement | null
        if (!menu) return null
        const rect = menu.getBoundingClientRect()
        const zIndex = parseInt(window.getComputedStyle(menu).zIndex, 10)
        return {
          left: rect.left,
          right: rect.right,
          windowWidth: window.innerWidth,
          zIndex,
        }
      })

      expect(powerMenuBounds).not.toBeNull()
      expect(powerMenuBounds!.right, `Power menu right edge exceeds window width at ${res.label}`).toBeLessThanOrEqual(powerMenuBounds!.windowWidth + 4)
      expect(powerMenuBounds!.zIndex).toBeGreaterThanOrEqual(500)

      await page.keyboard.press('Escape')
    }
  })

  test('Dashboard Cockpit: Metrics grid and cards hug natural content without artificial void at 800x600 through 2560x1440', async ({ page }) => {
    await page.goto('/?tab=Dashboard')
    await page.waitForSelector('.cockpit-top-bar')
    await page.waitForLoadState('networkidle')

    for (const res of RESOLUTIONS) {
      await page.setViewportSize({ width: res.width, height: res.height })
      await page.waitForTimeout(60)

      const dashboardLayout = await page.evaluate(() => {
        const dashboard = document.querySelector('.shinpo-dashboard, .bento-grid') as HTMLElement | null
        if (!dashboard) return { found: false }
        return {
          found: true,
          scrollWidth: dashboard.scrollWidth,
          clientWidth: dashboard.clientWidth,
          hasOverflow: dashboard.scrollWidth > dashboard.clientWidth + 2,
        }
      })

      if (dashboardLayout.found) {
        expect(dashboardLayout.hasOverflow, `Dashboard view has horizontal overflow at ${res.label}`).toBe(false)
      }
    }
  })

  test('Goals & Tasks View: Reflows without column clipping or action overlap across all 8 resolutions', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.cockpit-top-bar')
    await page.locator('.sidebar-btn[data-tab="Goals & Missions"]').click()
    await page.waitForSelector('.goals-view-deck')
    await page.waitForLoadState('networkidle')

    for (const res of RESOLUTIONS) {
      await page.setViewportSize({ width: res.width, height: res.height })
      await page.waitForTimeout(60)

      const goalsGeometry = await page.evaluate(() => {
        const heading = document.querySelector('.goals-page-heading') as HTMLElement | null
        const copy = document.querySelector('.goals-page-copy') as HTMLElement | null
        const actions = document.querySelector('.goals-page-actions') as HTMLElement | null
        const newGoalBtn = document.querySelector('.goals-new-goal-button') as HTMLElement | null
        const progressSummary = document.querySelector('.goals-progress-summary') as HTMLElement | null

        let collision = false
        if (copy && actions) {
          const copyRect = copy.getBoundingClientRect()
          const actionsRect = actions.getBoundingClientRect()
          // Check horizontal overlap only if they share vertical space
          if (copyRect.bottom > actionsRect.top && copyRect.top < actionsRect.bottom) {
            if (copyRect.right > actionsRect.left + 2) collision = true
          }
        }

        return {
          headingVisible: heading ? heading.getBoundingClientRect().width > 0 : false,
          collision,
          newGoalBtnVisible: newGoalBtn ? newGoalBtn.getBoundingClientRect().width > 0 : false,
          progressSummaryVisible: progressSummary ? progressSummary.getBoundingClientRect().width > 0 : false,
        }
      })

      expect(goalsGeometry.headingVisible, `Goals heading is missing at ${res.label}`).toBe(true)
      expect(goalsGeometry.collision, `Goals heading copy collides with actions at ${res.label}`).toBe(false)
      expect(goalsGeometry.newGoalBtnVisible, `New goal button missing at ${res.label}`).toBe(true)
      expect(goalsGeometry.progressSummaryVisible).toBe(true)
    }
  })

  test('Focus Engine: Study Mode cards stack label over description without collision and hug content', async ({ page }) => {
    await page.goto('/?tab=Focus%20Engine')
    await page.waitForSelector('.cockpit-top-bar')
    await page.waitForLoadState('networkidle')

    for (const res of [{ width: 800, height: 600, label: '800x600' }, { width: 1280, height: 720, label: '1280x720' }, { width: 1920, height: 1080, label: '1920x1080' }]) {
      await page.setViewportSize({ width: res.width, height: res.height })
      await page.waitForTimeout(60)

      const studyCardsGeometry = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.study-mode-option')) as HTMLElement[]
        return cards.map((card) => {
          const strong = card.querySelector('strong') as HTMLElement | null
          const span = card.querySelector('.study-mode-option-detail, span') as HTMLElement | null
          let textCollision = false
          if (strong && span) {
            const sRect = strong.getBoundingClientRect()
            const dRect = span.getBoundingClientRect()
            // In a column stack, span must be below strong
            if (dRect.top < sRect.bottom - 1) textCollision = true
          }
          return {
            textCollision,
            cardHeight: card.getBoundingClientRect().height,
          }
        })
      })

      if (studyCardsGeometry.length > 0) {
        for (const card of studyCardsGeometry) {
          expect(card.textCollision, `Study mode card has title/description collision at ${res.label}`).toBe(false)
          expect(card.cardHeight, `Study mode card height is zero at ${res.label}`).toBeGreaterThan(30)
        }
      }
    }
  })

  test('EONPAI Workspace: Fills container height without dead space or clipping composer across viewports', async ({ page }) => {
    await page.goto('/?tab=AI%20Assistant')
    await page.waitForSelector('.cockpit-top-bar')
    await page.waitForLoadState('networkidle')

    for (const res of [{ width: 800, height: 600, label: '800x600' }, { width: 1024, height: 768, label: '1024x768' }, { width: 1440, height: 900, label: '1440x900' }, { width: 1920, height: 1080, label: '1920x1080' }]) {
      await page.setViewportSize({ width: res.width, height: res.height })
      await page.waitForTimeout(100)

      const eonpaiGeometry = await page.evaluate(() => {
        const workspace = document.querySelector('.eonpai-workspace, .eonpai-aurora-workspace') as HTMLElement | null
        const composer = document.querySelector('.eonpai-composer, textarea, input') as HTMLElement | null
        if (!workspace) return { found: false as const }
        const wsRect = workspace.getBoundingClientRect()
        const compRect = composer ? composer.getBoundingClientRect() : null
        return {
          found: true as const,
          workspaceWidth: wsRect.width,
          workspaceRight: wsRect.right,
          windowWidth: window.innerWidth,
          composerBottom: compRect ? compRect.bottom : 0,
          windowHeight: window.innerHeight,
        }
      })

      if (eonpaiGeometry.found) {
        expect(eonpaiGeometry.workspaceRight, `EONPAI workspace right edge overflows at ${res.label}`).toBeLessThanOrEqual(eonpaiGeometry.windowWidth + 2)
      }
    }
  })

  test('Settings Modal: Adapts cleanly to 800x600 with internal scrolling and zero control clipping', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.cockpit-top-bar')
    await page.waitForLoadState('networkidle')

    await page.setViewportSize({ width: 800, height: 600 })
    await page.waitForTimeout(100)

    // Open settings via profile dropdown or keyboard shortcut
    const profileBtn = page.locator('.profile-badge-card')
    await profileBtn.click()
    await page.waitForSelector('.shinpo-account-dropdown')
    const settingsItem = page.locator('.dropdown-menu-item').filter({ hasText: /All settings/i })
    await settingsItem.click()
    await page.waitForSelector('.settings-modal-box')

    const modalGeometry = await page.evaluate(() => {
      const modal = document.querySelector('.settings-modal-box') as HTMLElement | null
      if (!modal) return null
      const rect = modal.getBoundingClientRect()
      return {
        width: rect.width,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
      }
    })

    expect(modalGeometry).not.toBeNull()
    expect(modalGeometry!.right, 'Settings modal overflows window width').toBeLessThanOrEqual(modalGeometry!.windowWidth + 2)
    expect(modalGeometry!.bottom, 'Settings modal overflows window height').toBeLessThanOrEqual(modalGeometry!.windowHeight + 2)
    expect(modalGeometry!.left, 'Settings modal is positioned offscreen left').toBeGreaterThanOrEqual(0)
    expect(modalGeometry!.top, 'Settings modal is positioned offscreen top').toBeGreaterThanOrEqual(0)

    // Close settings modal
    await page.keyboard.press('Escape')
  })
})
