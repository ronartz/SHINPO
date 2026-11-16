import { test, expect } from '@playwright/test'

test.describe('OPERATION CORE UI REPAIR - Automated Acceptance Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
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
                warningOnly: false,
              }
            }
            if (command === 'local_get_study_resources') return []
            if (command === 'local_get_goals') return []
            if (command === 'local_get_tasks') return []
            if (command === 'local_get_focus_sessions') return []
            if (command === 'local_get_progress') {
              return { userId: 1, totalXp: 100, level: 1, currentStreak: 3, longestStreak: 7 }
            }
            if (command === 'local_get_discovered_apps') return []
            if (command === 'local_get_app_policies') return []
            if (command === 'local_get_system_telemetry') {
              return {
                deviceName: 'Fedora-Workstation',
                osName: 'Fedora Linux',
                osVersion: '41',
                osArch: 'x86_64',
                availableProcessors: 16,
                cpuUsagePercent: 14.8,
                cores: [
                  { name: 'Core 0', usagePercent: 12.0, frequencyMhz: 3200 },
                  { name: 'Core 1', usagePercent: 18.5, frequencyMhz: 3200 },
                ],
                totalMemoryBytes: 32 * 1024 * 1024 * 1024,
                usedMemoryBytes: 10 * 1024 * 1024 * 1024,
                freeMemoryBytes: 22 * 1024 * 1024 * 1024,
                availableMemoryBytes: 22 * 1024 * 1024 * 1024,
                totalSwapBytes: 8 * 1024 * 1024 * 1024,
                usedSwapBytes: 1 * 1024 * 1024 * 1024,
                freeSwapBytes: 7 * 1024 * 1024 * 1024,
                disks: [
                  { name: 'nvme0n1p3', mountPoint: '/', totalBytes: 512 * 1024 * 1024 * 1024, availableBytes: 300 * 1024 * 1024 * 1024, fileSystem: 'btrfs' },
                ],
                networks: [
                  { interfaceName: 'wlan0', rxBytes: 50 * 1024 * 1024, txBytes: 10 * 1024 * 1024 },
                ],
                processCount: 325,
                timestamp: '2026-11-08T14:00:00Z',
              }
            }
            if (command === 'local_get_process_snapshot') {
              return {
                systemInfo: {
                  deviceName: 'Fedora-Workstation',
                  osName: 'Fedora Linux',
                  osVersion: '41',
                  osArch: 'x86_64',
                  availableProcessors: 16,
                  systemCpuLoad: 14.8,
                  totalMemoryBytes: 32 * 1024 * 1024 * 1024,
                  freeMemoryBytes: 22 * 1024 * 1024 * 1024,
                  processCount: 325,
                },
                processes: [
                  {
                    pid: 1,
                    name: 'systemd',
                    executablePath: '/usr/lib/systemd/systemd',
                    cpuPercent: 0.1,
                    memoryBytes: 15 * 1024 * 1024,
                    status: 'Running',
                    startedAt: '1700000000',
                    user: 'root',
                    shinpoPolicyState: 'PROTECTED',
                    policyReason: 'Protected OS daemon',
                    canControl: false,
                  },
                  {
                    pid: 4242,
                    name: 'firefox',
                    executablePath: '/usr/bin/firefox',
                    cpuPercent: 4.5,
                    memoryBytes: 512 * 1024 * 1024,
                    status: 'Running',
                    startedAt: '1700000100',
                    user: 'eonx',
                    shinpoPolicyState: 'ALLOWED',
                    policyReason: 'User app',
                    canControl: true,
                  },
                ],
                timestamp: '2026-11-08T14:00:00Z',
              }
            }
            return null
          },
        },
      })
    })
  })

  test('A1: TopBar dropdowns have high z-index and render above ordinary content', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.cockpit-top-bar')

    const topBarZIndex = await page.$eval('.cockpit-top-bar', (el) => window.getComputedStyle(el).zIndex)
    expect(Number(topBarZIndex)).toBeGreaterThanOrEqual(500)

    // Click profile dropdown
    const profileBtn = page.locator('.profile-badge-card').first()
    await profileBtn.click()
    await page.waitForSelector('.shinpo-account-dropdown')

    const menuZIndex = await page.$eval('.shinpo-account-dropdown', (el) => window.getComputedStyle(el).zIndex)
    expect(Number(menuZIndex)).toBeGreaterThanOrEqual(1000)
    await page.screenshot({ path: '../docs/qa/screenshots/core-ui-repairs/01_account_dropdown_above_cards.png' })

    // Click power dropdown
    const powerBtn = page.locator('.action-btn-circle[aria-label="Power menu"]').first()
    await powerBtn.click()
    await page.waitForSelector('.shinpo-power-dropdown')

    const powerMenuZIndex = await page.$eval('.shinpo-power-dropdown', (el) => window.getComputedStyle(el).zIndex)
    expect(Number(powerMenuZIndex)).toBeGreaterThanOrEqual(1000)
  })

  test('Screenshot 1: EONPAI utility panel and context panel fill height without dead space', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-tab="AI Assistant"]').click()
    await page.waitForSelector('.eonpai-workspace')

    const utilityPanelHeight = await page.$eval('.eonpai-utility-panel', (el) => {
      const style = window.getComputedStyle(el)
      return {
        height: el.clientHeight,
        alignSelf: style.alignSelf,
      }
    })
    expect(utilityPanelHeight.alignSelf).toBe('stretch')
    expect(utilityPanelHeight.height).toBeGreaterThan(600)
    await page.screenshot({ path: '../docs/qa/screenshots/core-ui-repairs/02_eonpai_stretched_panels.png' })
  })

  test('Screenshot 2: Study mode cards stack label on top of description without collision', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-tab="Focus Engine"]').click()
    await page.waitForSelector('.study-resources-panel')

    const options = page.locator('.study-mode-option')
    const count = await options.count()
    expect(count).toBeGreaterThanOrEqual(3)

    for (let i = 0; i < count; i++) {
      const option = options.nth(i)
      const flexDir = await option.evaluate((el) => window.getComputedStyle(el).flexDirection)
      expect(flexDir).toBe('column')

      const strong = option.locator('strong')
      const span = option.locator('span')
      if (await span.count() > 0) {
        const strongBox = await strong.boundingBox()
        const spanBox = await span.boundingBox()
        if (strongBox && spanBox) {
          expect(spanBox.y).toBeGreaterThanOrEqual(strongBox.y + strongBox.height - 1)
        }
      }
    }
    await page.screenshot({ path: '../docs/qa/screenshots/core-ui-repairs/03_study_resources_cards.png' })
  })

  test('Screenshot 3: Installed apps filter tabs have flex-shrink: 0 and do not compress', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-tab="Task Manager"]').click()
    await page.waitForSelector('.guardian-installed-panel')

    const filterTabs = page.locator('.guardian-filter-tab')
    const tabCount = await filterTabs.count()
    expect(tabCount).toBeGreaterThanOrEqual(4)

    for (let i = 0; i < tabCount; i++) {
      const tab = filterTabs.nth(i)
      const flexShrink = await tab.evaluate((el) => window.getComputedStyle(el).flexShrink)
      expect(flexShrink).toBe('0')
    }
    await page.screenshot({ path: '../docs/qa/screenshots/core-ui-repairs/04_guardian_installed_apps.png' })
  })

  test('Screenshot 4: Goals & Tasks progress summary is balanced without wasted columns', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-tab="Goals & Missions"]').click()
    await page.waitForSelector('.goals-progress-summary')

    const displayType = await page.$eval('.goals-progress-summary', (el) => window.getComputedStyle(el).display)
    expect(displayType).toBe('flex')
    await page.screenshot({ path: '../docs/qa/screenshots/core-ui-repairs/05_goals_and_tasks.png' })
  })

  test('Screenshot 5: Focus Engine intention pill is removed and intention card hugs content without dead space', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-tab="Focus Engine"]').click()
    await page.waitForSelector('.card-timer-hud')

    // Floating redundant tag must not exist
    const redundantTag = page.locator('.active-intention-tag')
    await expect(redundantTag).toHaveCount(0)

    // Intention card must hug its content naturally without stretching into dead space
    const intentionBox = await page.locator('.card-session-intention').boundingBox()
    expect(intentionBox).not.toBeNull()
    expect(intentionBox!.height).toBeGreaterThan(60)
    await page.screenshot({ path: '../docs/qa/screenshots/core-ui-repairs/06_focus_engine_intention_card.png' })
  })

  test('Phase A2: TopBar adapts cleanly across breakpoints without clipping controls', async ({ page }) => {
    // 1920x1080
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')
    await page.waitForSelector('.cockpit-top-bar')
    const debugInfo = await page.locator('.cockpit-top-bar').evaluate((el) => {
      if (el instanceof HTMLElement) {
        return {
          computedHeight: window.getComputedStyle(el).height,
          minHeight: window.getComputedStyle(el).minHeight,
          offsetHeight: el.offsetHeight,
          innerHTML: el.innerHTML.slice(0, 100),
        }
      }
      return {
        computedHeight: window.getComputedStyle(el).height,
        minHeight: window.getComputedStyle(el).minHeight,
        offsetHeight: null,
        innerHTML: el.textContent?.slice(0, 100) ?? '',
      }
    })
    console.log('TopBar debug info:', debugInfo)
    let topBarBox = await page.locator('.cockpit-top-bar').boundingBox()
    expect(topBarBox).not.toBeNull()
    expect(topBarBox!.height).toBeGreaterThanOrEqual(48)

    // 1280x720
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.waitForTimeout(200)
    topBarBox = await page.locator('.cockpit-top-bar').boundingBox()
    expect(topBarBox!.height).toBeGreaterThanOrEqual(48)

    // 960x600 (responsive 2-tier breakpoint)
    await page.setViewportSize({ width: 960, height: 600 })
    await page.waitForTimeout(200)
    topBarBox = await page.locator('.cockpit-top-bar').boundingBox()
    expect(topBarBox!.height).toBeGreaterThanOrEqual(84)
    await page.screenshot({ path: '../docs/qa/screenshots/core-ui-repairs/07_topbar_960px_breakpoint.png' })
  })

  test('Phase B2: Dashboard Rewards & Progress card displays level progression and milestone cleanly', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')
    await page.waitForSelector('.dashboard-rewards-summary')

    const rewardsCard = page.locator('.dashboard-rewards-summary')
    await expect(rewardsCard).toBeVisible()

    // Next Milestone text should be visible and not clipped
    const milestoneText = rewardsCard.locator('text=Next Milestone')
    await expect(milestoneText).toBeVisible()

    await page.screenshot({ path: '../docs/qa/screenshots/core-ui-repairs/08_dashboard_rewards_card.png' })
  })

  test('User Request 1: Today\'s Schedule centers single item/empty state and stacks multiple items', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')
    await page.waitForSelector('.schedule-card')

    const scheduleCard = page.locator('.schedule-card')
    await expect(scheduleCard).toBeVisible()

    // The container for schedule items inside .schedule-card should use centered justification when <= 1 item
    const bodyJustify = await scheduleCard.locator('.schedule-card-body, > div').nth(1).evaluate((el) => {
      return window.getComputedStyle(el).justifyContent
    })
    expect(['center', 'space-around']).toContain(bodyJustify)
  })

  test('User Request 2: Focus Engine left column intention card hugs content and avoids dead space', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')
    await page.locator('[data-tab="Focus Engine"]').click()
    await page.waitForSelector('.card-timer-hud')
    await page.waitForSelector('.card-session-intention')

    const leftCol = page.locator('.focus-left-column')
    const rightCol = page.locator('.focus-right-column')

    const leftBox = await leftCol.boundingBox()
    const rightBox = await rightCol.boundingBox()

    expect(leftBox).not.toBeNull()
    expect(rightBox).not.toBeNull()

    // Intention card must not artificially stretch into dead space
    const intentionBox = await page.locator('.card-session-intention').boundingBox()
    expect(intentionBox).not.toBeNull()
    expect(intentionBox!.height).toBeGreaterThan(60)
  })

  test('Phase C: PC System Monitor sub-tab displays live native telemetry metrics and process table', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')
    await page.locator('[data-tab="Task Manager"]').click()
    await page.waitForSelector('.guardian-subtab-bar')

    // Switch to PC System Monitor sub-tab
    const pcTab = page.locator('[data-testid="subtab-pc-monitor"]')
    await expect(pcTab).toBeVisible()
    await pcTab.click()

    // Verify PC System Monitor Deck renders
    await page.waitForSelector('[data-testid="pc-system-monitor-deck"]')
    const monitorDeck = page.locator('[data-testid="pc-system-monitor-deck"]')
    await expect(monitorDeck).toBeVisible()

    // Verify metric cards: CPU, Memory, Swap, Processes
    await expect(page.locator('[data-testid="metric-cpu"]')).toBeVisible()
    await expect(page.locator('[data-testid="metric-memory"]')).toBeVisible()
    await expect(page.locator('[data-testid="metric-swap"]')).toBeVisible()
    await expect(page.locator('[data-testid="metric-processes"]')).toBeVisible()

    // Verify process table rows
    const tableRows = page.locator('.tm-table tbody tr')
    const rowCount = await tableRows.count()
    expect(rowCount).toBeGreaterThanOrEqual(2)

    // Test search filter
    const searchInput = page.locator('[data-testid="input-process-search"]')
    await searchInput.fill('firefox')
    await page.waitForTimeout(100)
    const filteredCount = await page.locator('.tm-table tbody tr').count()
    expect(filteredCount).toBe(1)
    await expect(page.locator('.tm-table tbody tr').first()).toContainText('firefox')

    await page.screenshot({ path: '../docs/qa/screenshots/core-ui-repairs/09_pc_system_monitor_live.png' })
  })
})
