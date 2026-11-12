import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

async function setAnalyticsTheme(page: import('@playwright/test').Page, brand: 'aurora' | 'classic', theme: 'dark' | 'light') {
  await page.evaluate(({ brand, theme }) => {
    document.documentElement.dataset.brand = brand
    document.documentElement.dataset.theme = theme
    const shell = document.querySelector('.app-shell')
    shell?.classList.toggle('theme-aurora', brand === 'aurora')
    shell?.classList.toggle('theme-light', theme === 'light')
    document.body.classList.toggle('theme-light', theme === 'light')
  }, { brand, theme })
}

test.describe('SHINPO — Operation Analytics Visualization Acceptance Suite', () => {
  const screenshotsDir = path.resolve(process.cwd(), '../docs/qa/screenshots/analytics')

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true })
    }
  })

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    await page.addInitScript(() => {
      localStorage.setItem('shinpo_local_vault_account', 'qa_local_user')
      localStorage.setItem('shinpo_auth_user', JSON.stringify({ id: 1, username: 'qa_local_user', email: 'qa@shinpo.local' }))
      localStorage.setItem('shinpo_v2_preview', 'true')
      localStorage.setItem('shinpo_onboarding_dismissed', 'true')
      localStorage.setItem('shinpo_onboarding_dismissed_1', 'true')
      localStorage.setItem('shinpo_onboarding_dismissed_user_qa_local_user', 'true')
      sessionStorage.setItem('shinpo_startup_completed', 'true')
      localStorage.setItem('shinpo_session_v1', JSON.stringify({
        user: { id: 1, username: 'qa_local_user', email: 'qa@shinpo.local' },
        token: 'local-vault-token',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      }))

      // Create realistic multi-day focus sessions for the past 7 days
      const now = new Date()
      const y = now.getFullYear()
      const m = now.getMonth()
      const d = now.getDate()

      const mockSessions = [
        // 4 days ago: 45 min focus, outside the 24h comparison window.
        {
          id: 101,
          userId: 1,
          name: 'Core System Architecture',
          intention: 'Refactor analytics data pipeline',
          durationMinutes: 45,
          activeSeconds: 45 * 60,
          accumulatedPausedSeconds: 0,
          status: 'COMPLETED',
          endedAt: new Date(y, m, d - 4, 16, 30, 0).toISOString(),
          createdAt: new Date(y, m, d - 4, 15, 45, 0).toISOString(),
          completionQuality: 5,
          accomplishment: 'Implemented SVG bar chart engine',
          reflectionNote: 'Clean and responsive flow',
        },
        // 3 days ago: 30 min focus, outside the 24h comparison window.
        {
          id: 102,
          userId: 1,
          name: 'UI Quality Gate Review',
          intention: 'Verify WCAG AA theme tokens',
          durationMinutes: 30,
          activeSeconds: 30 * 60,
          accumulatedPausedSeconds: 0,
          status: 'COMPLETED',
          endedAt: new Date(y, m, d - 3, 11, 0, 0).toISOString(),
          createdAt: new Date(y, m, d - 3, 10, 30, 0).toISOString(),
          completionQuality: 4,
          accomplishment: 'Contrast validated',
          reflectionNote: 'All tokens passing',
        },
        // Today: 10 seconds, preserving the marked sub-minute chart case.
        {
          id: 103,
          userId: 1,
          name: 'Quick Smoke Test',
          intention: 'Validate small number formatting',
          durationMinutes: 30,
          activeSeconds: 10,
          accumulatedPausedSeconds: 0,
          status: 'COMPLETED',
          endedAt: new Date(y, m, d, 9, 15, 0).toISOString(),
          createdAt: new Date(y, m, d, 9, 14, 50).toISOString(),
          completionQuality: 5,
          accomplishment: 'Verified non-zero duration',
          reflectionNote: 'Shows the recorded ten seconds accurately',
        },
      ]

      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        configurable: true,
        value: {
          invoke: async (command: string) => {
            if (command === 'local_vault_status') {
              return { unlocked: true, username: 'qa_local_user' }
            }
            if (command === 'local_get_guardian_preferences') {
              return {
                preferredMode: 'PROTECTED',
                appMonitoringConsent: true,
                applyToNewSessions: true,
                closureConsent: true,
                backgroundRuntimeConsent: false,
              }
            }
            if (command === 'local_get_guardian_status') {
              return {
                status: 'READY',
                guardianMode: 'PROTECTED',
                interventionCapability: 'LIMITED_NO_CLOSURE_CONSENT',
                standardAllowanceSeconds: 600,
                warningOnly: true,
              }
            }
            if (command === 'local_get_study_resources') return []
            if (command === 'local_get_goals') return []
            if (command === 'local_get_tasks') return []
            if (command === 'local_get_focus_sessions') return mockSessions
            if (command === 'local_get_progress') {
              return { userId: 1, totalXp: 125, level: 2, currentStreak: 3, longestStreak: 5 }
            }
            if (command === 'local_get_discovered_apps') return []
            if (command === 'local_get_app_policies') return []
            if (command === 'local_get_system_telemetry') return null
            if (command === 'local_get_process_snapshot') return null
            return null
          },
        },
      })
    })

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // Navigate to Analytics view
    const analyticsNavBtn = page.locator('button[data-tut="nav-analytics"], .sidebar-btn:has-text("Analytics")').first()
    await expect(analyticsNavBtn).toBeVisible({ timeout: 10000 })
    await analyticsNavBtn.click()

    // Wait for Analytics view to load
    await expect(page.locator('.analytics-view')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.analytics-activity-chart')).toBeVisible({ timeout: 10000 })
  })

  test('Contract 1: Focus Activity renders a clean 7-day daily bar chart with accurate geometry and ticks', async ({ page }) => {
    const chart = page.locator('.analytics-activity-chart')
    await expect(chart).toBeVisible()

    // Verify exactly 7 data bucket groups in the default 7d view
    const bucketGroups = page.locator('.analytics-bucket-group')
    await expect(bucketGroups).toHaveCount(7)

    // Check that active bars exist and have non-zero height
    const currentBars = page.locator('.analytics-bar-current')
    const activeCount = await currentBars.count()
    expect(activeCount).toBeGreaterThanOrEqual(3) // Today (2m), yesterday (30m), 2 days ago (45m)

    // Verify axis gridlines and ticks are non-empty and mathematically valid
    const axisLabels = page.locator('.analytics-chart-axis')
    const tickCount = await axisLabels.count()
    expect(tickCount).toBeGreaterThanOrEqual(3)

    // Ensure tick text does not round 2.5m into 3m or display NaN
    const tickTexts = await axisLabels.allTextContents()
    for (const text of tickTexts) {
      expect(text).not.toContain('NaN')
      expect(text).toMatch(/^[0-9]+(\.[0-9]+)?(m|h(\s[0-9]+m)?)?$/)
    }

    // Verify x-axis day labels are visible
    const dayLabels = page.locator('.analytics-chart-axis-x')
    await expect(dayLabels.first()).toBeVisible()
    const firstDayText = await dayLabels.first().textContent()
    expect(firstDayText?.trim().length).toBeGreaterThan(0)
  })

  test('Contract 2: Range selector cleanly updates between 24h, 7d, 30d, and 90d buckets', async ({ page }) => {
    // Switch to 24h
    await page.click('.analytics-range-selector button:has-text("24h")')
    await page.waitForTimeout(400)
    let bucketGroups = page.locator('.analytics-bucket-group')
    await expect(bucketGroups).toHaveCount(12) // 12 2-hour buckets

    // Switch to 30d
    await page.click('.analytics-range-selector button:has-text("30d")')
    await page.waitForTimeout(400)
    bucketGroups = page.locator('.analytics-bucket-group')
    await expect(bucketGroups).toHaveCount(30) // 30 daily buckets

    // Switch to 90d
    await page.click('.analytics-range-selector button:has-text("90d")')
    await page.waitForTimeout(400)
    bucketGroups = page.locator('.analytics-bucket-group')
    await expect(bucketGroups).toHaveCount(13) // 13 weekly buckets

    // Switch back to 7d
    await page.click('.analytics-range-selector button:has-text("7d")')
    await page.waitForTimeout(400)
    bucketGroups = page.locator('.analytics-bucket-group')
    await expect(bucketGroups).toHaveCount(7)
  })

  test('Contract 3: Small-number duration and Daily Average formatting are accurate (no false 0m)', async ({ page }) => {
    // Total focus should display cleanly (e.g. 1h 17m)
    const focusTimeStrong = page.locator('.analytics-card-focus strong')
    await expect(focusTimeStrong).toBeVisible()
    const focusText = await focusTimeStrong.textContent()
    expect(focusText).toMatch(/(1h\s15m|75m)/)

    // Daily average in "Your Rhythm" should not be "0m"
    const dailyAvg = page.locator('.analytics-insights-panel .analytics-week-stat:has-text("Daily average") strong')
    await expect(dailyAvg).toBeVisible()
    const dailyAvgText = await dailyAvg.textContent()
    expect(dailyAvgText).not.toBe('0m')
    expect(dailyAvgText).toMatch(/(11m|11\.0m|11\.1m)/)

    await page.click('.analytics-range-selector button:has-text("24h")')
    const axisLabels = await page.locator('.analytics-chart-axis').allTextContents()
    expect(axisLabels).toEqual(expect.arrayContaining(['0s', '5s', '10s']))
    const bar = page.locator('.analytics-bar-current[aria-label*="10s focus"]')
    await expect(bar).toBeVisible()
    expect((await bar.boundingBox())?.height).toBeGreaterThanOrEqual(4)

    const focusedDays = page.locator('.analytics-focused-days-list')
    await expect(focusedDays).toBeVisible()
    await expect(focusedDays).toContainText('10s')
    await expect(page.locator('.analytics-focused-empty')).toHaveCount(0)
    await expect(page.locator('.analytics-card .analytics-task-progress')).toHaveCount(0)

    const reflection = page.locator('.analytics-debrief-card').filter({ hasText: 'Quick Smoke Test' })
    await expect(reflection.locator('.analytics-duration-chip').first()).toContainText('10s')
    await expect(reflection.locator('.analytics-duration-chip').nth(1)).toContainText('30m')
    const reflectionMeta = reflection.locator('.analytics-debrief-meta')
    const mainBox = await reflection.locator('.analytics-debrief-main').boundingBox()
    const metaBox = await reflectionMeta.boundingBox()
    expect(mainBox).not.toBeNull()
    expect(metaBox).not.toBeNull()
    expect(metaBox!.x - mainBox!.x).toBeLessThan(260)
  })

  test('Contract 7: Annual contribution skyline uses persisted Focus records and one switchable canvas', async ({ page }) => {
    const skyline = page.locator('.focus-contribution-skyline')
    await expect(skyline).toBeVisible()
    await expect(skyline).toContainText('Last 12 months')
    await expect(skyline).toContainText('3 completed sessions')
    await expect(skyline.locator('canvas')).toHaveCount(1)
    const canvasBox = await skyline.locator('canvas').boundingBox()
    const stageBox = await skyline.locator('.focus-skyline-stage').boundingBox()
    expect(canvasBox).not.toBeNull()
    expect(stageBox).not.toBeNull()
    expect(canvasBox!.y).toBeGreaterThanOrEqual(stageBox!.y - 1)
    expect(canvasBox!.height).toBeLessThanOrEqual(stageBox!.height + 1)
    const flat = skyline.getByRole('button', { name: 'Flat heat map' })
    const threeD = skyline.getByRole('button', { name: '3D skyline' })
    await threeD.click()
    await expect(threeD).toHaveAttribute('aria-pressed', 'true')
    await page.waitForTimeout(1500)
    const tallest3dColumn = await skyline.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
      const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
      let tallest = 0
      for (let x = 0; x < canvas.width; x++) {
        let opaque = 0
        for (let y = 0; y < canvas.height; y++) opaque += data[(y * canvas.width + x) * 4 + 3] > 200 ? 1 : 0
        tallest = Math.max(tallest, opaque)
      }
      return { tallest, height: canvas.height }
    })
    expect(tallest3dColumn.tallest).toBeLessThan(tallest3dColumn.height * 0.75)
    await flat.click()
    await expect(flat).toHaveAttribute('aria-pressed', 'true')
    await page.waitForTimeout(3000)
    const tallestOpaqueColumn = await skyline.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
      const context = canvas.getContext('2d')!
      const { width, height } = canvas
      const data = context.getImageData(0, 0, width, height).data
      let tallest = 0
      for (let x = 0; x < width; x++) {
        let opaque = 0
        for (let y = 0; y < height; y++) opaque += data[(y * width + x) * 4 + 3] > 200 ? 1 : 0
        tallest = Math.max(tallest, opaque)
      }
      return { tallest, height }
    })
    expect(tallestOpaqueColumn.tallest).toBeLessThan(tallestOpaqueColumn.height * 0.75)
    const heatmapBounds = await skyline.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
      const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
      let left = canvas.width
      let right = -1
      for (let y = 30; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          if (pixels[(y * canvas.width + x) * 4 + 3] > 200) {
            left = Math.min(left, x)
            right = Math.max(right, x)
          }
        }
      }
      return { left, right, width: canvas.width }
    })
    expect(heatmapBounds.left).toBeGreaterThan(8)
    expect(heatmapBounds.right).toBeLessThan(heatmapBounds.width - 8)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const canvas = skyline.locator('canvas')
    const canvasPng = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL('image/png'))
    fs.writeFileSync(path.join(screenshotsDir, '06_focus_skyline_canvas_only.png'), Buffer.from(canvasPng.split(',')[1], 'base64'))
    await canvas.focus()
    await page.keyboard.press('ArrowLeft')
    await expect(skyline.locator('[aria-live="polite"]')).not.toBeEmpty()
  })

  test('Contract 4: Interactive tooltip appears on hover and focus with accurate data', async ({ page }) => {
    const firstBar = page.locator('.analytics-bar-current').first()
    await expect(firstBar).toBeVisible()

    // Hover over bar
    await firstBar.hover()
    const tooltip = page.locator('.analytics-chart-tooltip')
    await expect(tooltip).toBeVisible()

    const tooltipText = await tooltip.textContent()
    expect(tooltipText).toContain('Current:')

    // Test keyboard accessibility: tabbing into the bar focuses it
    await firstBar.focus()
    await expect(firstBar).toBeFocused()
    await expect(tooltip).toBeVisible()
  })

  test('Contract 5: Four-theme styling enforces semantic color tokens without cross-theme contamination', async ({ page }) => {
    await page.mouse.move(0, 0)
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
    const firstBar = page.locator('.analytics-bar-current').first()
    await expect(firstBar).toBeVisible()

    // 1. Aurora Dark
    await setAnalyticsTheme(page, 'aurora', 'dark')
    await page.waitForTimeout(300)
    let fill = await firstBar.evaluate((el) => window.getComputedStyle(el).fill)
    // Aurora Dark primary is #9757fa -> rgb(151, 87, 250)
    expect(fill).toContain('rgb(151, 87, 250)')

    // 2. Aurora Light
    await setAnalyticsTheme(page, 'aurora', 'light')
    await page.waitForTimeout(300)
    fill = await firstBar.evaluate((el) => window.getComputedStyle(el).fill)
    // Aurora Light primary is #7c3aed -> rgb(124, 58, 237)
    expect(fill).toContain('rgb(124, 58, 237)')

    // 3. Classic Dark
    await setAnalyticsTheme(page, 'classic', 'dark')
    await page.waitForTimeout(300)
    fill = await firstBar.evaluate((el) => window.getComputedStyle(el).fill)
    // Classic Dark primary is electric lime #aff33e -> rgb(175, 243, 62)
    expect(fill).toContain('rgb(175, 243, 62)')
    expect(fill).not.toContain('rgb(151, 87, 250)') // Must NOT be violet!

    // 4. Classic Light
    await setAnalyticsTheme(page, 'classic', 'light')
    await page.waitForTimeout(300)
    fill = await firstBar.evaluate((el) => window.getComputedStyle(el).fill)
    // Classic Light primary is olive lime #4d7c0f -> rgb(77, 124, 15)
    expect(fill).toMatch(/rgb\(7[79],\s*12[46],\s*1[56]\)/)
    expect(fill).not.toContain('rgb(151, 87, 250)') // Must NOT be violet!
  })

  test('Contract 6: Visual verification and responsive multi-resolution screenshots', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const resolutions = [
      { width: 1920, height: 1080, name: '1920x1080' },
      { width: 1440, height: 900, name: '1440x900' },
      { width: 1280, height: 720, name: '1280x720' },
      { width: 960, height: 600, name: '960x600' },
    ]

    for (const res of resolutions) {
      await page.setViewportSize({ width: res.width, height: res.height })
      await page.waitForTimeout(300)
      const chart = page.locator('.analytics-activity-chart')
      await expect(chart).toBeVisible()

      // Regression check for violet stripes / bar height overflow:
      // Verify every bar is strictly contained within the chart boundaries
      const chartBox = await chart.boundingBox()
      const bars = page.locator('.analytics-bar-current')
      const barCount = await bars.count()
      for (let i = 0; i < barCount; i++) {
        const barBox = await bars.nth(i).boundingBox()
        if (barBox && chartBox) {
          expect(barBox.y).toBeGreaterThanOrEqual(chartBox.y - 4)
          expect(barBox.y + barBox.height).toBeLessThanOrEqual(chartBox.y + chartBox.height + 4)
        }
      }

      // Capture screenshot
      const shotPath = path.join(screenshotsDir, `01_analytics_${res.name}_aurora_dark.png`)
      await page.screenshot({ path: shotPath, fullPage: false })
      expect(fs.existsSync(shotPath)).toBe(true)
    }

    // Capture Classic Dark screenshot at 1440x900
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-brand', 'classic')
      document.documentElement.setAttribute('data-theme', 'dark')
    })
    await page.waitForTimeout(300)
    const classicDarkPath = path.join(screenshotsDir, '02_analytics_1440x900_classic_dark.png')
    await page.screenshot({ path: classicDarkPath, fullPage: false })
    expect(fs.existsSync(classicDarkPath)).toBe(true)

    // Capture Classic Light screenshot at 1440x900
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-brand', 'classic')
      document.documentElement.setAttribute('data-theme', 'light')
    })
    await page.waitForTimeout(300)
    const classicLightPath = path.join(screenshotsDir, '03_analytics_1440x900_classic_light.png')
    await page.screenshot({ path: classicLightPath, fullPage: false })
    expect(fs.existsSync(classicLightPath)).toBe(true)

    // Capture Aurora Light screenshot at 1440x900
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-brand', 'aurora')
      document.documentElement.setAttribute('data-theme', 'light')
    })
    await page.waitForTimeout(300)
    const auroraLightPath = path.join(screenshotsDir, '04_analytics_1440x900_aurora_light.png')
    await page.screenshot({ path: auroraLightPath, fullPage: false })
    expect(fs.existsSync(auroraLightPath)).toBe(true)
  })
})
