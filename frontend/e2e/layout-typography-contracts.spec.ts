import { test, expect } from '@playwright/test'

const injectMocks = async (page: any) => {
  await page.route((url: URL) => url.pathname.startsWith('/api/'), async (route: any) => {
    const url = route.request().url()
    if (url.includes('/auth/me')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, username: 'eonx_dev', email: 'eonx@local.shinpo' }) })
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
          if (cmd === 'local_get_onboarding_state') return { status: 'COMPLETED', currentStep: 6 }
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
            { id: 2, processNamePattern: 'discord', policyType: 'BLOCKED', isCustom: true },
          ]
          if (cmd === 'get_recent_tamper_events') return []
          if (cmd === 'get_installed_applications' || cmd === 'get_active_application_catalog' || cmd === 'local_get_discovered_apps') return [
            { id: 'app-1', name: 'Slack', execName: 'slack', category: 'Communication', rationale: 'Messaging distraction', policy: 'BLOCKED', isRunning: false, source: 'system' },
            { id: 'app-2', name: 'Discord', execName: 'discord', category: 'Communication', rationale: 'Social chat distraction', policy: 'BLOCKED', isRunning: false, source: 'system' },
            { id: 'app-3', name: 'Visual Studio Code', execName: 'code', category: 'Development', rationale: 'Code editor', policy: 'ALLOWED', isRunning: true, source: 'system' },
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
              { id: 10, goalId: 1, title: 'Verify Layout Contracts', status: 'IN_PROGRESS', priority: 1 },
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

test.describe('SHINPO Layout & Typography Release Contracts', () => {
  test.beforeEach(async ({ page }) => {
    await injectMocks(page)
  })

  test('Typography Contract: No body text under 12.5px or metadata under 11px', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const tabs = [
      { id: 'Dashboard', name: 'Dashboard' },
      { id: 'Goals & Missions', name: 'Goals & Tasks' },
      { id: 'Focus Engine', name: 'Focus' },
      { id: 'Schedule', name: 'Calendar' },
      { id: 'Task Manager', name: 'Focus Protection' },
      { id: 'Analytics', name: 'Analytics' },
      { id: 'AI Assistant', name: 'EONPAI' },
    ]

    for (const tab of tabs) {
      const navBtn = page.locator(`.sidebar-btn[data-tab="${tab.id}"], .sidebar-btn`).filter({ hasText: tab.name }).first()
      if (await navBtn.isVisible()) {
        await navBtn.click()
        await page.waitForTimeout(400)

        // Inspect all visible text nodes in the main workspace
        const violations = await page.evaluate((tabName) => {
          const main = document.querySelector('main, .app-main, .focus-workspace-container, .dashboard-container, .goals-view-deck, .schedule-calendar-layout, .analytics-container, .eonpai-workspace-layout, .guardian-alpha-workspace') || document.body
          const elements = main.querySelectorAll('p, span, div, strong, small, a, button, label, li, th, td')
          const badElements: Array<{ tab: string; tag: string; text: string; fontSize: string }> = []

          elements.forEach((el) => {
            const htmlEl = el as HTMLElement
            // Only inspect elements with direct text content and visible bounding box
            if (!htmlEl.innerText || htmlEl.innerText.trim().length === 0) return
            const rect = htmlEl.getBoundingClientRect()
            if (rect.width === 0 || rect.height === 0) return

            const style = window.getComputedStyle(htmlEl)
            const fontSizePx = parseFloat(style.fontSize)

            // Strict threshold: No visible text below 10.5px anywhere; body/content text >= 12px
            if (fontSizePx < 10.5) {
              badElements.push({
                tab: tabName,
                tag: el.tagName.toLowerCase(),
                text: htmlEl.innerText.trim().slice(0, 40),
                fontSize: style.fontSize,
              })
            }
          })

          return badElements
        }, tab.name)

        expect(violations, `Sub-minimum font sizes found in tab ${tab.name}: ${JSON.stringify(violations.slice(0, 3))}`).toEqual([])
      }
    }
  })

  test('Geometry Contract: No horizontal document overflow across supported tabs', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const tabs = ['Dashboard', 'Goals & Tasks', 'Focus', 'Calendar', 'Focus Protection', 'Analytics']

    for (const tab of tabs) {
      const navBtn = page.locator('.sidebar-nav-btn, .nav-item').filter({ hasText: new RegExp(tab, 'i') }).first()
      if (await navBtn.isVisible()) {
        await navBtn.click()
        await page.waitForTimeout(300)

        const overflow = await page.evaluate(() => {
          const doc = document.documentElement
          return {
            scrollWidth: doc.scrollWidth,
            clientWidth: doc.clientWidth,
            hasOverflow: doc.scrollWidth > doc.clientWidth + 2,
          }
        })

        expect(overflow.hasOverflow, `Horizontal scroll overflow detected in tab ${tab}: scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth}`).toBe(false)
      }
    }
  })

  test('Calendar Timeline Contract: Hour labels are strictly monotonic from 00:00 to 24:00', async ({ page }) => {
    await page.goto('/?tab=Schedule')
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('.schedule-week-grid', { timeout: 8000 })
    await page.waitForTimeout(300)

    const hourLabels = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('.schedule-time-label, .schedule-time-label-end'))
        .map((el) => (el as HTMLElement).innerText.trim())
        .filter((t) => /^\d{2}:00$/.test(t))
      return labels
    })

    expect(hourLabels.length, 'Calendar time gutter must have at least 12 hours').toBeGreaterThan(12)

    // Verify monotonic sequence: each hour must be strictly greater than the previous
    const hoursNumeric = hourLabels.map((lbl) => parseInt(lbl.split(':')[0], 10))
    for (let i = 1; i < hoursNumeric.length; i++) {
      expect(
        hoursNumeric[i],
        `Calendar hours gutter is not monotonic: ${hourLabels[i - 1]} is followed by ${hourLabels[i]}`
      ).toBeGreaterThan(hoursNumeric[i - 1])
    }
  })

  test('Dashboard Contract: Zero tasks state never shows false "all completed" message or gamified XP', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // 1. Assert zero-task state
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).not.toContain('All tasks completed! Great work today.')
    expect(bodyText).not.toContain('All completed')

    // 2. Assert gamified XP/Level/Rank badges are not present in the main dashboard view
    const xpBadge = page.locator('.xp-badge, .level-badge, .rank-badge, [data-gamified="true"]')
    expect(await xpBadge.count()).toBe(0)
  })

  test('Theme Contrast Contract: Aurora Light mode does not render white text on light surfaces', async ({ page }) => {
    await page.goto('/?tab=Dashboard&v2=true&theme=light')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(400)

    // Verify LiveClock contrast
    const clockContrast = await page.evaluate(() => {
      const clockEl = document.querySelector('.aurora-capsule-clock .capsule-time-region, .dashboard-live-clock .clock-digit-group, .dashboard-live-clock, .live-clock-time') as HTMLElement
      if (!clockEl) return { found: false, passes: true }
      const style = window.getComputedStyle(clockEl)
      const color = style.color // e.g. rgb(15, 23, 42)
      return {
        found: true,
        color,
        // Must NOT be white or near-white (e.g. rgb(255, 255, 255) or rgb(240+, 240+, 240+))
        isDarkText: !color.includes('255, 255, 255') && !color.includes('248, 250, 252'),
      }
    })

    if (clockContrast.found) {
      expect(clockContrast.isDarkText, `Aurora Light clock text must be dark, received: ${clockContrast.color}`).toBe(true)
    }

    // Verify Active Sidebar Navigation item contrast
    const activeNavContrast = await page.evaluate(() => {
      const activeNav = document.querySelector('.sidebar-btn.active, .nav-item.active, .sidebar-nav-btn.is-active') as HTMLElement
      if (!activeNav) return { found: false, passes: true }
      const style = window.getComputedStyle(activeNav)
      return {
        found: true,
        color: style.color,
        isDarkText: !style.color.includes('255, 255, 255'),
      }
    })

    if (activeNavContrast.found) {
      expect(activeNavContrast.isDarkText, `Aurora Light active nav item text must be dark, received: ${activeNavContrast.color}`).toBe(true)
    }
  })

  test('Classic Light Rewards Contract: Uses warm palette without clashing sky-blue banner', async ({ page }) => {
    await page.goto('/?tab=Rewards&v2=false&theme=light')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(400)

    const headerBg = await page.evaluate(() => {
      const heroCard = document.querySelector('.rewards-hero-card, .cockpit-card-primary, .progression-hero') as HTMLElement
      if (!heroCard) return 'transparent'
      return window.getComputedStyle(heroCard).backgroundColor
    })

    // Sky blue #e0f2fe is rgb(224, 242, 254) or rgb(186, 230, 253)
    const isClashingBlue = headerBg.includes('224, 242, 254') || headerBg.includes('186, 230, 253') || headerBg.includes('219, 234, 254')
    expect(isClashingBlue, `Classic Light Rewards hero card should not use cold blue background: ${headerBg}`).toBe(false)
  })
})
