import { test, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const MOCK_USER = {
  id: 1,
  email: 'founder@shinpo.dev',
  username: 'eonx',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
}

const MOCK_GOALS = [
  { id: 1, title: 'Master 3D Particle Visuals', status: 'IN_PROGRESS', progress: 65, color: '#9757FA' },
]

const MOCK_MISSIONS = [
  { id: 101, goalId: 1, title: 'Verify Floating Canvas', status: 'COMPLETED', points: 50 },
]

const MOCK_SESSIONS = [
  {
    id: 201,
    title: 'Aurora Engine Verification',
    durationMinutes: 45,
    status: 'READY',
    startTime: null,
    endTime: null,
    breaksTaken: 0,
  },
]

const MOCK_ACTIVE_SESSION = [
  {
    id: 202,
    title: 'Deep Focus Sprint',
    durationMinutes: 45,
    status: 'ACTIVE',
    startTime: new Date().toISOString(),
    endTime: null,
    breaksTaken: 0,
    serverTime: new Date().toISOString(),
  },
]

const MOCK_PAUSED_SESSION = [
  {
    id: 203,
    title: 'Midpoint Pause Verification',
    durationMinutes: 45,
    status: 'PAUSED',
    startTime: new Date().toISOString(),
    endTime: null,
    remainingSeconds: 1200,
    breaksTaken: 1,
    serverTime: new Date().toISOString(),
  },
]

async function setupMockRoutes(page: any, focusSessions: any = MOCK_SESSIONS) {
  await page.route((url: URL) => url.pathname.startsWith('/api/'), async (route: any) => {
    const url = route.request().url()
    if (url.includes('/auth/me')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_USER) })
    }
    if (url.includes('/api/goals')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_GOALS) })
    }
    if (url.includes('/api/missions')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_MISSIONS) })
    }
    if (url.includes('/api/focus-sessions')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(focusSessions) })
    }
    if (url.includes('/api/contextual-focus/resources') || url.includes('/api/contextual-focus/restrictions')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }
    if (url.includes('/api/contextual-focus/status')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
    }
    if (url.includes('/api/analytics/period')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          range: '7d',
          timezone: 'UTC',
          currentStart: '2026-11-01T00:00:00.000Z',
          currentEnd: '2026-11-07T23:59:59.999Z',
          currentBuckets: [],
          previousBuckets: [],
          currentActiveSeconds: 7200,
          currentCompletedSessions: 4,
          previousActiveSeconds: 5400,
          previousCompletedSessions: 3,
        }),
      })
    }
    if (url.includes('/api/analytics')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          stats: { totalFocusMinutes: 120, sessionsStarted: 4, missionsCompleted: 1, currentStreak: 3 },
          weeklyVelocity: [],
          recentDebriefs: [],
        }),
      })
    }
    if (url.includes('/api/device/sentinel/status')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ACTIVE',
          shieldConnected: true,
          enforcementMode: 'CONTAINMENT',
          observerStatus: 'READY',
          guardianMode: 'PROTECTED',
        }),
      })
    }
    if (url.includes('/api/device/sentinel/warnings')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }
    if (url.includes('/api/device/sentinel/rules')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }
    if (url.includes('/api/device/snapshot')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          systemInfo: { systemCpuLoad: 10, availableProcessors: 8, totalMemoryBytes: 16e9, freeMemoryBytes: 8e9, processCount: 100 },
          processes: [],
        }),
      })
    }
    if (url.includes('/api/progress')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          userId: 1,
          totalXp: 500,
          levelTitle: 'Architect of Flow',
          level: 5,
          nextLevelThreshold: 200,
          progressPercent: 30,
          streakDays: 4,
          recentEvents: [],
        }),
      })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })
}

async function loginAndNavigate(page: any, tab: string, isV2 = true, theme = 'dark', focusSessions: any = MOCK_SESSIONS) {
  await setupMockRoutes(page, focusSessions)
  await page.addInitScript(() => {
    localStorage.setItem('shinpo_access_token', 'valid-mock-jwt-token')
    localStorage.setItem('shinpo_auth_user', JSON.stringify({ id: 1, username: 'testuser', email: 'test@shinpo.dev' }))
  })
  await page.goto(`/?tab=${encodeURIComponent(tab)}&v2=${isV2}&theme=${theme}`)
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 10000 })
}

test.describe('Shinpo Global 3D Particle Background', () => {
  const screenshotDir = path.resolve(process.cwd(), 'docs/qa/screenshots/particles')

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true })
    }
  })

  test('canvas mounts with correct fixed geometry and layer 1 z-index', async ({ page }) => {
    await loginAndNavigate(page, 'Dashboard', true, 'dark')

    const canvas = page.locator('canvas.shinpo-particles')
    await expect(canvas).toBeVisible()
    await expect(canvas).toHaveAttribute('data-testid', 'shinpo-particles')
    await expect(canvas).toHaveAttribute('aria-hidden', 'true')

    const styles = await canvas.evaluate((el) => {
      const computed = window.getComputedStyle(el)
      return {
        position: computed.position,
        zIndex: computed.zIndex,
        pointerEvents: computed.pointerEvents,
        display: computed.display,
      }
    })

    expect(styles.position).toBe('fixed')
    expect(styles.zIndex).toBe('0')
    expect(styles.pointerEvents).toBe('none')
    expect(styles.display).toBe('block')

    const appMainStyles = await page.locator('.app-main').evaluate((el) => {
      const computed = window.getComputedStyle(el)
      return {
        position: computed.position,
        zIndex: computed.zIndex,
      }
    })

    expect(appMainStyles.position).toBe('relative')
    expect(appMainStyles.zIndex).toBe('1')

    const sidebarStyles = await page.locator('.icon-sidebar').evaluate((el) => {
      const computed = window.getComputedStyle(el)
      return {
        position: computed.position,
        zIndex: computed.zIndex,
      }
    })

    expect(sidebarStyles.position).toBe('fixed')
    expect(Number(sidebarStyles.zIndex)).toBeGreaterThanOrEqual(100)
  })

  test('particles continuously animate across frames and sample non-blank pixels', async ({ page }) => {
    await loginAndNavigate(page, 'Dashboard', true, 'dark')
    const canvas = page.locator('canvas.shinpo-particles')
    await expect(canvas).toBeVisible()

    // Wait a brief tick for initialization
    await page.waitForTimeout(350)

    // Capture frame 1 canvas image data
    const frame1 = await canvas.evaluate((el: HTMLCanvasElement) => {
      const ctx = el.getContext('2d')
      if (!ctx) return null
      const data = ctx.getImageData(0, 0, el.width, el.height).data
      let nonZeroCount = 0
      let checksum = 0
      // Always step by multiples of 4 (pixel alignment)
      const pixelStep = Math.max(1, Math.floor(data.length / (4 * 10000)))
      const byteStep = pixelStep * 4
      for (let i = 0; i < data.length; i += byteStep) {
        if (data[i + 3] > 0) nonZeroCount++
        checksum = (checksum * 33 + data[i] + data[i + 1] + data[i + 2] + data[i + 3]) | 0
      }
      return { nonZeroCount, checksum }
    })

    expect(frame1).not.toBeNull()
    expect(frame1!.nonZeroCount).toBeGreaterThan(0)

    // Wait 500ms for continuous animation drift
    await page.waitForTimeout(500)

    // Capture frame 2
    const frame2 = await canvas.evaluate((el: HTMLCanvasElement) => {
      const ctx = el.getContext('2d')
      if (!ctx) return null
      const data = ctx.getImageData(0, 0, el.width, el.height).data
      let nonZeroCount = 0
      let checksum = 0
      const pixelStep = Math.max(1, Math.floor(data.length / (4 * 10000)))
      const byteStep = pixelStep * 4
      for (let i = 0; i < data.length; i += byteStep) {
        if (data[i + 3] > 0) nonZeroCount++
        checksum = (checksum * 33 + data[i] + data[i + 1] + data[i + 2] + data[i + 3]) | 0
      }
      return { nonZeroCount, checksum }
    })

    expect(frame2).not.toBeNull()
    expect(frame2!.nonZeroCount).toBeGreaterThan(0)
    // The canvas pixels must have shifted between frame 1 and frame 2
    expect(frame1!.checksum).not.toBe(frame2!.checksum)
  })

  test('continuous animation persists during Focus READY, ACTIVE, and PAUSED', async ({ page }) => {
    const sampleCanvas = (el: HTMLCanvasElement) => {
      const ctx = el.getContext('2d')
      if (!ctx) return { nonZero: 0, checksum: 0 }
      const data = ctx.getImageData(0, 0, el.width, el.height).data
      let nonZero = 0
      let checksum = 0
      const pixelStep = Math.max(1, Math.floor(data.length / (4 * 10000)))
      const byteStep = pixelStep * 4
      for (let i = 0; i < data.length; i += byteStep) {
        if (data[i + 3] > 0) nonZero++
        checksum = (checksum * 33 + data[i] + data[i + 1] + data[i + 2] + data[i + 3]) | 0
      }
      return { nonZero, checksum }
    }

    // 1. READY state
    await loginAndNavigate(page, 'Focus Engine', true, 'dark', MOCK_SESSIONS)
    const canvas = page.locator('canvas.shinpo-particles')
    await expect(canvas).toBeVisible()
    await page.waitForTimeout(350)

    const readyCheck1 = await canvas.evaluate(sampleCanvas)
    await page.waitForTimeout(500)
    const readyCheck2 = await canvas.evaluate(sampleCanvas)
    expect(readyCheck1.nonZero).toBeGreaterThan(0)
    expect(readyCheck2.nonZero).toBeGreaterThan(0)
    expect(readyCheck1.checksum).not.toBe(readyCheck2.checksum)

    // 2. ACTIVE state
    await loginAndNavigate(page, 'Focus Engine', true, 'dark', MOCK_ACTIVE_SESSION)
    await expect(canvas).toBeVisible()
    await page.waitForTimeout(350)
    const activeCheck1 = await canvas.evaluate(sampleCanvas)
    await page.waitForTimeout(500)
    const activeCheck2 = await canvas.evaluate(sampleCanvas)
    expect(activeCheck1.nonZero).toBeGreaterThan(0)
    expect(activeCheck2.nonZero).toBeGreaterThan(0)
    expect(activeCheck1.checksum).not.toBe(activeCheck2.checksum)

    // 3. PAUSED state
    await loginAndNavigate(page, 'Focus Engine', true, 'dark', MOCK_PAUSED_SESSION)
    await expect(canvas).toBeVisible()
    await page.waitForTimeout(350)
    const pausedCheck1 = await canvas.evaluate(sampleCanvas)
    await page.waitForTimeout(500)
    const pausedCheck2 = await canvas.evaluate(sampleCanvas)
    expect(pausedCheck1.nonZero).toBeGreaterThan(0)
    expect(pausedCheck2.nonZero).toBeGreaterThan(0)
    expect(pausedCheck1.checksum).not.toBe(pausedCheck2.checksum)
  })

  test('captures visual proof screenshots across exposed background views', async ({ page }) => {
    const tabs = ['Dashboard', 'Goals & Missions', 'Focus Engine', 'Schedule', 'Analytics', 'AI Assistant']

    for (const tab of tabs) {
      await loginAndNavigate(page, tab, true, 'dark')
      await page.waitForTimeout(400)
      const tabSlug = tab.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      const screenshotPath = path.join(screenshotDir, `aurora-particles-${tabSlug}.png`)
      await page.screenshot({ path: screenshotPath, fullPage: false })
      expect(fs.existsSync(screenshotPath)).toBe(true)
    }
  })
})
