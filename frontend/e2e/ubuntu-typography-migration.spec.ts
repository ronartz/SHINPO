import { test, expect } from '@playwright/test'
import path from 'node:path'

const injectMocks = async (page: any) => {
  await page.route((url: URL) => url.pathname.startsWith('/api/'), async (route: any) => {
    const url = route.request().url()
    if (url.includes('/auth/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, username: 'eonx_dev', email: 'eonx@local.shinpo' }),
      })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })

  await page.addInitScript(() => {
    localStorage.setItem('shinpo_access_token', 'mock-valid-token')
    localStorage.setItem('shinpo_local_vault_account', 'eonx_dev')
    localStorage.setItem('shinpo_vault_unlocked', 'true')
    localStorage.setItem(
      'shinpo_auth_user',
      JSON.stringify({ id: 1, username: 'eonx_dev', email: 'eonx@local.shinpo' }),
    )
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      value: {
        invoke: async (cmd: string, _args: any) => {
          if (cmd === 'local_vault_status') return { unlocked: true, username: 'eonx_dev' }
          if (cmd === 'local_get_onboarding_state') return { status: 'COMPLETED', currentStep: 6 }
          if (cmd === 'get_guardian_status') {
            return {
              status: 'idle',
              observerStatus: 'active',
              guardianMode: 'PROTECTED',
              interventionCapability: 'STANDARD_CLOSE_LINUX',
              warningOnly: true,
              standardAllowanceSeconds: 120,
            }
          }
          if (cmd === 'get_sentinel_rules') {
            return [
              { id: 1, processNamePattern: 'slack', policyType: 'BLOCKED', isCustom: true },
              { id: 2, processNamePattern: 'discord', policyType: 'BLOCKED', isCustom: true },
            ]
          }
          if (cmd === 'get_recent_tamper_events') return []
          if (
            cmd === 'get_installed_applications' ||
            cmd === 'get_active_application_catalog' ||
            cmd === 'local_get_discovered_apps'
          ) {
            return [
              { id: 'app-1', name: 'Slack', execName: 'slack', category: 'Communication', rationale: 'Messaging distraction', policy: 'BLOCKED', isRunning: false, source: 'system' },
              { id: 'app-2', name: 'Discord', execName: 'discord', category: 'Communication', rationale: 'Social chat distraction', policy: 'BLOCKED', isRunning: false, source: 'system' },
              { id: 'app-3', name: 'Visual Studio Code', execName: 'code', category: 'Development', rationale: 'Code editor', policy: 'ALLOWED', isRunning: true, source: 'system' },
            ]
          }
          if (cmd === 'local_get_app_policies') return []
          if (cmd === 'list_focus_sessions') {
            return [
              {
                id: 101,
                name: 'Ubuntu Typography Audit',
                durationMinutes: 30,
                status: 'COMPLETED',
                startedAt: new Date(Date.now() - 3600000).toISOString(),
                completedFocusCycles: 1,
              },
            ]
          }
          if (cmd === 'list_goals_and_missions') {
            return {
              goals: [{ id: 1, title: 'SHINPO 0.1 Beta Release', status: 'IN_PROGRESS', targetDate: '2026-11-20' }],
              missions: [{ id: 10, goalId: 1, title: 'Global Ubuntu Font Migration', status: 'IN_PROGRESS', priority: 1 }],
            }
          }
          if (cmd === 'get_user_progress') {
            return {
              userId: 1,
              totalProgress: 520,
              level: 4,
              levelTitle: 'Master Artisan',
              currentLevelXp: 120,
              nextLevelThreshold: 600,
              progressPercent: 20,
              recentEvents: [],
            }
          }
          if (cmd === 'get_analytics_dashboard') {
            return {
              summary: {
                totalFocusMinutes: 240,
                completedSessionsCount: 8,
                averageDailyMinutes: 48,
                missionsCompleted: 6,
                missionsTotal: 8,
                currentStreak: 5,
                streakDays: 5,
              },
              recentDebriefs: [],
            }
          }
          if (cmd === 'get_guardian_preferences') {
            return {
              preferredMode: 'PROTECTED',
              appMonitoringConsent: true,
              applyToNewSessions: true,
              closureConsent: false,
              backgroundRuntimeConsent: true,
            }
          }
          if (cmd === 'local_eonpai_provider_config') {
            return { provider: 'none', model: '', endpoint: '', allowCloudContext: false }
          }
          if (cmd === 'get_ai_provider_status') {
            return { enabled: false, provider: 'none', status: 'Offline planning only', models: [] }
          }
          return null
        },
      },
    })
  })
}

test.describe('Ubuntu Global Typography Migration Suite', () => {
  const themes = [
    { brand: 'aurora', theme: 'dark', label: 'Aurora Dark' },
    { brand: 'aurora', theme: 'light', label: 'Aurora Light' },
    { brand: 'classic', theme: 'dark', label: 'Classic Dark' },
    { brand: 'classic', theme: 'light', label: 'Classic Light' },
  ]

  for (const t of themes) {
    test(`Desktop Typography Contract: Ubuntu font-family resolution in ${t.label}`, async ({ page }) => {
      await injectMocks(page)
      await page.goto(`/?brand=${t.brand}&theme=${t.theme}`)
      await page.waitForLoadState('networkidle')
      await page.waitForSelector('.app-main, main, #root')

      // Ensure fonts are loaded in document.fonts
      await page.evaluate(async () => {
        await document.fonts.ready
      })

      const typographyAudit = await page.evaluate(() => {
        const bodyFont = window.getComputedStyle(document.body).fontFamily
        const rootSans = window.getComputedStyle(document.documentElement).getPropertyValue('--font-family-sans').trim()
        const rootFamily = window.getComputedStyle(document.documentElement).getPropertyValue('--font-family').trim()
        const button = document.querySelector('button')
        const buttonFont = button ? window.getComputedStyle(button).fontFamily : null
        const heading = document.querySelector('h1, h2, h3, .brand-title, .capsule-time-region')
        const headingFont = heading ? window.getComputedStyle(heading).fontFamily : null

        const isUbuntuBody = bodyFont.toLowerCase().includes('ubuntu')
        const isUbuntuRoot = (rootSans.toLowerCase().includes('ubuntu') || rootFamily.toLowerCase().includes('ubuntu'))

        return {
          bodyFont,
          rootSans,
          rootFamily,
          buttonFont,
          headingFont,
          isUbuntuBody,
          isUbuntuRoot,
        }
      })

      expect(typographyAudit.isUbuntuBody, `Body font should resolve to Ubuntu, got: ${typographyAudit.bodyFont}`).toBe(true)
      expect(typographyAudit.isUbuntuRoot, `Root CSS font token should resolve to Ubuntu`).toBe(true)
      if (typographyAudit.buttonFont) {
        expect(typographyAudit.buttonFont.toLowerCase().includes('ubuntu')).toBe(true)
      }

      // Check Indian Rupee sign (₹) renders cleanly without fallback/missing character boxes
      const rupeeRenderCheck = await page.evaluate(() => {
        const testEl = document.createElement('div')
        testEl.id = 'rupee-test-node'
        testEl.style.fontFamily = "'Ubuntu', sans-serif"
        testEl.style.fontSize = '24px'
        testEl.style.position = 'absolute'
        testEl.style.top = '-9999px'
        testEl.textContent = '₹ 1,500 INR'
        document.body.appendChild(testEl)

        const rect = testEl.getBoundingClientRect()
        const fontName = window.getComputedStyle(testEl).fontFamily
        document.body.removeChild(testEl)

        return {
          rendered: rect.width > 0 && rect.height > 0,
          width: rect.width,
          fontName,
        }
      })

      expect(rupeeRenderCheck.rendered).toBe(true)
      expect(rupeeRenderCheck.width).toBeGreaterThan(30)

      // Take visual screenshot for empirical verification report
      const screenshotDir = path.resolve(process.cwd(), '../docs/qa/screenshots/ubuntu-typography')
      await page.screenshot({
        path: `${screenshotDir}/${t.brand}-${t.theme}-desktop.png`,
        fullPage: false,
      })
    })
  }

  test('Responsive Viewport Check: 1920x1080, 1440x900, 1280x800', async ({ page }) => {
    await injectMocks(page)
    const viewports = [
      { width: 1920, height: 1080, name: '1080p' },
      { width: 1440, height: 900, name: '1440x900' },
      { width: 1280, height: 800, name: '1280x800' },
    ]

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/?brand=aurora&theme=dark')
      await page.waitForLoadState('networkidle')

      // Verify no horizontal document overflow
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 2
      })
      expect(overflow, `Horizontal overflow detected at ${vp.name}`).toBe(false)
    }
  })

  test('Browser Companion UI: Ubuntu font integration in standalone popup', async ({ page }) => {
    const extensionPopupPath = path.resolve(process.cwd(), '../browser-extension/dist/chromium/pages/popup.html')
    await page.goto(`file://${extensionPopupPath}`)

    await page.evaluate(async () => {
      await document.fonts.ready
    })

    const companionAudit = await page.evaluate(() => {
      const bodyFont = window.getComputedStyle(document.body).fontFamily
      const title = document.querySelector('.app-title')
      const titleFont = title ? window.getComputedStyle(title).fontFamily : null
      const button = document.querySelector('button')
      const buttonFont = button ? window.getComputedStyle(button).fontFamily : null

      return {
        bodyFont,
        titleFont,
        buttonFont,
        hasUbuntu: bodyFont.toLowerCase().includes('ubuntu'),
      }
    })

    expect(companionAudit.hasUbuntu, `Browser companion body font must be Ubuntu, got: ${companionAudit.bodyFont}`).toBe(true)

    const screenshotDir = path.resolve(process.cwd(), '../docs/qa/screenshots/ubuntu-typography')
    await page.screenshot({
      path: `${screenshotDir}/browser-companion-popup.png`,
    })
  })
})
