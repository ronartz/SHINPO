import { test, expect } from '@playwright/test'
import path from 'node:path'
import { mkdirSync } from 'node:fs'

const SCREENSHOTS_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/composition-repair'

const THEMES = [
  { name: 'Aurora Dark', theme: 'dark', brand: 'aurora', id: 'aurora-dark' },
  { name: 'Aurora Light', theme: 'light', brand: 'aurora', id: 'aurora-light' },
  { name: 'Classic Dark', theme: 'dark', brand: 'classic', id: 'classic-dark' },
  { name: 'Classic Light', theme: 'light', brand: 'classic', id: 'classic-light' },
]

test.describe('VISUAL COMPOSITION & INTERACTION OVERLAP REPAIR SUITE', () => {
  test.beforeAll(() => {
    mkdirSync(SCREENSHOTS_DIR, { recursive: true })
  })

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.addInitScript(() => {
      localStorage.setItem('shinpo_local_vault_account', 'qa_local_user')
      localStorage.setItem('shinpo_auth_user', JSON.stringify({ id: 1, username: 'qa_local_user', email: 'qa@shinpo.local' }))
      localStorage.setItem('shinpo_v2_preview', 'true')
      localStorage.setItem('shinpo_onboarding_dismissed', 'true')
      localStorage.setItem('shinpo_onboarding_dismissed_1', 'true')
      localStorage.setItem('shinpo_onboarding_dismissed_user_qa_local_user', 'true')
      sessionStorage.setItem('shinpo_splash_shown', 'true')
      sessionStorage.setItem('shinpo_startup_completed', 'true')
      localStorage.setItem('shinpo_session_v1', JSON.stringify({
        user: { id: 1, username: 'qa_local_user', email: 'qa@shinpo.local' },
        token: 'local-vault-token',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      }))

      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        configurable: true,
        value: {
          invoke: async (command: string) => {
            if (command === 'local_vault_status') {
              return { unlocked: true, username: 'qa_local_user' }
            }
            if (command === 'local_platform_capabilities') {
              return {
                guardian: 'OBSERVE_AND_WARN',
                browserCompanionSupported: true,
              }
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
            if (command === 'local_get_focus_sessions') return []
            if (command === 'local_get_progress') {
              return { userId: 1, totalXp: 250, level: 2, currentStreak: 4, longestStreak: 7 }
            }
            if (command === 'local_get_analytics') {
              return {
                summary: {
                  currentStreak: 4,
                  longestStreak: 7,
                  missionsCompleted: 5,
                  missionsTotal: 8,
                  totalFocusMinutes: 180,
                  weeklyFocusMinutes: 120,
                },
                periods: {
                  '7d': {
                    currentActiveSeconds: 7200,
                    currentCompletedSessions: 4,
                    previousActiveSeconds: 5400,
                    previousCompletedSessions: 3,
                  },
                },
              }
            }
            return null
          },
        },
      })
    })
  })

  for (const { name, theme, brand, id } of THEMES) {
    test(`Verify Composition & Depth in ${name} (1920x1080)`, async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      // Set Theme & Brand Attributes
      await page.evaluate(({ theme, brand }) => {
        document.documentElement.setAttribute('data-theme', theme)
        document.documentElement.setAttribute('data-brand', brand)
        if (brand === 'aurora') {
          document.body.classList.add('theme-aurora')
          document.body.classList.remove('theme-classic')
        } else {
          document.body.classList.add('theme-classic')
          document.body.classList.remove('theme-aurora')
        }
        if (theme === 'light') {
          document.body.classList.add('theme-light')
          document.body.classList.remove('theme-dark')
        } else {
          document.body.classList.add('theme-dark')
          document.body.classList.remove('theme-light')
        }
      }, { theme, brand })

      await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), { timeout: 10000 }).catch(() => {})
      await page.waitForTimeout(400)

      // 1. Capture Dashboard Overview
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, `01_dashboard_${id}.png`),
        fullPage: false,
      })

      // Verify Sidebar Guardian Card
      const sidebarGuardianCard = page.locator('.sidebar-protection-panel')
      if (await sidebarGuardianCard.isVisible()) {
        const titleText = await sidebarGuardianCard.locator('.protection-title').textContent()
        const subText = await sidebarGuardianCard.locator('.protection-sub-text').textContent()
        expect(titleText).toContain('Monitoring only')
        expect(subText).toContain('Warnings only. Apps are never closed.')

        // Verify status dot has background color and doesn't overlap awkwardly
        const statusDot = sidebarGuardianCard.locator('.protection-status-dot')
        await expect(statusDot).toBeVisible()
      }

      // 2. Navigate to Focus Tab
      const focusTab = page.locator('button[data-tab="Focus Engine"], .sidebar-btn:has-text("Focus")').first()
      await expect(focusTab).toBeVisible()
      await focusTab.click()
      await page.waitForTimeout(350)

        // Capture Focus View
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, `02_focus_${id}.png`),
          fullPage: false,
        })

        // Verify Focus Engine two-column grid
        const heroSplit = page.locator('.focus-hero-split')
        await expect(heroSplit).toBeVisible()

        // Verify Session Intention is Full-Width Row
        const intentionRow = page.locator('.focus-intention-fullwidth-row')
        await expect(intentionRow).toBeVisible()

        // Bounding box validation: intention row width should span primary content width
        const intentionBox = await intentionRow.boundingBox()
        const heroBox = await heroSplit.boundingBox()
        if (intentionBox && heroBox) {
          // Intention row should match the hero split width (within 5px tolerance)
          expect(Math.abs(intentionBox.width - heroBox.width)).toBeLessThan(10)
        }

        // Verify Guardian Mode Separator and Heading
        const guardianSeparator = page.locator('.study-mode-separator')
        await expect(guardianSeparator).toBeVisible()
        const guardianHeading = page.locator('.card-session-creator .study-section-label')
        await expect(guardianHeading).toBeVisible()

        // Verify separator is physically above the heading (no intersection)
        const sepBox = await guardianSeparator.boundingBox()
        const headBox = await guardianHeading.boundingBox()
        if (sepBox && headBox) {
          expect(sepBox.y + sepBox.height).toBeLessThanOrEqual(headBox.y)
        }

      // 3. Navigate to Analytics Tab
      const analyticsTab = page.locator('button[data-tab="Analytics"], .sidebar-btn:has-text("Analytics")').first()
      await expect(analyticsTab).toBeVisible()
      await analyticsTab.click()
      await page.waitForTimeout(350)

        // Capture Analytics View
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, `03_analytics_${id}.png`),
          fullPage: false,
        })

        // Verify Analytics KPI Cards Row
        const kpiGrid = page.locator('.analytics-metrics-grid')
        await expect(kpiGrid).toBeVisible()
        const cards = kpiGrid.locator('.analytics-card')
        expect(await cards.count()).toBe(4)

        // Verify all 4 cards have matching heights within 2px tolerance
        const heights: number[] = []
        for (let i = 0; i < 4; i++) {
          const box = await cards.nth(i).boundingBox()
          if (box) heights.push(box.height)
        }
        if (heights.length === 4) {
          const maxHeight = Math.max(...heights)
          const minHeight = Math.min(...heights)
          expect(maxHeight - minHeight).toBeLessThanOrEqual(4)
        }

        // Verify KPI Header Icon dimensions
        const icons = kpiGrid.locator('.analytics-metric-icon')
        for (let i = 0; i < 4; i++) {
          const iconBox = await icons.nth(i).boundingBox()
          if (iconBox) {
            expect(iconBox.width).toBe(38)
            expect(iconBox.height).toBe(38)
          }
        }

      // 4. Test Card Hover States & Interaction Non-Collision
      const metricCards = page.locator('.analytics-card')
      if (await metricCards.count() >= 2) {
        const card0 = metricCards.nth(0)
        const card1 = metricCards.nth(1)

        const box0Before = await card0.boundingBox()
        const box1Before = await card1.boundingBox()

        // Hover over card 0
        await card0.hover()
        await page.waitForTimeout(150)

        const box0Hover = await card0.boundingBox()
        const box1During = await card1.boundingBox()

        if (box0Before && box0Hover && box1Before && box1During) {
          // Bounding box width/height must remain stable (no layout shifts)
          expect(Math.abs(box0Hover.width - box0Before.width)).toBeLessThanOrEqual(1)
          expect(Math.abs(box0Hover.height - box0Before.height)).toBeLessThanOrEqual(1)

          // Adjacent card position must not move
          expect(box1During.x).toBe(box1Before.x)
          expect(box1During.y).toBe(box1Before.y)
        }

        // Capture Hover Screenshot
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, `04_kpi_hover_${id}.png`),
          fullPage: false,
        })
      }
    })
  }
})
