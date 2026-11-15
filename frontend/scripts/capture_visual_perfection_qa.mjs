import { chromium } from 'playwright'
import { mkdirSync, existsSync, statSync, readFileSync } from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const LOCAL_EVIDENCE_DIR = path.resolve('docs/qa/screenshots/visual-perfection')
const ARTIFACT_EVIDENCE_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/visual-perfection'

mkdirSync(LOCAL_EVIDENCE_DIR, { recursive: true })
mkdirSync(ARTIFACT_EVIDENCE_DIR, { recursive: true })

const DEFAULT_URL = process.env.SHINPO_URL || 'http://127.0.0.1:5173'

async function ensureServer(initialUrl) {
  try {
    const res = await fetch(initialUrl, { method: 'HEAD', signal: AbortSignal.timeout(1000) })
    if (res.ok || res.status === 404) return { url: initialUrl, close: () => {} }
  } catch {}

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

// User state with 0 data (empty state) matching user screenshots
const emptyStateMockScript = () => {
  localStorage.setItem('shinpo_local_vault_account', 'zrggdgdgdrgg')
  localStorage.setItem(
    'shinpo_auth_user',
    JSON.stringify({ id: 1, username: 'zrggdgdgdrgg', email: 'user@local.shinpo' })
  )
  localStorage.setItem('shinpo_tutorial_completed', 'true')
  localStorage.setItem('shinpo_tutorial_dismissed', 'true')
  localStorage.setItem('shinpo_onboarding_completed', 'true')

  Object.defineProperty(window, '__TAURI_INTERNALS__', {
    value: {
      invoke: async (cmd, args) => {
        if (cmd === 'local_get_onboarding_state') return { status: 'COMPLETED', currentStep: 6 }
        if (cmd === 'local_platform_capabilities') return {
          hasAppMonitoring: true,
          hasAppClosure: false,
          hasWindowTracking: true,
          platform: 'linux',
          warningOnlyRelease: true,
        }
        if (cmd === 'local_vault_status') return { unlocked: true, username: 'zrggdgdgdrgg' }
        if (cmd === 'get_guardian_status') return {
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
        if (cmd === 'local_get_guardian_status') return {
          status: 'idle',
          observerStatus: 'active',
          guardianMode: 'PROTECTED',
          interventionCapability: 'STANDARD_CLOSE_LINUX',
          warningOnly: true,
          standardAllowanceSeconds: 0,
        }
        if (cmd === 'local_get_guardian_observations') return []
        if (cmd === 'local_get_guardian_preferences') return {
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
        if (cmd === 'get_guardian_preferences') return {
          preferredMode: 'PROTECTED',
          appMonitoringConsent: false,
          applyToNewSessions: true,
          closureConsent: false,
          backgroundRuntimeConsent: false,
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
}

async function saveBoth(page, filename, options = {}) {
  const localP = path.join(LOCAL_EVIDENCE_DIR, filename)
  const artP = path.join(ARTIFACT_EVIDENCE_DIR, filename)
  await page.screenshot({ path: localP, ...options })
  await page.screenshot({ path: artP, ...options })
  console.log(`Saved screenshot: ${filename}`)
}

async function main() {
  const serverHandle = await ensureServer(DEFAULT_URL)
  const activeUrl = serverHandle.url
  console.log(`Connecting to frontend at: ${activeUrl}`)
  const browser = await chromium.launch({ headless: true })

  const themes = [
    { name: 'classic-dark', query: 'v2=false&theme=dark' },
    { name: 'classic-light', query: 'v2=false&theme=light' },
    { name: 'aurora-dark', query: 'v2=true&theme=dark' },
    { name: 'aurora-light', query: 'v2=true&theme=light' },
  ]

  try {
    for (const theme of themes) {
      console.log(`\n========================================`)
      console.log(`Testing Theme: ${theme.name}`)
      console.log(`========================================`)

      const page = await browser.newPage()
      await page.addInitScript(emptyStateMockScript)
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(`${activeUrl}/?${theme.query}`)
      await page.waitForSelector('.icon-sidebar', { timeout: 10000 })
      await page.waitForTimeout(500)

      // SCREEN A: Dashboard
      console.log(`Capturing Screen A (Dashboard) [${theme.name}]...`)
      await page.click('button[data-tab="Dashboard"]')
      await page.waitForTimeout(500)
      await saveBoth(page, `screen_a_dashboard_${theme.name}.png`)

      // Check Quick Actions gap & layout metrics
      if (theme.name === 'classic-dark') {
        const qaStyle = await page.$eval('.dashboard-quick-actions', (el) => {
          const s = window.getComputedStyle(el)
          return { display: s.display, flexDirection: s.flexDirection, justifyContent: s.justifyContent, gap: s.gap }
        }).catch(() => null)
        console.log('Quick Actions CSS computed:', qaStyle)

        const cockpitClass = await page.$eval('.dashboard-cockpit-grid', (el) => el.className).catch(() => null)
        console.log('Cockpit grid classes (empty schedule check):', cockpitClass)
      }

      // SCREEN B: Goals & Tasks
      console.log(`Capturing Screen B (Goals & Tasks) [${theme.name}]...`)
      await page.click('button[data-tab="Goals & Missions"]')
      await page.waitForTimeout(500)
      await saveBoth(page, `screen_b_goals_tasks_list_${theme.name}.png`)

      // Also toggle to Board view matching Screenshot B
      const boardBtn = await page.$('.view-mode-toggle button:has-text("Board")')
      if (boardBtn) {
        await boardBtn.click()
        await page.waitForTimeout(400)
      }
      await saveBoth(page, `screen_b_goals_tasks_board_${theme.name}.png`)

      // SCREEN C: Focus Engine
      console.log(`Capturing Screen C (Focus Engine) [${theme.name}]...`)
      await page.click('button[data-tab="Focus Engine"]')
      await page.waitForTimeout(500)
      await saveBoth(page, `screen_c_focus_engine_${theme.name}.png`)

      // Scroll .app-main to view lower Focus components
      await page.evaluate(() => {
        const m = document.querySelector('.app-main')
        if (m) m.scrollTop = 450
      })
      await page.waitForTimeout(400)
      await saveBoth(page, `screen_c_focus_engine_scrolled_${theme.name}.png`)
      await page.evaluate(() => {
        const m = document.querySelector('.app-main')
        if (m) m.scrollTop = 0
      })

      // SCREEN D: Analytics
      console.log(`Capturing Screen D (Analytics) [${theme.name}]...`)
      await page.click('button[data-tab="Analytics"]')
      await page.waitForTimeout(500)
      await saveBoth(page, `screen_d_analytics_${theme.name}.png`)

      // Scroll .app-main to view the Focus Activity zero-state
      await page.evaluate(() => {
        const m = document.querySelector('.app-main')
        if (m) m.scrollTop = 450
      })
      await page.waitForTimeout(400)
      await saveBoth(page, `screen_d_analytics_scrolled_${theme.name}.png`)
      await page.evaluate(() => {
        const m = document.querySelector('.app-main')
        if (m) m.scrollTop = 0
      })

      // SCREEN E: Rewards & Progress
      console.log(`Capturing Screen E (Rewards) [${theme.name}]...`)
      await page.click('.sidebar-rewards-card')
      await page.waitForTimeout(500)
      await saveBoth(page, `screen_e_rewards_${theme.name}.png`)
      await saveBoth(page, `screen_e_rewards_full_${theme.name}.png`, { fullPage: true })

      await page.close()
    }

    console.log(`\n========================================`)
    console.log(`ALL 20 VERIFICATION SCREENSHOTS CAPTURED`)
    console.log(`========================================`)
  } finally {
    await browser.close()
    serverHandle.close()
  }
}

main().catch((err) => {
  console.error('Visual QA script failed:', err)
  process.exit(1)
})
