import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const SNAPSHOTS_DIR = path.resolve('../docs/qa/screenshots/phase3-inspection')
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
            if (cmd === 'local_get_focus_sessions') return []
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

  test('Focus Engine: Measure Session Intention card void and Guardian Mode button composition', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/?v2=true&theme=dark')
    await page.waitForLoadState('networkidle')

    const focusTab = page.locator('[data-tab="Focus Engine"]').first()
    await focusTab.click()
    await page.waitForTimeout(600)

    // Capture Focus Engine screenshot
    await page.screenshot({ path: path.join(SNAPSHOTS_DIR, '01_focus_engine_1440x900.png') })

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

  test('EONPAI and Settings Modal: Inspect chip collisions, scrolling, and modal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/?tab=AI%20Assistant&v2=true&theme=dark')
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: path.join(SNAPSHOTS_DIR, '06_eonpai_dark_1440x900.png') })

    const settingsBtn = page.locator('.icon-sidebar .sidebar-utility-actions [aria-label="Settings"]').first()
    if (await settingsBtn.count() > 0) {
      await settingsBtn.click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: path.join(SNAPSHOTS_DIR, '07_settings_modal_1440x900.png') })
    }
  })
})
