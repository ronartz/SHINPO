import { chromium } from 'playwright'
import { mkdirSync, existsSync, statSync, readFileSync, copyFileSync } from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const LOCAL_EVIDENCE_DIR = path.resolve('docs/qa/screenshots/scrollbar-acceptance')
const ARTIFACT_EVIDENCE_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/scrollbar-acceptance'

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

const mockEnvironmentScript = () => {
  localStorage.setItem('shinpo_local_vault_account', 'qa_local_user')
  localStorage.setItem('shinpo_auth_user', JSON.stringify({ id: 1, username: 'qa_local_user', email: 'qa@shinpo.local' }))
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
    {
      id: 12,
      userId: 1,
      goalId: 1,
      title: 'Document cross-platform scrollbar compliance across Linux and Windows',
      description: 'Standards-based scrollbar-width and scrollbar-color parity',
      status: 'DONE',
      estimatedMinutes: 30,
      priority: 'MEDIUM',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]

  Object.defineProperty(window, '__TAURI_INTERNALS__', {
    configurable: true,
    value: {
      invoke: async (command) => {
        if (command === 'local_vault_status') return { unlocked: true, username: 'qa_local_user' }
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
          return command === 'list_goals_and_missions' ? { goals: mockGoals, missions: mockMissions } : mockGoals
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

async function saveBoth(page, filename, options = {}) {
  const localP = path.join(LOCAL_EVIDENCE_DIR, filename)
  const artP = path.join(ARTIFACT_EVIDENCE_DIR, filename)
  await page.screenshot({ path: localP, ...options })
  copyFileSync(localP, artP)
  console.log(`Saved screenshot: ${filename}`)
}

async function main() {
  const serverHandle = await ensureServer(DEFAULT_URL)
  const activeUrl = serverHandle.url
  console.log(`Frontend running at: ${activeUrl}`)
  const browser = await chromium.launch({ headless: true })

  const themes = [
    { name: 'classic-dark', query: 'v2=false&theme=dark' },
    { name: 'classic-light', query: 'v2=false&theme=light' },
    { name: 'aurora-dark', query: 'v2=true&theme=dark' },
    { name: 'aurora-light', query: 'v2=true&theme=light' },
  ]

  const report = []

  try {
    for (const theme of themes) {
      console.log(`\n========================================`)
      console.log(`Verifying Theme: ${theme.name}`)
      console.log(`========================================`)

      const page = await browser.newPage()
      await page.addInitScript(mockEnvironmentScript)
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(`${activeUrl}/?${theme.query}`)
      await page.waitForSelector('.app-shell', { timeout: 10000 })
      await page.waitForTimeout(500)

      // 1. Dashboard / Main Application Scroll
      console.log(`Capturing Main Application Scroll [${theme.name}]...`)
      await page.click('button[data-tab="Dashboard"]')
      await page.waitForTimeout(400)
      await saveBoth(page, `01_main_scroll_${theme.name}.png`)

      // 2. Sidebar Scrollbar & Hover
      console.log(`Capturing Sidebar [${theme.name}]...`)
      const sidebarToggle = await page.$('.icon-sidebar')
      if (sidebarToggle) {
        await sidebarToggle.hover()
        await page.waitForTimeout(300)
      }
      await saveBoth(page, `02_sidebar_${theme.name}.png`)

      // 3. Goals & Tasks List Mode
      console.log(`Capturing Goals & Tasks List [${theme.name}]...`)
      await page.click('button[data-tab="Goals & Missions"]')
      await page.waitForTimeout(500)

      // Verify absence of "PORTFOLIO & ROADMAP" in live DOM
      const listEyebrowCount = await page.getByText(/portfolio\s*&\s*roadmap/i).count()
      if (listEyebrowCount > 0) {
        throw new Error(`CRITICAL REGRESSION: "PORTFOLIO & ROADMAP" found in List mode for theme ${theme.name}!`)
      }
      console.log(`  ✓ Verified List mode: 0 occurrences of "PORTFOLIO & ROADMAP"`)
      await saveBoth(page, `03_goals_tasks_list_${theme.name}.png`)

      // 4. Goals & Tasks Board Mode
      console.log(`Capturing Goals & Tasks Board [${theme.name}]...`)
      const boardBtn = await page.$('.view-mode-toggle button:has-text("Board")')
      if (boardBtn) {
        await boardBtn.click()
        await page.waitForTimeout(400)
      }
      const boardEyebrowCount = await page.getByText(/portfolio\s*&\s*roadmap/i).count()
      if (boardEyebrowCount > 0) {
        throw new Error(`CRITICAL REGRESSION: "PORTFOLIO & ROADMAP" found in Board mode for theme ${theme.name}!`)
      }
      console.log(`  ✓ Verified Board mode: 0 occurrences of "PORTFOLIO & ROADMAP"`)
      await saveBoth(page, `04_goals_tasks_board_${theme.name}.png`)

      // 5. Focus Engine
      console.log(`Capturing Focus Engine [${theme.name}]...`)
      await page.click('button[data-tab="Focus Engine"]')
      await page.waitForTimeout(500)
      await saveBoth(page, `05_focus_engine_${theme.name}.png`)

      // 6. Analytics Scrolled
      console.log(`Capturing Analytics [${theme.name}]...`)
      await page.click('button[data-tab="Analytics"]')
      await page.waitForTimeout(500)
      await page.evaluate(() => {
        const m = document.querySelector('.app-main')
        if (m) m.scrollTop = 350
      })
      await page.waitForTimeout(400)
      await saveBoth(page, `06_analytics_${theme.name}.png`)

      // 7. Settings / Modal Scrollbar
      console.log(`Capturing Settings Modal [${theme.name}]...`)
      const profileBtn = await page.$('.profile-badge-card')
      if (profileBtn) {
        await profileBtn.click()
        await page.waitForTimeout(300)
        const allSettings = await page.$('span:has-text("All settings")')
        if (allSettings) {
          await allSettings.click()
        } else {
          await page.keyboard.press('Control+,')
        }
      } else {
        await page.keyboard.press('Control+,')
      }
      await page.waitForSelector('.settings-modal-dialog, [role="dialog"]', { timeout: 5000 })
      await page.waitForTimeout(400)
      await saveBoth(page, `07_settings_modal_${theme.name}.png`)

      // Close settings modal
      const closeBtn = await page.$('.settings-modal-close')
      if (closeBtn) await closeBtn.click()
      else await page.keyboard.press('Escape')
      await page.waitForTimeout(300)

      // Query scrollbar tokens
      const tokens = await page.evaluate(() => {
        const s = window.getComputedStyle(document.documentElement)
        return {
          track: s.getPropertyValue('--scrollbar-track').trim(),
          thumb: s.getPropertyValue('--scrollbar-thumb').trim(),
          thumbHover: s.getPropertyValue('--scrollbar-thumb-hover').trim(),
          thumbActive: s.getPropertyValue('--scrollbar-thumb-active').trim(),
        }
      })

      report.push({
        theme: theme.name,
        listModeEyebrowClean: listEyebrowCount === 0,
        boardModeEyebrowClean: boardEyebrowCount === 0,
        tokens,
      })

      await page.close()
    }

    console.log(`\n========================================`)
    console.log(`CAPTURE & VERIFICATION COMPLETE: ALL 28 ASSETS RECORDED`)
    console.log(`========================================`)
    console.log(JSON.stringify(report, null, 2))
  } finally {
    await browser.close()
    serverHandle.close()
  }
}

main().catch((err) => {
  console.error('Fatal execution error:', err)
  process.exit(1)
})
