import { spawn } from 'node:child_process'
import { mkdirSync, copyFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium } from '../frontend/node_modules/@playwright/test/index.mjs'

const ROOT = resolve(process.cwd())
const LOCAL_DIR = join(ROOT, 'docs/qa/screenshots/1080p-audit')
const ARTIFACT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/1080p-audit'

mkdirSync(LOCAL_DIR, { recursive: true })
mkdirSync(ARTIFACT_DIR, { recursive: true })

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return true
    } catch {
      // waiting
    }
    await sleep(250)
  }
  throw new Error(`Server at ${url} failed to respond`)
}

async function setupMockRoutes(page) {
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const urlStr = route.request().url()
    if (urlStr.includes('/auth/me')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, username: 'ronartz', email: 'ronartz@shinpo.dev' }) })
    }
    if (urlStr.includes('/onboarding/state')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'COMPLETED' }) })
    }
    if (urlStr.includes('/goals')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
        { id: 1, title: 'Master Distributed Systems', description: 'Design fault-tolerant event meshes', progress: 65, targetDate: '2026-12-01', status: 'ACTIVE' },
        { id: 2, title: 'Deep Work Discipline', description: 'Achieve 4 hours daily focused execution', progress: 80, targetDate: '2026-11-30', status: 'ACTIVE' },
        { id: 3, title: 'Physical Conditioning', description: 'Olympic lifting and mobility progression', progress: 40, targetDate: '2027-01-15', status: 'ACTIVE' }
      ]) })
    }
    if (urlStr.includes('/missions')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
        { id: 101, goalId: 1, title: 'Implement Raft Consensus State Machine', estimatedMinutes: 90, status: 'IN_PROGRESS', priority: 'HIGH' },
        { id: 102, goalId: 1, title: 'Write Byzantine Fault Unit Tests', estimatedMinutes: 60, status: 'TODO', priority: 'MEDIUM' },
        { id: 103, goalId: 2, title: 'Morning Focus Engine Session (Deep Core)', estimatedMinutes: 120, status: 'COMPLETED', priority: 'HIGH' },
        { id: 104, goalId: 2, title: 'Review Evening Architectural Ledger', estimatedMinutes: 45, status: 'TODO', priority: 'LOW' }
      ]) })
    }
    if (urlStr.includes('/focus/sessions') || urlStr.includes('/focus-sessions')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
        { id: 201, title: 'Kernel Optimization & Memory Profiling', durationMinutes: 45, elapsedSeconds: 2700, status: 'COMPLETED', startedAt: '2026-11-08T09:00:00Z', completedAt: '2026-11-08T09:45:00Z' },
        { id: 202, title: 'Frontend Architecture Refactoring', durationMinutes: 60, elapsedSeconds: 3600, status: 'COMPLETED', startedAt: '2026-11-08T11:00:00Z', completedAt: '2026-11-08T12:00:00Z' }
      ]) })
    }
    if (urlStr.includes('/progress')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ currentStreak: 7, totalXp: 1450, progressPercent: 68, level: 4, rankTitle: 'Execution Sentinel' }) })
    }
    if (urlStr.includes('/device/processes') || urlStr.includes('/processes')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
        { pid: 101, name: 'code', cpuPercent: 2.1, memoryBytes: 524288000, category: 'DEVELOPMENT', status: 'RUNNING' },
        { pid: 102, name: 'firefox', cpuPercent: 4.5, memoryBytes: 1048576000, category: 'BROWSER', status: 'RUNNING' },
        { pid: 103, name: 'discord', cpuPercent: 1.2, memoryBytes: 314572800, category: 'COMMUNICATION', status: 'RUNNING' },
        { pid: 104, name: 'spotify', cpuPercent: 0.8, memoryBytes: 209715200, category: 'MEDIA', status: 'RUNNING' }
      ]) })
    }
    if (urlStr.includes('/device/sentinel') || urlStr.includes('/sentinel')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ active: true, mode: 'PROTECTED', enforcementMode: 'DEFENSIVE', appsObserved: 4, blockedAttempts: 0, healthy: true }) })
    }
    if (urlStr.includes('/device/rules')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }
    if (urlStr.includes('/device/tamper')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }
    if (urlStr.includes('/device/apps') || urlStr.includes('/discovered-apps')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }
    if (urlStr.includes('/actions/pending') || urlStr.includes('/actions/recent')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }
    if (urlStr.includes('/conversations')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }
    if (urlStr.includes('/analytics/dashboard') || urlStr.includes('/analytics')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        totalFocusMinutes: 480,
        completedSessions: 8,
        summary: {
          completionRate: 85,
          missionsCompleted: 1,
          missionsTotal: 4,
          totalFocusMinutes: 480,
          averageSessionMinutes: 45,
          currentStreak: 7,
          avgQuality: 4.8
        },
        weeklyVelocity: [
          { date: '2026-11-02', focusMinutes: 90 },
          { date: '2026-11-03', focusMinutes: 75 },
          { date: '2026-11-04', focusMinutes: 120 },
          { date: '2026-11-05', focusMinutes: 60 },
          { date: '2026-11-06', focusMinutes: 105 },
          { date: '2026-11-07', focusMinutes: 80 },
          { date: '2026-11-08', focusMinutes: 105 }
        ],
        currentBuckets: [
          { start: '2026-11-02', activeSeconds: 5400, completedSessions: 2 },
          { start: '2026-11-03', activeSeconds: 4500, completedSessions: 1 },
          { start: '2026-11-04', activeSeconds: 7200, completedSessions: 3 },
          { start: '2026-11-05', activeSeconds: 3600, completedSessions: 1 },
          { start: '2026-11-06', activeSeconds: 6300, completedSessions: 2 },
          { start: '2026-11-07', activeSeconds: 4800, completedSessions: 1 },
          { start: '2026-11-08', activeSeconds: 6300, completedSessions: 2 }
        ],
        previousBuckets: [
          { start: '2026-10-26', activeSeconds: 3600, completedSessions: 1 },
          { start: '2026-10-27', activeSeconds: 4200, completedSessions: 1 },
          { start: '2026-10-28', activeSeconds: 5400, completedSessions: 2 },
          { start: '2026-10-29', activeSeconds: 3000, completedSessions: 1 },
          { start: '2026-10-30', activeSeconds: 4800, completedSessions: 2 },
          { start: '2026-10-31', activeSeconds: 3600, completedSessions: 1 },
          { start: '2026-11-01', activeSeconds: 4200, completedSessions: 1 }
        ],
        recentDebriefs: [
          { sessionId: 201, sessionName: 'Kernel Optimization & Memory Profiling', durationMinutes: 45, actualFocusMinutes: 45, quality: 5, accomplishment: 'Profiled buffer allocs and eliminated memory spikes', reflectionNote: 'Stayed in deep flow throughout', completedAt: '2026-11-08T09:45:00Z' },
          { sessionId: 202, sessionName: 'Frontend Architecture Refactoring', durationMinutes: 60, actualFocusMinutes: 60, quality: 5, accomplishment: 'Separated desktop and mobile styling', reflectionNote: 'Smooth progression', completedAt: '2026-11-08T12:00:00Z' }
        ],
        currentStart: '2026-11-02T00:00:00Z',
        currentEnd: '2026-11-08T23:59:59Z',
        previousStart: '2026-10-26T00:00:00Z',
        previousEnd: '2026-11-01T23:59:59Z',
        currentActiveSeconds: 38100,
        previousActiveSeconds: 28800,
        currentCompletedSessions: 12,
        previousCompletedSessions: 9,
        range: '7d',
        streakDays: 7
      }) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })
}

async function run() {
  console.log('Starting preview server for 1080p audit...')
  const proc = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
    cwd: join(ROOT, 'frontend'),
    stdio: 'pipe',
  })

  try {
    await waitForServer('http://localhost:4173/')
    console.log('Preview server ready at http://localhost:4173/\n')

    const browser = await chromium.launch({ headless: true })

    async function capture(page, filename) {
      const localPath = join(LOCAL_DIR, filename)
      const artifactPath = join(ARTIFACT_DIR, filename)
      await page.screenshot({ path: localPath })
      copyFileSync(localPath, artifactPath)
      console.log(`  Saved: ${filename}`)
    }

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
    })
    const page = await context.newPage()
    await setupMockRoutes(page)

    // Set authenticated state and bypass cinematic intro
    await page.addInitScript(() => {
      sessionStorage.setItem('shinpo_splash_shown', 'true')
      localStorage.setItem('shinpo_access_token', 'valid-mock-jwt-token')
      localStorage.setItem('shinpo_auth_user', JSON.stringify({ id: 1, username: 'ronartz', email: 'ronartz@shinpo.dev' }))
      localStorage.setItem('shinpo_onboarding_verified', 'true')
      localStorage.setItem('shinpo_tutorial_completed', 'true')
      localStorage.setItem('shinpo_tutorial_dismissed', 'true')
    })

    const tabs = [
      { id: 'Dashboard', name: '01_dashboard' },
      { id: 'Goals & Missions', name: '02_goals_missions' },
      { id: 'Focus Engine', name: '03_focus_engine' },
      { id: 'Schedule', name: '04_schedule' },
      { id: 'Task Manager', name: '05_task_manager' },
      { id: 'Analytics', name: '06_analytics' },
      { id: 'Rewards', name: '07_rewards' },
      { id: 'AI Assistant', name: '08_eonpai' },
    ]

    console.log('=== Capturing Tabs at 1920x1080 Aurora Dark ===')
    for (const tab of tabs) {
      console.log(`Loading tab: ${tab.id}...`)
      await page.goto(`http://localhost:4173/?v2=true&theme=dark&tab=${encodeURIComponent(tab.id)}`)
      await page.waitForSelector('.app-shell', { timeout: 10000 })
      await sleep(500)
      await capture(page, `current_1080p_${tab.name}_aurora_dark.png`)
    }

    console.log('\n=== Capturing Dashboard at 1920x1080 Classic Dark ===')
    await page.goto(`http://localhost:4173/?v2=false&theme=dark&tab=Dashboard`)
    await page.waitForSelector('.app-shell', { timeout: 10000 })
    await sleep(500)
    await capture(page, `current_1080p_dashboard_classic_dark.png`)

    console.log('\n=== Capturing Dashboard at 1920x1080 Aurora Light ===')
    await page.goto(`http://localhost:4173/?v2=true&theme=light&tab=Dashboard`)
    await page.waitForSelector('.app-shell', { timeout: 10000 })
    await sleep(500)
    await capture(page, `current_1080p_dashboard_aurora_light.png`)

    console.log('\n=== Capturing Dashboard at 1920x1080 Classic Light ===')
    await page.goto(`http://localhost:4173/?v2=false&theme=light&tab=Dashboard`)
    await page.waitForSelector('.app-shell', { timeout: 10000 })
    await sleep(500)
    await capture(page, `current_1080p_dashboard_classic_light.png`)

    console.log('\n=== Capturing Login Card at 1920x1080 ===')
    await page.evaluate(() => {
      localStorage.removeItem('shinpo_access_token')
      localStorage.removeItem('shinpo_auth_user')
    })
    await page.goto('http://localhost:4173/')
    await page.waitForSelector('.animated-login-stage', { timeout: 10000 })
    await sleep(1000)
    await capture(page, `current_1080p_login_aurora_dark.png`)

    await browser.close()
    console.log('\nAudit captures completed successfully!')
  } finally {
    proc.kill('SIGTERM')
  }
}

run().catch((err) => {
  console.error('Error during 1080p audit:', err)
  process.exit(1)
})
