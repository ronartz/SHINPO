import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const SNAPSHOTS_DIR = path.resolve('../docs/qa/screenshots/final-visual-defect-closure-20261110-acceptance')
fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true })

test.describe('Phase 3 Priority Inspection Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('shinpo_splash_shown', 'true')
      sessionStorage.setItem('shinpo_startup_completed', 'true')
      localStorage.setItem('shinpo_access_token', 'mock_jwt_token_for_visual_qa')
      localStorage.setItem('shinpo_local_vault_account', 'visual_qa_lead')
      localStorage.setItem('shinpo_vault_unlocked', 'true')
      localStorage.setItem('shinpo_tutorial_completed', 'true')
      localStorage.setItem('shinpo_interactive_tutorial_dismissed', 'true')
      localStorage.setItem('shinpo_interactive_tutorial_dismissed_1', 'true')
      localStorage.setItem('shinpo_interactive_tutorial_dismissed_user_visual_qa_lead', 'true')
      localStorage.setItem('shinpo_onboarding_dismissed', 'true')
      localStorage.setItem('shinpo_onboarding_dismissed_1', 'true')
      localStorage.setItem('shinpo_onboarding_dismissed_user_visual_qa_lead', 'true')
      localStorage.setItem('shinpo_auth_user', JSON.stringify({
        id: 1,
        username: 'visual_qa_lead',
        email: 'visual.qa@shinpo.local',
      }))
      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        value: {
          invoke: async (cmd: string) => {
            if (cmd === 'local_vault_status') return { unlocked: true, username: 'visual_qa_lead' }
            if (cmd === 'get_guardian_status' || cmd === 'local_get_guardian_status') return {
              status: 'READY',
              daemonConnected: true,
              observerStatus: 'ready',
              guardianMode: 'PROTECTED',
              interventionCapability: 'LIMITED_NO_CLOSURE_CONSENT',
              warningOnly: true,
              standardAllowanceSeconds: 0,
              activeFocusSessionId: null,
              activeFocusSessionName: null,
              focusPhase: null,
              observationsToday: 0,
              lastObservationAt: null,
              appCatalogVersion: '1.0',
              domainCatalogVersion: '1.0',
              applicationPolicyStatus: 'LIMITED_NO_CLOSURE_CONSENT',
              applicationCatalog: [],
            }
            if (cmd === 'local_get_guardian_observations') return []
            if (cmd === 'get_installed_applications' || cmd === 'get_active_application_catalog' || cmd === 'local_get_discovered_apps') {
              return Array.from({ length: 78 }).map((_, i) => ({
                id: `app-${i + 1}`,
                name: i === 0 ? 'Akregator' : i === 1 ? 'Ark' : i === 2 ? 'btop++' : `App ${i + 1}`,
                execName: i === 0 ? 'akregator' : i === 1 ? 'ark' : i === 2 ? 'btop' : `app${i + 1}`,
                category: 'system',
                rationale: 'System utility',
                policy: 'NONE',
                isRunning: i === 2,
              }))
            }
            if (cmd === 'local_get_goals') return [
              { id: 1, title: 'High-Performance Personal Operating System', description: 'Deliver zero-lag desktop execution', targetDate: '2026-11-20', progress: 88, color: '#3B82F6', status: 'ACTIVE' },
              { id: 2, title: 'Cognitive Endurance & Deep Work Habituation', description: 'Daily 90-minute uninterrupted synthesis', targetDate: '2026-12-31', progress: 64, color: '#10B981', status: 'ACTIVE' },
            ]
            if (cmd === 'local_get_tasks') return [
              { id: 101, goalId: 1, title: 'Automated Visual Regression and Geometry Verification', description: 'Ensure zero physical text collisions', status: 'IN_PROGRESS', priority: 'HIGH', estimatedMinutes: 30 },
              { id: 102, goalId: 1, title: 'Audit Guardian Process Identity Contracts', description: 'Validate Linux pidfd_open checks', status: 'READY', priority: 'HIGH', estimatedMinutes: 45 },
            ]
            if (cmd === 'local_get_focus_sessions') {
              const today = new Date()
              const at = (hour: number, minute: number) => {
                const date = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour, minute)
                return date.toISOString()
              }
              if (new URLSearchParams(window.location.search).has('analytics-fixture')) {
                return Array.from({ length: 7 }, (_, index) => {
                  const ended = new Date(today.getFullYear(), today.getMonth(), today.getDate() - index, 16 + index % 4, 30)
                  const iso = ended.toISOString()
                  return { id: 990 + index, userId: 1, goalId: 1, missionId: 101, name: `Visual QA focus ${index + 1}`, intention: 'Inspect analytics layout', durationMinutes: 25, status: 'COMPLETED', scheduledAt: null, startedAt: new Date(ended.getTime() - 25 * 60_000).toISOString(), pausedAt: null, accumulatedPausedSeconds: 0, activeSeconds: (18 + index * 7) * 60, endedAt: iso, createdAt: iso, updatedAt: iso, completionQuality: 4, accomplishment: 'Synthetic visual fixture', reflectionNote: 'Synthetic QA data only' }
                })
              }
              if (!new URLSearchParams(window.location.search).has('overlap-fixture')) return []
              return [
                { id: 901, userId: 1, goalId: null, missionId: null, name: 'One minute stagger', intention: null, durationMinutes: 50, status: 'SCHEDULED', scheduledAt: at(17, 59), startedAt: null, pausedAt: null, accumulatedPausedSeconds: 0, activeSeconds: 0, endedAt: null, createdAt: at(17, 59), updatedAt: at(17, 59) },
                { id: 902, userId: 1, goalId: null, missionId: null, name: 'Long overlapping session', intention: null, durationMinutes: 90, status: 'SCHEDULED', scheduledAt: at(18, 0), startedAt: null, pausedAt: null, accumulatedPausedSeconds: 0, activeSeconds: 0, endedAt: null, createdAt: at(18, 0), updatedAt: at(18, 0) },
              ]
            }
            return { ok: true }
          },
        },
      })
    })

    await page.route((url: URL) => url.pathname.startsWith('/api/'), async (route: any) => {
      const u = route.request().url()
      if (u.includes('/auth/me')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, username: 'visual_qa_lead', email: 'visual.qa@shinpo.local' }) })
      if (u.includes('/api/goals')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
      if (u.includes('/api/missions')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
      if (u.includes('/api/focus-sessions')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
      if (u.includes('/api/analytics')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ summary: {}, weeklyVelocity: [], recentDebriefs: [] }) })
      if (u.includes('/api/device/sentinel/status')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'READY', observerStatus: 'ready', guardianMode: 'PROTECTED', warningOnly: true, interventionCapability: 'LIMITED_NO_CLOSURE_CONSENT' }) })
      if (u.includes('/api/device/sentinel/rules')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    })
  })

  test('Schedule task select stays anchored to its field inside the dialog', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/?tab=Schedule&v2=false&theme=dark')
    await page.waitForSelector('.icon-sidebar', { timeout: 10000 })
    await page.locator('.schedule-btn-book').first().click()

    const trigger = page.locator('#schedule-session-task-select')
    await expect(trigger).toBeVisible()
    await trigger.click()
    const menu = page.locator('.shinpo-select-popover')
    await expect(menu).toBeVisible()
    // Measure after the entrance transform finishes so geometry reflects its
    // settled position rather than the intentional scale animation frame.
    await expect(menu).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)')

    const triggerBox = await trigger.boundingBox()
    const menuBox = await menu.boundingBox()
    expect(triggerBox).not.toBeNull()
    expect(menuBox).not.toBeNull()
    expect(Math.abs(menuBox!.x - triggerBox!.x), 'popover left edge should align with select trigger').toBeLessThanOrEqual(2)
    expect(menuBox!.y, 'popover should open below trigger when sufficient space exists').toBeGreaterThanOrEqual(triggerBox!.y + triggerBox!.height)
  })

  test('Calendar keeps 17:59 and 18:00 overlapping sessions readable', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/?tab=Schedule&v2=false&theme=dark&overlap-fixture=1')
    await page.waitForLoadState('networkidle')
    const fontFamily = await page.locator('.schedule-toolbar-title h1').evaluate((element) => getComputedStyle(element).fontFamily)
    expect(fontFamily, 'calendar typography should use SHINPO’s bundled font').toContain('Nunito')
    const events = page.locator('.schedule-grid-event')
    const overlapTitle = events.first().locator('.schedule-grid-event-title')
    await expect(overlapTitle).toHaveCSS('white-space', 'normal')
    await expect(events).toHaveCount(2)
    const first = await events.nth(0).boundingBox()
    const second = await events.nth(1).boundingBox()
    expect(first).not.toBeNull()
    expect(second).not.toBeNull()
    expect(Math.abs(first!.x - second!.x), 'overlapping events must occupy distinct horizontal lanes').toBeGreaterThan(20)
    expect(first!.x + first!.width, 'overlapping event cards must not intersect horizontally').toBeLessThanOrEqual(second!.x + 1)
    await expect(events.nth(0).locator('.schedule-grid-event-title')).toHaveCSS('text-overflow', 'ellipsis')
    await page.screenshot({ path: path.join(SNAPSHOTS_DIR, '03_calendar_overlapping_sessions_1440x900.png') })
  })

  test('Focus Engine: Measure Session Intention card void and Guardian Mode button composition', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/?v2=true&theme=dark')
    await page.waitForLoadState('networkidle')

    const focusTab = page.locator('[data-tab="Focus Engine"]').first()
    await focusTab.click()
    await page.waitForTimeout(600)

    // Capture Focus Engine screenshot
    await page.screenshot({ path: path.join(SNAPSHOTS_DIR, '01_focus_engine_1440x900.png') })

    const orbitBox = await page.locator('.focus-time-orbit').boundingBox()
    expect(orbitBox?.width ?? 0, 'desktop Focus timer should have enough visual weight').toBeGreaterThanOrEqual(320)
    await expect(page.locator('.timer-plan-preview, .pomodoro-config-summary')).toHaveCount(1)
    await expect(page.locator('.card-session-creator')).toContainText('Guardian is warning-only in this release')

    // Measure Session Intention card height and spacing
    const intentionCard = page.locator('.card-session-intention')
    await expect(intentionCard).toBeVisible()
    const intentionBox = await intentionCard.boundingBox()
    console.log('Session Intention Card BoundingBox:', intentionBox)

    const tagsRow = page.locator('.intention-quick-tags')
    const footer = page.locator('.intention-guidance-footer')
    const tagsBox = await tagsRow.boundingBox()
    const footerBox = await footer.boundingBox()

    const voidGap = footerBox && tagsBox ? footerBox.y - (tagsBox.y + tagsBox.height) : 0
    console.log(`Gap between quick-tags and guidance footer: ${voidGap}px`)

    // Measure Guardian mode buttons
    const guardianButtons = page.locator('.card-session-creator .study-mode-option')
    const buttonCount = await guardianButtons.count()
    console.log(`Guardian mode buttons count: ${buttonCount}`)
    for (let i = 0; i < buttonCount; i++) {
      const btn = guardianButtons.nth(i)
      const btnBox = await btn.boundingBox()
      const text = await btn.innerText()
      console.log(`Button ${i} (${text.replace(/\n/g, ' ')}): height = ${btnBox?.height}px`)
    }
  })

  test('Focus Protection: Measure Installed Applications header, badge, and sidebar balance', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/?tab=Task%20Manager&v2=true&theme=dark')
    await page.waitForLoadState('networkidle')

    const installedPanel = page.locator('.guardian-installed-panel')
    await expect(installedPanel).toBeVisible({ timeout: 10000 })

    const guardianHeader = page.locator('.guardian-alpha-header')
    const guardianTabs = page.locator('.guardian-subtab-bar')
    const headerBox = await guardianHeader.boundingBox()
    const tabsBox = await guardianTabs.boundingBox()
    expect(tabsBox!.y - (headerBox!.y + headerBox!.height), 'Guardian tabs should stay grouped with the page heading').toBeLessThanOrEqual(24)

    await page.screenshot({ path: path.join(SNAPSHOTS_DIR, '02_focus_protection_1440x900.png') })

    const badge = page.locator('.guardian-installed-panel header .guardian-alpha-count')
    const badgeText = await badge.innerText()
    console.log(`Installed Applications header badge text: "${badgeText}"`)

    const infoColumn = page.locator('.guardian-alpha-info-column')
    const infoBox = await infoColumn.boundingBox()
    const panelBox = await installedPanel.boundingBox()
    console.log('Left info column box:', infoBox)
    console.log('Right installed panel box:', panelBox)
  })

  test('Dashboard Classic Light: Measure translucent glass and background particles visibility', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/?v2=false&theme=light')
    await page.waitForLoadState('networkidle')

    await page.screenshot({ path: path.join(SNAPSHOTS_DIR, '03_classic_light_dashboard_1440x900.png') })

    const bentoCard = page.locator('.bento-card').first()
    if (await bentoCard.count() > 0) {
      const styles = await bentoCard.evaluate((el) => {
        const cs = window.getComputedStyle(el)
        return {
          background: cs.background,
          backdropFilter: cs.backdropFilter || (cs as any).webkitBackdropFilter,
          border: cs.border,
          boxShadow: cs.boxShadow,
        }
      })
      console.log('Classic Light bento-card computed styles:', styles)
    }
  })

  test('Goals & Tasks / Calendar: Inspect controls, label contrast, and geometry', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/?tab=Goals%20%26%20Missions&v2=false&theme=light')
    await page.waitForLoadState('networkidle')

    const overflowBtns = page.locator('.btn-overflow-trigger')
    const count = await overflowBtns.count()
    console.log('overflowBtns count:', count)
    for (let i = 0; i < count; i++) {
      const btn = overflowBtns.nth(i)
      const box = await btn.boundingBox()
      const _html = await btn.innerHTML()
      const svgDetails = await btn.evaluate((el) => {
        const svg = el.querySelector('svg')
        const matchingRules: string[] = []
        if (svg) {
          for (const sheet of Array.from(document.styleSheets)) {
            try {
              for (const rule of Array.from(sheet.cssRules)) {
                const styleRule = rule as CSSStyleRule
                if (styleRule.selectorText && svg.matches(styleRule.selectorText) && styleRule.cssText.includes('width')) {
                  matchingRules.push(styleRule.cssText)
                }
              }
            } catch (_) {
              // Ignore cross-origin stylesheet access restrictions
            }
          }
        }
        return {
          matchingRules,
          svgBox: svg?.getBoundingClientRect(),
          svgAttrWidth: svg?.getAttribute('width'),
          svgComputedWidth: svg ? window.getComputedStyle(svg).width : null,
        }
      })
      console.log(`Button ${i}:`, box, svgDetails)
    }

    await page.screenshot({ path: path.join(SNAPSHOTS_DIR, '04_goals_light_1440x900.png') })

    await page.goto('/?tab=Schedule&v2=false&theme=light')
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: path.join(SNAPSHOTS_DIR, '05_schedule_light_1440x900.png') })
  })

  test('Dashboard board spacing and primary document scrollbar use intentional geometry', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/?v2=true&theme=dark')
    await page.waitForLoadState('networkidle')
    const board = page.locator('.flight-deck-board-panel').first()
    await expect(board).toBeVisible()
    const previous = board.locator('xpath=preceding-sibling::*[1]')
    const previousBox = await previous.boundingBox()
    const boardBox = await board.boundingBox()
    if (previousBox && boardBox) {
      expect(boardBox.y - (previousBox.y + previousBox.height), 'Tasks Board should read as a separate dashboard section').toBeGreaterThanOrEqual(20)
    }
    const horizontalOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(horizontalOverflow, 'Dashboard should not introduce horizontal document overflow').toBe(false)
    const layout = await page.evaluate(() => {
      const lanes = Array.from(document.querySelectorAll<HTMLElement>('.dashboard-lane-grid > .status-column'))
      const main = document.querySelector<HTMLElement>('.app-main')
      const shell = document.querySelector<HTMLElement>('.app-shell')
      return {
        laneHeights: lanes.map((lane) => Math.round(lane.getBoundingClientRect().height)),
        shellScrolls: Boolean(shell && shell.scrollHeight > shell.clientHeight + 1),
        mainScrolls: Boolean(main && main.scrollHeight > main.clientHeight + 1),
      }
    })
    console.log('Dashboard lane heights / scroll owners:', layout)
    await page.screenshot({ path: path.join(SNAPSHOTS_DIR, '08_dashboard_top_1280x720.png') })
    await page.locator('.flight-deck-board-panel').scrollIntoViewIfNeeded()
    await page.waitForTimeout(700)
    await page.locator('.flight-deck-board-panel').screenshot({ path: path.join(SNAPSHOTS_DIR, '08_dashboard_board_1280x720.png') })
  })

  test('Goals & Tasks hierarchy fits compact desktop without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/?tab=Goals%20%26%20Missions&v2=true&theme=dark')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: 'Goals & Tasks' }).last()).toBeVisible()
    await expect(page.locator('.app-main').getByText('Goals', { exact: true })).toBeVisible()
    await expect(page.locator('.app-main').getByText('Tasks', { exact: true })).toBeVisible()
    const particles = page.locator('canvas.shinpo-particles')
    await expect(particles).toHaveCount(1)
    await expect(particles).toHaveCSS('pointer-events', 'none')
    const geometry = await page.evaluate(() => ({
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      viewportWidth: document.documentElement.clientWidth,
      contentWidth: document.querySelector<HTMLElement>('.app-main')?.getBoundingClientRect().width ?? 0,
    }))
    expect(geometry.horizontalOverflow, 'Goals & Tasks must fit without horizontal page scrolling').toBe(false)
    expect(geometry.contentWidth).toBeLessThanOrEqual(geometry.viewportWidth)
    await page.screenshot({ path: path.join(SNAPSHOTS_DIR, '09_goals_tasks_aurora_dark_1280x720.png') })
  })

  test('Analytics charts render from an isolated persisted-session fixture', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/?tab=Analytics&v2=true&theme=dark&analytics-fixture=1')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: 'Analytics' }).last()).toBeVisible()
    await expect(page.locator('.analytics-activity-chart')).toBeVisible()
    await expect(page.locator('.analytics-bucket-group')).toHaveCount(7)
    await page.screenshot({ path: path.join(SNAPSHOTS_DIR, '10_analytics_aurora_dark_1440x900.png') })
    await page.screenshot({ path: path.join(SNAPSHOTS_DIR, '10_analytics_full_aurora_dark.png'), fullPage: true })
  })

  test('Classic Dark Dashboard and Goals keep the Classic surface palette at compact desktop width', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/?v2=false&theme=dark')
    await page.waitForLoadState('networkidle')
    const dashboardOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(dashboardOverflow, 'Classic dashboard should not overflow horizontally').toBe(false)
    await page.screenshot({ path: path.join(SNAPSHOTS_DIR, '11_classic_dashboard_dark_1280x720.png') })

    await page.goto('/?tab=Goals%20%26%20Missions&v2=false&theme=dark')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: 'Goals & Tasks' }).last()).toBeVisible()
    const newGoalButton = page.getByRole('button', { name: 'New Goal' })
    const buttonColors = await newGoalButton.evaluate((button) => ({
      background: getComputedStyle(button).backgroundColor,
      expected: (() => {
        const probe = document.createElement('span')
        probe.style.backgroundColor = 'var(--color-primary)'
        document.body.append(probe)
        const value = getComputedStyle(probe).backgroundColor
        probe.remove()
        return value
      })(),
      foreground: getComputedStyle(button).color,
      expectedForeground: (() => {
        const probe = document.createElement('span')
        probe.style.color = 'var(--color-on-primary)'
        document.body.append(probe)
        const value = getComputedStyle(probe).color
        probe.remove()
        return value
      })(),
    }))
    expect(buttonColors.background, 'Classic primary actions should use the active Classic color token').toBe(buttonColors.expected)
    expect(buttonColors.foreground, 'Classic primary actions should use the active on-primary token').toBe(buttonColors.expectedForeground)
    const goalsOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(goalsOverflow, 'Classic Goals & Tasks should not overflow horizontally').toBe(false)
    await page.screenshot({ path: path.join(SNAPSHOTS_DIR, '12_classic_goals_dark_1280x720.png') })
  })

  test('EONPAI and Settings Modal: Inspect chip collisions, scrolling, and modal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/?tab=AI%20Assistant&v2=true&theme=dark')
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: path.join(SNAPSHOTS_DIR, '06_eonpai_dark_1440x900.png') })

    const settingsBtn = page.getByRole('button', { name: 'Open AI settings', exact: true })
    await expect(settingsBtn, 'Offline EONPAI state should expose its actual AI settings entry point').toBeVisible()
    await settingsBtn.click()
    const settingsDialog = page.getByRole('dialog', { name: /SHINPO Settings/i })
    await expect(settingsDialog).toBeVisible()
    const provider = settingsDialog.locator('#native-ai-provider')
    await expect(provider).toBeVisible()
    await provider.click()
    const menu = page.locator('.shinpo-select-popover')
    await expect(menu).toBeVisible()
    await expect(menu).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)')
    const triggerBox = await provider.boundingBox()
    const menuBox = await menu.boundingBox()
    expect(triggerBox).not.toBeNull()
    expect(menuBox).not.toBeNull()
    expect(Math.abs(menuBox!.x - triggerBox!.x), 'provider menu should stay aligned inside its settings dialog').toBeLessThanOrEqual(2)
    await page.screenshot({ path: path.join(SNAPSHOTS_DIR, '07_settings_modal_1440x900.png') })
    await page.keyboard.press('Escape')
  })
})
