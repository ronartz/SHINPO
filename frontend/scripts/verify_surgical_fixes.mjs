import { chromium } from 'playwright'
import { mkdirSync, existsSync, statSync, readFileSync, copyFileSync } from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const LOCAL_DIR = path.resolve('docs/qa/screenshots/surgical-fixes')
const ARTIFACT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/surgical-fixes'

mkdirSync(LOCAL_DIR, { recursive: true })
mkdirSync(ARTIFACT_DIR, { recursive: true })

async function startServer() {
  const distDir = path.resolve('frontend/dist')
  if (!existsSync(distDir)) {
    throw new Error(`dist directory not found at ${distDir}. Run build first.`)
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

function copyToArtifacts(filename) {
  const local = path.join(LOCAL_DIR, filename)
  const art = path.join(ARTIFACT_DIR, filename)
  if (existsSync(local)) {
    copyFileSync(local, art)
  }
}

async function runVerification() {
  const server = await startServer()
  console.log(`Test server running at ${server.url}`)

  const browser = await chromium.launch({ headless: true })

  try {
    // -------------------------------------------------------------
    // TEST 1: BUG 1 - Active Focus Right Panel Dead Space (1440x900 & 1920x1080)
    // -------------------------------------------------------------
    console.log('\n--- VERIFYING BUG 1: ACTIVE FOCUS RIGHT PANEL ---')

    for (const vp of [
      { width: 1440, height: 900, name: '1440x900' },
      { width: 1920, height: 1080, name: '1920x1080' },
    ]) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
      const page = await context.newPage()

      await page.addInitScript(() => {
        localStorage.setItem('shinpo_local_vault_account', 'qa_local_user')
        localStorage.setItem('shinpo_auth_user', JSON.stringify({ id: 1, username: 'qa_local_user' }))
        localStorage.setItem('shinpo_onboarding_dismissed', 'true')
        localStorage.setItem('shinpo_tutorial_completed', 'true')
        localStorage.setItem('shinpo_theme', 'dark')
        localStorage.setItem('shinpo_v2_preview', 'true') // Aurora Dark
        sessionStorage.setItem('shinpo_startup_completed', 'true')
        sessionStorage.setItem('shinpo_splash_shown', 'true')

        const activeSession = {
          id: 42,
          userId: 1,
          name: '30m Focus Session',
          intention: 'Keep your attention on this session. You can pause whenever you need to.',
          durationMinutes: 30,
          startedAt: new Date(Date.now() - 17000).toISOString(),
          status: 'ACTIVE',
          completedFocusCycles: 0,
          pomodoroEnabled: false,
          totalPausedSeconds: 0,
          targetDurationMinutes: 30,
        }

        Object.defineProperty(window, '__TAURI_INTERNALS__', {
          configurable: true,
          value: {
            invoke: async (cmd) => {
              if (cmd === 'local_vault_status') return { unlocked: true, username: 'qa_local_user' }
              if (cmd === 'local_get_onboarding_state') return { status: 'COMPLETED', currentStep: 6 }
              if (cmd === 'local_platform_capabilities') return { hasAppMonitoring: true, platform: 'linux', warningOnlyRelease: true }
              if (cmd === 'local_get_guardian_preferences') return { preferredMode: 'PROTECTED', appMonitoringConsent: false }
              if (cmd === 'local_get_guardian_status') return { status: 'READY', guardianMode: 'PROTECTED', interventionCapability: 'LIMITED_NO_CLOSURE_CONSENT', warningOnly: true }
              if (cmd === 'local_get_active_focus_session' || cmd === 'get_active_focus_session') return activeSession
              if (cmd === 'local_get_focus_sessions' || cmd === 'list_focus_sessions') return [activeSession]
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
      })

      await page.goto(server.url)
      await page.waitForSelector('.app-shell', { timeout: 10000 })

      // Navigate to Focus Engine
      const focusBtn = page.locator('button[data-tab="Focus Engine"], button[title="Focus Engine"], [aria-label="Focus Engine"]').first()
      if (await focusBtn.count() > 0) {
        await focusBtn.click()
      } else {
        await page.click('button:has-text("Focus")')
      }
      await page.waitForTimeout(600)

      // Ensure active focus state is rendered
      await page.waitForSelector('.focus-session-live-context', { timeout: 10000 })
      await page.waitForSelector('.timer-digits-display', { timeout: 10000 })

      // Measure bounding boxes
      const hudBox = await page.locator('.card-timer-hud').boundingBox()
      const creatorBox = await page.locator('.card-session-creator').boundingBox()
      const contextBox = await page.locator('.focus-session-live-context').boundingBox()
      const statBox = await page.locator('.focus-context-stat').boundingBox()

      const creatorStyles = await page.locator('.card-session-creator').evaluate((el) => {
        const computed = window.getComputedStyle(el)
        return {
          alignSelf: computed.alignSelf,
          height: computed.height,
        }
      })

      console.log(`[${vp.name}] Left HUD height: ${hudBox.height.toFixed(1)}px`)
      console.log(`[${vp.name}] Right Card height: ${creatorBox.height.toFixed(1)}px (LiveContext: ${contextBox.height.toFixed(1)}px)`)
      console.log(`[${vp.name}] Right Card alignSelf: ${creatorStyles.alignSelf}`)

      // Assertions
      if (creatorBox.height > 340) {
        throw new Error(`CRITICAL: Right card stretched to ${creatorBox.height}px, exceeding compact content bounds!`)
      }
      if (creatorStyles.alignSelf !== 'start') {
        throw new Error(`CRITICAL: Right card alignSelf is '${creatorStyles.alignSelf}', expected 'start'!`)
      }

      // Check distance from stat row bottom to card bottom (should be small padding, ~18-24px, not 200px dead space)
      const paddingBottom = creatorBox.y + creatorBox.height - (statBox.y + statBox.height)
      console.log(`[${vp.name}] Distance from stat bottom to card bottom: ${paddingBottom.toFixed(1)}px`)
      if (paddingBottom > 50) {
        throw new Error(`CRITICAL: ${paddingBottom.toFixed(1)}px dead space detected below active focus time row!`)
      }

      const imgName = `bug1_active_focus_${vp.name}.png`
      await page.screenshot({ path: path.join(LOCAL_DIR, imgName), fullPage: false })
      copyToArtifacts(imgName)
      console.log(`✓ Saved ${imgName} (PASSED)`)

      await context.close()
    }

    // -------------------------------------------------------------
    // TEST 2: BUG 2 - Focus Activity Chart with Zero Data
    // -------------------------------------------------------------
    console.log('\n--- VERIFYING BUG 2: FOCUS ACTIVITY CHART (ZERO DATA) ---')
    {
      const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
      const page = await context.newPage()

      await page.addInitScript(() => {
        localStorage.setItem('shinpo_local_vault_account', 'qa_local_user')
        localStorage.setItem('shinpo_auth_user', JSON.stringify({ id: 1, username: 'qa_local_user' }))
        localStorage.setItem('shinpo_onboarding_dismissed', 'true')
        localStorage.setItem('shinpo_tutorial_completed', 'true')
        localStorage.setItem('shinpo_theme', 'dark')
        localStorage.setItem('shinpo_v2_preview', 'false') // Classic Dark
        sessionStorage.setItem('shinpo_startup_completed', 'true')
        sessionStorage.setItem('shinpo_splash_shown', 'true')

        // Mock zero data period
        const emptyPeriod = {
          range: '7d',
          currentStart: '2026-11-09T00:00:00Z',
          currentEnd: '2026-11-15T23:59:59Z',
          previousStart: '2026-11-02T00:00:00Z',
          previousEnd: '2026-11-08T23:59:59Z',
          currentActiveSeconds: 0,
          previousActiveSeconds: 0,
          currentCompletedSessions: 0,
          previousCompletedSessions: 0,
          currentBuckets: [
            { start: '2026-11-09T00:00:00Z', end: '2026-11-09T23:59:59Z', activeSeconds: 0, completedSessions: 0 },
            { start: '2026-11-10T00:00:00Z', end: '2026-11-10T23:59:59Z', activeSeconds: 0, completedSessions: 0 },
            { start: '2026-11-11T00:00:00Z', end: '2026-11-11T23:59:59Z', activeSeconds: 0, completedSessions: 0 },
            { start: '2026-11-12T00:00:00Z', end: '2026-11-12T23:59:59Z', activeSeconds: 0, completedSessions: 0 },
            { start: '2026-11-13T00:00:00Z', end: '2026-11-13T23:59:59Z', activeSeconds: 0, completedSessions: 0 },
            { start: '2026-11-14T00:00:00Z', end: '2026-11-14T23:59:59Z', activeSeconds: 0, completedSessions: 0 },
            { start: '2026-11-15T00:00:00Z', end: '2026-11-15T23:59:59Z', activeSeconds: 0, completedSessions: 0 },
          ],
          previousBuckets: [],
        }

        Object.defineProperty(window, '__TAURI_INTERNALS__', {
          configurable: true,
          value: {
            invoke: async (cmd) => {
              if (cmd === 'local_vault_status') return { unlocked: true, username: 'qa_local_user' }
              if (cmd === 'local_get_onboarding_state') return { status: 'COMPLETED', currentStep: 6 }
              if (cmd === 'local_platform_capabilities') return { hasAppMonitoring: true, platform: 'linux', warningOnlyRelease: true }
              if (cmd === 'local_get_focus_sessions' || cmd === 'list_focus_sessions') return []
              if (cmd === 'local_get_analytics_period' || cmd === 'get_analytics_period') return emptyPeriod
              if (cmd === 'local_get_analytics_dashboard' || cmd === 'get_analytics_dashboard') {
                return {
                  summary: { totalFocusSeconds: 0, missionsCompleted: 0, missionsTotal: 0, currentStreak: 0, longestStreak: 0, avgQuality: null },
                  weeklyVelocity: [],
                  recentDebriefs: [],
                }
              }
              if (cmd === 'local_get_goals' || cmd === 'list_goals_and_missions') return { goals: [], missions: [] }
              if (cmd === 'local_get_tasks') return []
              if (cmd === 'local_get_progress' || cmd === 'get_user_progress') return { userId: 1, totalXp: 0, level: 1 }
              return null
            },
          },
        })
      })

      await page.goto(server.url)
      await page.waitForSelector('.app-shell', { timeout: 10000 })

      // Navigate to Analytics
      const analyticsBtn = page.locator('button[data-tab="Analytics"], button[title="Analytics"], [aria-label="Analytics"]').first()
      if (await analyticsBtn.count() > 0) {
        await analyticsBtn.click()
      } else {
        await page.click('button:has-text("Analytics")')
      }
      await page.waitForTimeout(600)

      // Assertions for zero data
      const zeroCopy = page.locator('.analytics-zero-copy')
      await zeroCopy.waitFor({ timeout: 5000 })
      const zeroText = await zeroCopy.textContent()
      console.log(`Zero state text: "${zeroText}"`)

      const svgChart = page.locator('svg.analytics-activity-chart')
      const svgCount = await svgChart.count()
      console.log(`SVG chart count when zero data: ${svgCount}`)

      const gridlines = page.locator('.analytics-chart-gridline')
      const gridlinesCount = await gridlines.count()

      const tickLabels = page.locator('.analytics-chart-axis, .analytics-chart-axis-x')
      const tickLabelsCount = await tickLabels.count()

      const legend = page.locator('.analytics-chart-legend')
      const legendCount = await legend.count()

      if (svgCount !== 0) {
        throw new Error(`CRITICAL: svg.analytics-activity-chart is still rendered in DOM with zero data!`)
      }
      if (gridlinesCount !== 0 || tickLabelsCount !== 0) {
        throw new Error(`CRITICAL: Ghost axes or tick labels rendered with zero data! (${gridlinesCount} gridlines, ${tickLabelsCount} ticks)`)
      }
      if (legendCount !== 0) {
        throw new Error(`CRITICAL: Legend is still rendered with zero data!`)
      }

      console.log('✓ Verified: 0 SVG charts, 0 ghost axes, 0 tick labels, 0 ghost bars, 0 legends.')

      const imgName = 'bug2_analytics_zero_data.png'
      await page.screenshot({ path: path.join(LOCAL_DIR, imgName), fullPage: false })
      copyToArtifacts(imgName)
      console.log(`✓ Saved ${imgName} (PASSED)`)

      await context.close()
    }

    // -------------------------------------------------------------
    // TEST 3: BUG 2 - Focus Activity Chart WITH DATA & LEGEND DOT COLOR
    // -------------------------------------------------------------
    console.log('\n--- VERIFYING BUG 2: FOCUS ACTIVITY CHART (WITH REAL DATA & THEME TOKENS) ---')

    for (const theme of [
      { name: 'classic-dark', isV2: false, isDark: true, expectedDotColorSubstr: '175, 243, 62' }, // #AFF33E
      { name: 'aurora-dark', isV2: true, isDark: true, expectedDotColorSubstr: '151, 87, 250' },   // #9757FA
    ]) {
      const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
      const page = await context.newPage()

      await page.addInitScript(({ isV2, isDark }) => {
        localStorage.setItem('shinpo_local_vault_account', 'qa_local_user')
        localStorage.setItem('shinpo_auth_user', JSON.stringify({ id: 1, username: 'qa_local_user' }))
        localStorage.setItem('shinpo_onboarding_dismissed', 'true')
        localStorage.setItem('shinpo_tutorial_completed', 'true')
        localStorage.setItem('shinpo_theme', isDark ? 'dark' : 'light')
        localStorage.setItem('shinpo_v2_preview', String(isV2))
        sessionStorage.setItem('shinpo_startup_completed', 'true')
        sessionStorage.setItem('shinpo_splash_shown', 'true')

        // Real data period
        const populatedPeriod = {
          range: '7d',
          currentStart: '2026-11-09T00:00:00Z',
          currentEnd: '2026-11-15T23:59:59Z',
          previousStart: '2026-11-02T00:00:00Z',
          previousEnd: '2026-11-08T23:59:59Z',
          currentActiveSeconds: 7200,
          previousActiveSeconds: 3600,
          currentCompletedSessions: 4,
          previousCompletedSessions: 2,
          currentBuckets: [
            { start: '2026-11-09T00:00:00Z', end: '2026-11-09T23:59:59Z', activeSeconds: 1800, completedSessions: 1 },
            { start: '2026-11-10T00:00:00Z', end: '2026-11-10T23:59:59Z', activeSeconds: 0, completedSessions: 0 },
            { start: '2026-11-11T00:00:00Z', end: '2026-11-11T23:59:59Z', activeSeconds: 2700, completedSessions: 2 },
            { start: '2026-11-12T00:00:00Z', end: '2026-11-12T23:59:59Z', activeSeconds: 0, completedSessions: 0 },
            { start: '2026-11-13T00:00:00Z', end: '2026-11-13T23:59:59Z', activeSeconds: 1500, completedSessions: 1 },
            { start: '2026-11-14T00:00:00Z', end: '2026-11-14T23:59:59Z', activeSeconds: 0, completedSessions: 0 },
            { start: '2026-11-15T00:00:00Z', end: '2026-11-15T23:59:59Z', activeSeconds: 1200, completedSessions: 1 },
          ],
          previousBuckets: [
            { start: '2026-11-02T00:00:00Z', end: '2026-11-02T23:59:59Z', activeSeconds: 3600, completedSessions: 2 },
          ],
        }

        const mockCompletedSession = {
          id: 1,
          userId: 1,
          name: 'Deep Work Session',
          status: 'COMPLETED',
          durationMinutes: 30,
          activeSeconds: 1800,
          createdAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
        }

        Object.defineProperty(window, '__TAURI_INTERNALS__', {
          configurable: true,
          value: {
            invoke: async (cmd) => {
              if (cmd === 'local_vault_status') return { unlocked: true, username: 'qa_local_user' }
              if (cmd === 'local_get_onboarding_state') return { status: 'COMPLETED', currentStep: 6 }
              if (cmd === 'local_platform_capabilities') return { hasAppMonitoring: true, platform: 'linux', warningOnlyRelease: true }
              if (cmd === 'local_get_focus_sessions' || cmd === 'list_focus_sessions') return [mockCompletedSession]
              if (cmd === 'local_get_analytics_period' || cmd === 'get_analytics_period') return populatedPeriod
              if (cmd === 'local_get_analytics_dashboard' || cmd === 'get_analytics_dashboard') {
                return {
                  summary: { totalFocusSeconds: 7200, missionsCompleted: 3, missionsTotal: 5, currentStreak: 3, longestStreak: 7, avgQuality: 4.5 },
                  weeklyVelocity: [],
                  recentDebriefs: [],
                }
              }
              if (cmd === 'local_get_goals' || cmd === 'list_goals_and_missions') return { goals: [], missions: [] }
              if (cmd === 'local_get_tasks') return []
              if (cmd === 'local_get_progress' || cmd === 'get_user_progress') return { userId: 1, totalXp: 350, level: 2 }
              return null
            },
          },
        })
      }, { isV2: theme.isV2, isDark: theme.isDark })

      await page.goto(server.url)
      await page.waitForSelector('.app-shell', { timeout: 10000 })

      // Navigate to Analytics
      const analyticsBtn = page.locator('button[data-tab="Analytics"], button[title="Analytics"], [aria-label="Analytics"]').first()
      if (await analyticsBtn.count() > 0) {
        await analyticsBtn.click()
      } else {
        await page.click('button:has-text("Analytics")')
      }
      await page.waitForTimeout(600)

      // Assertions with data
      const svgChart = page.locator('svg.analytics-activity-chart')
      await svgChart.waitFor({ timeout: 5000 })
      const svgCount = await svgChart.count()
      console.log(`[${theme.name}] SVG chart count when data exists: ${svgCount}`)
      if (svgCount !== 1) {
        throw new Error(`CRITICAL: Chart failed to render when data exists!`)
      }

      // Check legend
      const legend = page.locator('.analytics-chart-legend')
      await legend.waitFor({ timeout: 5000 })
      const currentDot = page.locator('.analytics-chart-legend i.is-current')
      const dotBg = await currentDot.evaluate((el) => window.getComputedStyle(el).backgroundColor)
      console.log(`[${theme.name}] Legend dot background-color: "${dotBg}" (expected substr: "${theme.expectedDotColorSubstr}")`)

      if (!dotBg.includes(theme.expectedDotColorSubstr)) {
        throw new Error(`CRITICAL: Legend dot color mismatch in ${theme.name}! Got ${dotBg}, expected to contain ${theme.expectedDotColorSubstr}`)
      }

      const imgName = `bug2_analytics_with_data_${theme.name}.png`
      await page.screenshot({ path: path.join(LOCAL_DIR, imgName), fullPage: false })
      copyToArtifacts(imgName)
      console.log(`✓ Saved ${imgName} (PASSED)`)

      await context.close()
    }

    console.log('\n========================================')
    console.log('ALL SURGICAL VERIFICATIONS PASSED!')
    console.log('========================================')
  } finally {
    await browser.close()
    server.close()
  }
}

runVerification().catch((err) => {
  console.error('VERIFICATION FAILED:', err)
  process.exit(1)
})
