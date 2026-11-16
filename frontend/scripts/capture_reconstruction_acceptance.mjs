import { chromium } from 'playwright'
import { mkdirSync, existsSync, statSync, readFileSync } from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const LOCAL_DIR = path.resolve('docs/qa/screenshots/reconstruction')
const ARTIFACT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/reconstruction'

mkdirSync(LOCAL_DIR, { recursive: true })
mkdirSync(ARTIFACT_DIR, { recursive: true })

async function startServer() {
  const distDir = path.resolve('frontend/dist')
  if (!existsSync(distDir)) {
    throw new Error(`Frontend build dist directory not found at ${distDir}. Run build first.`)
  }

  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  }

  const server = http.createServer((req, res) => {
    const parsed = new URL(req.url, 'http://127.0.0.1')
    let filePath = path.join(distDir, parsed.pathname)
    if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
      filePath = path.join(distDir, 'index.html')
    }
    const ext = path.extname(filePath).toLowerCase()
    const contentType = mimeTypes[ext] || 'application/octet-stream'
    try {
      const data = readFileSync(filePath)
      res.writeHead(200, { 'Content-Type': contentType })
      res.end(data)
    } catch {
      res.writeHead(404)
      res.end('Not Found')
    }
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => server.close(),
      })
    })
  })
}

// Save to both docs/qa/screenshots/reconstruction and conversation artifact directory
async function saveBoth(page, filename, options = {}) {
  const localP = path.join(LOCAL_DIR, filename)
  const artP = path.join(ARTIFACT_DIR, filename)
  await page.screenshot({ path: localP, ...options })
  await page.screenshot({ path: artP, ...options })
  console.log(`Saved screenshot: ${filename}`)
}

async function navigateTab(page, tabName, fallbackText) {
  const loc = page.locator(`button[data-tab="${tabName}"], button[title*="${tabName}"], [aria-label*="${tabName}"]`).first()
  if (await loc.count() > 0) {
    await loc.click()
  } else if (fallbackText) {
    await page.click(`button:has-text("${fallbackText}")`)
  }
  await page.waitForTimeout(500)
}

async function main() {
  const serverHandle = await startServer()
  const activeUrl = serverHandle.url
  console.log(`Test server running at ${activeUrl}`)

  const browser = await chromium.launch({ headless: true })

  const themes = [
    { id: 'aurora-dark', isV2: true, isDark: true, label: 'Aurora Dark' },
    { id: 'aurora-light', isV2: true, isDark: false, label: 'Aurora Light' },
    { id: 'classic-dark', isV2: false, isDark: true, label: 'Classic Dark' },
    { id: 'classic-light', isV2: false, isDark: false, label: 'Classic Light' },
  ]

  const viewports = [
    { width: 1440, height: 900, name: '1440x900' },
    { width: 1920, height: 1080, name: '1920x1080' },
  ]

  try {
    for (const vp of viewports) {
      console.log(`\n======================================================`)
      console.log(`TESTING VIEWPORT: ${vp.name} (${vp.width}x${vp.height})`)
      console.log(`======================================================`)

      for (const theme of themes) {
        console.log(`\n--- Theme: ${theme.label} [${theme.id}] @ ${vp.name} ---`)

        const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
        const page = await context.newPage()

        await page.addInitScript(({ isV2, isDark }) => {
          localStorage.setItem('shinpo_local_vault_account', 'zrggdgdgdrgg')
          localStorage.setItem(
            'shinpo_auth_user',
            JSON.stringify({ id: 1, username: 'zrggdgdgdrgg', email: 'user@local.shinpo' })
          )
          localStorage.setItem('shinpo_tutorial_completed', 'true')
          localStorage.setItem('shinpo_tutorial_dismissed', 'true')
          localStorage.setItem('shinpo_onboarding_completed', 'true')
          localStorage.setItem('shinpo_theme', isDark ? 'dark' : 'light')
          localStorage.setItem('shinpo_v2_preview', isV2 ? 'true' : 'false')
          sessionStorage.setItem('shinpo_startup_completed', 'true')
          sessionStorage.setItem('shinpo_splash_shown', 'true')

          Object.defineProperty(window, '__TAURI_INTERNALS__', {
            configurable: true,
            value: {
              invoke: async (cmd) => {
                if (cmd === 'local_get_onboarding_state') return { status: 'COMPLETED', currentStep: 6 }
                if (cmd === 'local_platform_capabilities') return {
                  hasAppMonitoring: true,
                  hasAppClosure: false,
                  hasWindowTracking: true,
                  platform: 'linux',
                  warningOnlyRelease: true,
                }
                if (cmd === 'local_vault_status') return { unlocked: true, username: 'zrggdgdgdrgg' }
                if (cmd === 'get_guardian_status' || cmd === 'local_get_guardian_status') return {
                  status: 'idle',
                  observerStatus: 'active',
                  guardianMode: 'PROTECTED',
                  interventionCapability: 'STANDARD_CLOSE_LINUX',
                  warningOnly: true,
                  standardAllowanceSeconds: 0,
                }
                if (cmd === 'get_sentinel_rules') return []
                if (cmd === 'get_recent_tamper_events') return []
                if (cmd === 'get_installed_applications' || cmd === 'get_active_application_catalog' || cmd === 'local_get_discovered_apps') return []
                if (cmd === 'local_get_app_policies') return []
                if (cmd === 'list_focus_sessions' || cmd === 'local_get_focus_sessions' || cmd === 'local_get_focus_sessions_by_date') return []
                if (cmd === 'list_goals_and_missions') return { goals: [], missions: [] }
                if (cmd === 'local_get_goals') return []
                if (cmd === 'local_get_tasks') return []
                if (cmd === 'local_get_streak') return { currentStreak: 0, longestStreak: 0 }
                if (cmd === 'local_get_study_resources') return []
                if (cmd === 'local_get_guardian_observations') return []
                if (cmd === 'local_get_guardian_preferences' || cmd === 'get_guardian_preferences') return {
                  preferredMode: 'PROTECTED',
                  appMonitoringConsent: false,
                  applyToNewSessions: true,
                  closureConsent: false,
                  backgroundRuntimeConsent: false,
                }
                if (cmd === 'get_user_progress' || cmd === 'local_get_progress') return {
                  userId: 1,
                  totalProgress: 0,
                  level: 1,
                  levelTitle: 'Novice',
                  currentLevelXp: 0,
                  nextLevelThreshold: 100,
                  progressPercent: 0,
                  recentEvents: [],
                }
                if (cmd === 'get_analytics_dashboard') return {
                  summary: {
                    totalFocusMinutes: 0,
                    completedSessionsCount: 0,
                    averageDailyMinutes: 0,
                    missionsCompleted: 0,
                    missionsTotal: 0,
                    currentStreak: 0,
                    streakDays: 0,
                  },
                  recentDebriefs: [],
                }
                if (cmd === 'local_eonpai_provider_config') return {
                  provider: 'none',
                  model: '',
                  endpoint: '',
                  allowCloudContext: false,
                }
                if (cmd === 'get_ai_provider_status') return {
                  enabled: false,
                  available: false,
                  status: 'OFFLINE',
                  message: 'AI service unreachable (offline fallback mode active)',
                }
                return null
              },
            },
          })
        }, { isV2: theme.isV2, isDark: theme.isDark })

        const targetUrl = `${activeUrl}/?v2=${theme.isV2}&theme=${theme.isDark ? 'dark' : 'light'}`
        await page.goto(targetUrl)
        await page.waitForSelector('.app-shell', { timeout: 10000 })
        await page.waitForTimeout(600)

        // 1. Dashboard / Overview
        console.log(`Capturing Screen 1: Dashboard (${theme.id}, ${vp.name})`)
        await navigateTab(page, 'Dashboard', 'Dashboard')
        await saveBoth(page, `01_dashboard_${theme.id}_${vp.name}.png`)

        // Verification metrics on Dashboard
        const dashMetrics = await page.evaluate(() => {
          const card = document.querySelector('.bento-card')
          const qa = document.querySelector('.dashboard-quick-actions')
          const cs = card ? window.getComputedStyle(card) : null
          const qs = qa ? window.getComputedStyle(qa) : null
          return {
            padding: cs ? cs.padding : null,
            borderRadius: cs ? cs.borderRadius : null,
            qaJustify: qs ? qs.justifyContent : null,
          }
        })
        console.log(`Dashboard metrics: cardPadding="${dashMetrics.padding}", borderRadius="${dashMetrics.borderRadius}", qaJustify="${dashMetrics.qaJustify}"`)

        // 2A. Goals & Tasks - List View
        console.log(`Capturing Screen 2A: Goals & Tasks List (${theme.id}, ${vp.name})`)
        await navigateTab(page, 'Goals & Missions', 'Goals & Tasks')
        await saveBoth(page, `02_goals_tasks_list_${theme.id}_${vp.name}.png`)

        // 2B. Goals & Tasks - Board / Kanban View
        console.log(`Capturing Screen 2B: Goals & Tasks Board (${theme.id}, ${vp.name})`)
        const boardBtn = await page.$('.view-mode-toggle button:has-text("Board")')
        if (boardBtn) {
          await boardBtn.click()
          await page.waitForTimeout(400)
        }
        await saveBoth(page, `02_goals_tasks_board_${theme.id}_${vp.name}.png`)

        // 3A. Focus Engine - Idle
        console.log(`Capturing Screen 3A: Focus Engine Idle (${theme.id}, ${vp.name})`)
        await navigateTab(page, 'Focus Engine', 'Focus')
        await saveBoth(page, `03_focus_engine_idle_${theme.id}_${vp.name}.png`)

        // 4. Analytics (Zero-State)
        console.log(`Capturing Screen 4: Analytics (${theme.id}, ${vp.name})`)
        await navigateTab(page, 'Analytics', 'Analytics')
        await saveBoth(page, `04_analytics_${theme.id}_${vp.name}.png`)

        // Check Analytics Zero-State
        const analyticsChecks = await page.evaluate(() => {
          const zeroState = document.querySelector('.analytics-chart-zero-state')
          const canvas = document.querySelector('.analytics-visual-card canvas')
          const statCard = document.querySelector('.analytics-stat-card')
          const statBorderTop = statCard ? window.getComputedStyle(statCard).borderTop : null
          return {
            hasZeroState: !!zeroState,
            hasCanvas: !!canvas,
            statBorderTop,
          }
        })
        console.log(`Analytics Zero-State checks: hasZeroState=${analyticsChecks.hasZeroState}, hasCanvas=${analyticsChecks.hasCanvas}, statBorderTop="${analyticsChecks.statBorderTop}"`)

        // 5. Rewards & Progress
        console.log(`Capturing Screen 5: Rewards & Progress (${theme.id}, ${vp.name})`)
        const rewardsBtn = await page.$('.sidebar-rewards-card') || page.locator('button[data-tab="Rewards"], button[title*="Rewards"]').first()
        if (rewardsBtn) await rewardsBtn.click()
        await page.waitForTimeout(500)
        await saveBoth(page, `05_rewards_${theme.id}_${vp.name}.png`)

        // 6. Guardian / Focus Protection
        console.log(`Capturing Screen 6: Guardian Focus Protection (${theme.id}, ${vp.name})`)
        await navigateTab(page, 'Task Manager', 'Focus Protection')
        await saveBoth(page, `06_guardian_${theme.id}_${vp.name}.png`)

        // 7. Schedule
        console.log(`Capturing Screen 7: Schedule (${theme.id}, ${vp.name})`)
        await navigateTab(page, 'Schedule', 'Calendar')
        await saveBoth(page, `07_schedule_${theme.id}_${vp.name}.png`)

        // 8. Settings Modal
        console.log(`Capturing Screen 8: Settings Modal (${theme.id}, ${vp.name})`)
        const profileBtn = await page.$('.profile-badge-card') || await page.$('.topbar-profile-btn')
        if (profileBtn) {
          await profileBtn.click()
          await page.waitForTimeout(300)
          const allSettings = await page.$('span:has-text("All settings")') || await page.$('.account-menu-item:has-text("Settings")')
          if (allSettings) {
            await allSettings.click()
          } else {
            await page.keyboard.press('Control+,')
          }
        } else {
          await page.keyboard.press('Control+,')
        }
        await page.waitForSelector('.settings-modal-dialog, [role="dialog"]', { timeout: 4000 }).catch(() => {})
        await page.waitForTimeout(400)
        await saveBoth(page, `08_settings_modal_${theme.id}_${vp.name}.png`)

        // Close Settings Modal before finishing theme loop
        const closeBtn = await page.$('.settings-modal-close')
        if (closeBtn) await closeBtn.click().catch(() => {})
        else await page.keyboard.press('Escape')
        await page.waitForTimeout(200)

        await context.close()

        // 3B. Focus Engine - Active State (captured in separate context with active session mock)
        console.log(`Capturing Screen 3B: Focus Engine Active (${theme.id}, ${vp.name})`)
        const activeContext = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
        const activePage = await activeContext.newPage()
        const mockActiveSession = {
          id: 42,
          userId: 1,
          name: '30m Focus Session',
          intention: 'Deep work on UI reconstruction',
          scheduledAt: new Date(Date.now() - 300000).toISOString(),
          startedAt: new Date(Date.now() - 17000).toISOString(),
          completedAt: null,
          totalDurationMinutes: 30,
          status: 'ACTIVE',
          enforcementMode: 'PROTECTED',
          appMonitoringConsent: true,
          standardAllowanceSeconds: 0,
          mode: 'LIGHT',
        }

        await activePage.addInitScript(({ isV2, isDark, session }) => {
          localStorage.setItem('shinpo_local_vault_account', 'zrggdgdgdrgg')
          localStorage.setItem('shinpo_auth_user', JSON.stringify({ id: 1, username: 'zrggdgdgdrgg' }))
          localStorage.setItem('shinpo_tutorial_completed', 'true')
          localStorage.setItem('shinpo_tutorial_dismissed', 'true')
          localStorage.setItem('shinpo_onboarding_completed', 'true')
          localStorage.setItem('shinpo_theme', isDark ? 'dark' : 'light')
          localStorage.setItem('shinpo_v2_preview', isV2 ? 'true' : 'false')
          sessionStorage.setItem('shinpo_startup_completed', 'true')
          sessionStorage.setItem('shinpo_splash_shown', 'true')

          Object.defineProperty(window, '__TAURI_INTERNALS__', {
            configurable: true,
            value: {
              invoke: async (cmd) => {
                if (cmd === 'local_get_onboarding_state') return { status: 'COMPLETED', currentStep: 6 }
                if (cmd === 'local_platform_capabilities') return { hasAppMonitoring: true, platform: 'linux', warningOnlyRelease: true }
                if (cmd === 'local_vault_status') return { unlocked: true, username: 'zrggdgdgdrgg' }
                if (cmd === 'get_guardian_status' || cmd === 'local_get_guardian_status') return { status: 'READY', guardianMode: 'PROTECTED', interventionCapability: 'LIMITED_NO_CLOSURE_CONSENT', warningOnly: true }
                if (cmd === 'local_get_active_focus_session' || cmd === 'get_active_focus_session') return session
                if (cmd === 'local_get_focus_sessions' || cmd === 'list_focus_sessions') return [session]
                if (cmd === 'local_get_goals' || cmd === 'list_goals_and_missions') return { goals: [], missions: [] }
                if (cmd === 'local_get_tasks') return []
                if (cmd === 'local_get_progress' || cmd === 'get_user_progress') return { userId: 1, totalXp: 100, level: 1 }
                if (cmd === 'local_get_study_resources') return []
                if (cmd === 'local_get_discovered_apps') return []
                if (cmd === 'local_get_app_policies') return []
                if (cmd === 'get_ai_provider_status') return { enabled: false, available: false }
                return null
              },
            },
          })
        }, { isV2: theme.isV2, isDark: theme.isDark, session: mockActiveSession })

        await activePage.goto(`${activeUrl}/?v2=${theme.isV2}&theme=${theme.isDark ? 'dark' : 'light'}`)
        await activePage.waitForSelector('.app-shell', { timeout: 10000 })
        await navigateTab(activePage, 'Focus Engine', 'Focus')
        await activePage.waitForSelector('.focus-session-live-context', { timeout: 10000 })
        await activePage.waitForTimeout(600)
        await saveBoth(activePage, `03_focus_engine_active_${theme.id}_${vp.name}.png`)

        // Inspect Active Focus Right Panel
        const activeFocusCheck = await activePage.evaluate(() => {
          const card = document.querySelector('.focus-side-card')
          const rect = card ? card.getBoundingClientRect() : null
          const cs = card ? window.getComputedStyle(card) : null
          return {
            height: rect ? rect.height : null,
            alignContent: cs ? cs.alignContent : null,
          }
        })
        console.log(`Active Focus Right Panel: height=${activeFocusCheck.height}px, alignContent=${activeFocusCheck.alignContent}`)

        await activeContext.close()
      }
    }

    console.log(`\n======================================================`)
    console.log(`ALL 80 RECONSTRUCTION VERIFICATION SCREENSHOTS CAPTURED!`)
    console.log(`======================================================`)
  } finally {
    await browser.close()
    serverHandle.close()
  }
}

main().catch((err) => {
  console.error('Reconstruction verification failed:', err)
  process.exit(1)
})
