import { spawn } from 'node:child_process'
import { mkdirSync, copyFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium } from '../frontend/node_modules/@playwright/test/index.mjs'

const ROOT = resolve(process.cwd())
const LOCAL_DIR = join(ROOT, 'docs/qa/screenshots/final')
const ARTIFACT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/final'

mkdirSync(LOCAL_DIR, { recursive: true })
mkdirSync(ARTIFACT_DIR, { recursive: true })

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return true
    } catch {}
    await sleep(250)
  }
  throw new Error(`Server at ${url} failed to respond`)
}

async function setupMockRoutes(page) {
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const u = route.request().url()
    if (u.includes('/auth/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, username: 'ronartz', email: 'ronartz@shinpo.dev' }),
      })
    }
    if (u.includes('/onboarding/state')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'COMPLETED' }),
      })
    }
    if (u.includes('/goals')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, title: 'Finish SHINPO release', description: 'Deliver 0.1.0-beta.1 release candidate', progress: 85, targetDate: '2026-11-20', status: 'ACTIVE' },
          { id: 2, title: 'Deep Work Consistency', description: 'Maintain daily 4-hour focus rhythm', progress: 70, targetDate: '2026-12-01', status: 'ACTIVE' },
        ]),
      })
    }
    if (u.includes('/tasks') || u.includes('/missions')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, goalId: 1, title: 'Run Final Release Gate', scheduledDate: '2026-11-17', estimatedMinutes: 60, status: 'IN_PROGRESS' },
          { id: 2, goalId: 1, title: 'Package Linux distribution (.rpm, .deb)', scheduledDate: '2026-11-17', estimatedMinutes: 30, status: 'TODO' },
          { id: 3, goalId: 1, title: 'Publish Release Verification Verdict', scheduledDate: '2026-11-17', estimatedMinutes: 20, status: 'TODO' },
          { id: 4, goalId: 1, title: 'Completed architecture cleanup', scheduledDate: '2026-11-17', estimatedMinutes: 45, status: 'COMPLETED' },
        ]),
      })
    }
    if (u.includes('/focus-sessions') || u.includes('/sessions')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 101,
            goalId: 1,
            missionId: 1,
            name: 'Release Gate Execution',
            intention: 'Execute 10 qualification phases with empirical evidence',
            durationMinutes: 25,
            status: 'ACTIVE',
            currentPhase: 'FOCUS',
            startedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
            scheduledAt: new Date().toISOString(),
          },
        ]),
      })
    }
    if (u.includes('/analytics/dashboard') || u.includes('/analytics')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          period: 'THIS_WEEK',
          totalFocusMinutes: 245,
          completedSessionsCount: 7,
          consistencyStreakDays: 5,
          activeGoalsCount: 2,
          heatMap: [
            { date: '2026-11-16', focusMinutes: 120, sessionsCount: 3 },
            { date: '2026-11-17', focusMinutes: 125, sessionsCount: 4 },
          ],
          activityChart: [
            { timeBucket: '09:00', minutes: 25 },
            { timeBucket: '11:00', minutes: 50 },
            { timeBucket: '14:00', minutes: 50 },
          ],
        }),
      })
    }
    if (u.includes('/progress')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalProgress: 450,
          currentLevel: 3,
          levelTitle: 'Practitioner',
          streak: { currentStreak: 5, longestStreak: 7, todayCompleted: true },
          unlockedAchievements: ['first_task', 'first_sprint', 'level_2_practitioner'],
        }),
      })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
  })
}

async function run() {
  console.log('Starting Vite server on isolated port for final screenshots...')
  const port = 5199
  const viteProcess = spawn('npx', ['vite', '--port', String(port), '--strictPort'], {
    cwd: resolve('frontend'),
    stdio: 'ignore',
  })

  try {
    await waitForServer(`http://localhost:${port}`)
    console.log(`Vite server ready on port ${port}`)

    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    })
    const page = await context.newPage()
    await setupMockRoutes(page)

    const themes = [
      { brand: 'aurora', mode: 'dark', label: 'aurora-dark' },
      { brand: 'classic', mode: 'dark', label: 'classic-dark' },
    ]

    const views = [
      { tab: 'Dashboard', name: '01_dashboard' },
      { tab: 'Goals & Tasks', name: '02_goals_tasks' },
      { tab: 'Focus Engine', name: '03_focus_engine' },
      { tab: 'Analytics', name: '04_analytics' },
      { tab: 'Rewards', name: '05_rewards' },
      { tab: 'Schedule', name: '06_schedule_calendar' },
      { tab: 'Task Manager', name: '07_task_manager' },
      { tab: 'EONPAI', name: '08_eonpai_assistant' },
    ]

    for (const theme of themes) {
      console.log(`\nCapturing views for theme: ${theme.label}...`)
      await page.goto(`http://localhost:${port}`)
      await page.waitForSelector('.shinpo-desktop-app')

      // Set brand and theme
      await page.evaluate(({ b, m }) => {
        document.documentElement.setAttribute('data-brand', b)
        document.documentElement.setAttribute('data-theme', m)
        const app = document.querySelector('.shinpo-desktop-app')
        if (app) {
          app.classList.remove('theme-aurora', 'theme-classic', 'mode-dark', 'mode-light')
          app.classList.add(`theme-${b}`, `mode-${m}`)
        }
      }, { b: theme.brand, m: theme.mode })
      await sleep(400)

      for (const view of views) {
        console.log(`  Capturing ${view.name} (${theme.label})...`)
        const tabBtn = page.locator(`[data-tab="${view.tab}"]`)
        if (await tabBtn.count() > 0) {
          await tabBtn.click()
          await sleep(500)
        }
        const filename = `${view.name}_${theme.label}.png`
        const localPath = join(LOCAL_DIR, filename)
        const artifactPath = join(ARTIFACT_DIR, filename)

        await page.screenshot({ path: localPath, fullPage: false })
        copyFileSync(localPath, artifactPath)
        console.log(`    Saved: ${localPath}`)
      }
    }

    await browser.close()
    console.log('\nAll final gate screenshots captured successfully!')
  } finally {
    viteProcess.kill()
  }
}

run().catch((err) => {
  console.error('Screenshot capture failed:', err)
  process.exit(1)
})
