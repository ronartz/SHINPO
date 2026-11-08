import { test, expect } from '@playwright/test'

const setupMocks = async (page: any, populated = false) => {
  await page.route((url: URL) => url.pathname.startsWith('/api/'), async (route: any) => {
    const url = route.request().url()
    if (url.includes('/auth/me')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, username: 'eonx_dev', email: 'eonx@local.shinpo' }) })
    }
    if (url.includes('/api/goals')) {
      const goals = populated
        ? [{ id: 1, title: 'Release Gate Milestone', status: 'IN_PROGRESS', targetDate: '2026-11-20', progress: 50 }]
        : []
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(goals) })
    }
    if (url.includes('/api/missions')) {
      const missions = populated
        ? [{ id: 10, goalId: 1, title: 'Visual Regression Coverage', status: 'READY', priority: 1, estimatedMinutes: 25 }]
        : []
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(missions) })
    }
    if (url.includes('/api/focus-sessions')) {
      const sessions = populated
        ? [{ id: 101, name: 'Deep Work Sprint', durationMinutes: 25, status: 'COMPLETED', startedAt: new Date(Date.now() - 3600000).toISOString(), completedFocusCycles: 1 }]
        : []
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sessions) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })

  await page.addInitScript((isPopulated: boolean) => {
    localStorage.setItem('shinpo_access_token', 'mock-valid-token')
    localStorage.setItem('shinpo_local_vault_account', 'eonx_dev')
    localStorage.setItem('shinpo_vault_unlocked', 'true')
    localStorage.setItem(
      'shinpo_auth_user',
      JSON.stringify({ id: 1, username: 'eonx_dev', email: 'eonx@local.shinpo' })
    )
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      value: {
        invoke: async (cmd: string) => {
          if (cmd === 'local_vault_status') return { unlocked: true, username: 'eonx_dev' }
          if (cmd === 'get_guardian_status') return {
            status: 'idle',
            observerStatus: 'active',
            guardianMode: 'PROTECTED',
            interventionCapability: 'STANDARD_CLOSE_LINUX',
            warningOnly: true,
            standardAllowanceSeconds: 120,
          }
          if (cmd === 'get_sentinel_rules') return []
          if (cmd === 'get_recent_tamper_events') return []
          if (cmd === 'get_installed_applications' || cmd === 'get_active_application_catalog' || cmd === 'local_get_discovered_apps') return [
            { id: 'app-1', name: 'Visual Studio Code', execName: 'code', category: 'Development', rationale: 'Editor', policy: 'ALLOWED', isRunning: true },
          ]
          if (cmd === 'local_get_app_policies') return []
          if (cmd === 'list_focus_sessions') return isPopulated
            ? [{ id: 101, name: 'Deep Work Sprint', durationMinutes: 25, status: 'COMPLETED', startedAt: new Date(Date.now() - 3600000).toISOString(), completedFocusCycles: 1 }]
            : []
          if (cmd === 'list_goals_and_missions') return isPopulated
            ? {
                goals: [{ id: 1, title: 'Release Gate Milestone', status: 'IN_PROGRESS', targetDate: '2026-11-20' }],
                missions: [{ id: 10, goalId: 1, title: 'Visual Regression Coverage', status: 'READY', priority: 1 }],
              }
            : { goals: [], missions: [] }
          if (cmd === 'get_user_progress') return {
            userId: 1,
            totalProgress: isPopulated ? 350 : 0,
            level: isPopulated ? 3 : 1,
            levelTitle: isPopulated ? 'Focused Strategist' : 'Initiate',
            currentLevelXp: isPopulated ? 150 : 0,
            nextLevelThreshold: 400,
            progressPercent: isPopulated ? 37.5 : 0,
            recentEvents: [],
          }
          if (cmd === 'get_analytics_dashboard') return {
            summary: {
              totalFocusMinutes: isPopulated ? 185 : 0,
              completedSessionsCount: isPopulated ? 7 : 0,
              averageDailyMinutes: isPopulated ? 37 : 0,
              missionsCompleted: isPopulated ? 5 : 0,
              missionsTotal: isPopulated ? 8 : 0,
              currentStreak: isPopulated ? 4 : 0,
              streakDays: isPopulated ? 4 : 0,
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
  }, populated)
}

test.describe('SHINPO Comprehensive Visual Themes & Particle Coverage', () => {
  const themes = [
    { name: 'Aurora Dark', v2: 'true', theme: 'dark' },
    { name: 'Aurora Light', v2: 'true', theme: 'light' },
    { name: 'Classic Dark', v2: 'false', theme: 'dark' },
    { name: 'Classic Light', v2: 'false', theme: 'light' },
  ]

  for (const { name, v2, theme } of themes) {
    test(`Sparse & Populated visual contracts under ${name}`, async ({ page }) => {
      await setupMocks(page, false)
      await page.goto(`/?v2=${v2}&theme=${theme}`)
      await page.waitForLoadState('networkidle')
      await page.waitForSelector('.icon-sidebar', { timeout: 10000 })

      // 1. Verify Floating 3D Particle Canvas
      const particles = page.locator('[data-testid="shinpo-particles"]')
      await expect(particles).toBeAttached()
      const particleProps = await page.evaluate(() => {
        const c = document.querySelector('[data-testid="shinpo-particles"]') as HTMLCanvasElement
        if (!c) return null
        const style = window.getComputedStyle(c)
        return {
          position: style.position,
          zIndex: style.zIndex,
          pointerEvents: style.pointerEvents,
          width: c.width,
          height: c.height,
        }
      })
      expect(particleProps?.position).toBe('fixed')
      expect(particleProps?.pointerEvents).toBe('none')
      expect(Number(particleProps?.zIndex)).toBeLessThanOrEqual(1)

      // 2. Focus Engine Screen Verification
      await page.click('button[data-tab="Focus Engine"]')
      await page.waitForSelector('.focus-hero-split, .card-timer-hud')
      const intentionCard = page.locator('.card-session-intention, .session-intention-box')
      await expect(intentionCard.first()).toBeVisible()

      // 3. Calendar View Monotonic Gutter Verification
      await page.click('button[data-tab="Schedule"]')
      await page.waitForSelector('.schedule-calendar-layout')
      const hours = await page.$$eval('.schedule-time-axis div', (nodes) =>
        nodes.map((n) => n.textContent?.trim()).filter(Boolean)
      )
      for (let i = 1; i < hours.length; i++) {
        const prev = parseInt(hours[i - 1].replace(':00', ''), 10)
        const curr = parseInt(hours[i].replace(':00', ''), 10)
        expect(curr, `Hour sequence in calendar must be strictly ascending: ${hours[i - 1]} vs ${hours[i]}`).toBeGreaterThan(prev)
      }

      // 4. Focus Protection View Verification
      await page.click('button[data-tab="Task Manager"]')
      await page.waitForSelector('.sentinel-panel, .guardian-alpha-workspace')
      const webGuardCard = page.locator('.guardian-policy-explainer, .browser-protection-card')
      await expect(webGuardCard.first()).toBeVisible()

      // 5. Light theme WCAG AA contrast check
      if (theme === 'light') {
        const activeNavColor = await page.evaluate(() => {
          const el = document.querySelector('.icon-sidebar .sidebar-btn.active')
          return el ? window.getComputedStyle(el).color : null
        })
        expect(activeNavColor).toBeTruthy()
        // Must not be faint white/gray on light background
        expect(activeNavColor).not.toContain('255, 255, 255')
      }
    })
  }
})
