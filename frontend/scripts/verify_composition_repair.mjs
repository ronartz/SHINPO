import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const EVIDENCE_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/final-ui-repair'
mkdirSync(EVIDENCE_DIR, { recursive: true })

const FRONTEND_URL = process.env.SHINPO_URL || 'http://127.0.0.1:5173'

console.log('=== SHINPO FINAL COMPOSITION REPAIR PLAYWRIGHT VERIFICATION ===')

const userMockScript = () => {
  localStorage.setItem('shinpo_local_vault_account', 'eonx_dev')
  localStorage.setItem(
    'shinpo_auth_user',
    JSON.stringify({ id: 1, username: 'eonx_dev', email: 'eonx@local.shinpo' })
  )
  Object.defineProperty(window, '__TAURI_INTERNALS__', {
    value: {
      invoke: async (cmd, args) => {
        if (cmd === 'local_vault_status') return { unlocked: true, username: 'eonx_dev' }
        if (cmd === 'get_guardian_status') return {
          status: 'idle',
          observerStatus: 'active',
          guardianMode: 'PROTECTED',
          interventionCapability: 'STANDARD_CLOSE_LINUX',
          warningOnly: true,
          standardAllowanceSeconds: 120,
        }
        if (cmd === 'get_sentinel_rules') return [
          { id: 1, processNamePattern: 'slack', policyType: 'BLOCKED', isCustom: true },
          { id: 2, processNamePattern: 'discord', policyType: 'BLOCKED', isCustom: true },
          { id: 3, processNamePattern: 'steam', policyType: 'BLOCKED', isCustom: true },
        ]
        if (cmd === 'get_recent_tamper_events') return []
        if (cmd === 'get_installed_applications' || cmd === 'get_active_application_catalog' || cmd === 'local_get_discovered_apps') return [
          { id: 'app-1', name: 'Slack', execName: 'slack', category: 'Communication', rationale: 'Messaging distraction', policy: 'BLOCKED', isRunning: false },
          { id: 'app-2', name: 'Discord', execName: 'discord', category: 'Communication', rationale: 'Social chat distraction', policy: 'BLOCKED', isRunning: false },
          { id: 'app-3', name: 'Visual Studio Code', execName: 'code', category: 'Development', rationale: 'Code editor', policy: 'ALLOWED', isRunning: true },
          { id: 'app-4', name: 'Spotify', execName: 'spotify', category: 'Media', rationale: 'Audio streaming', policy: 'NONE', isRunning: false },
        ]
        if (cmd === 'local_get_app_policies') return []
        if (cmd === 'list_focus_sessions') return [
          { id: 101, name: 'Deep Work Sprint', durationMinutes: 25, status: 'COMPLETED', startedAt: new Date(Date.now() - 3600000).toISOString(), completedFocusCycles: 1 },
          { id: 102, name: 'Architecture Review', durationMinutes: 45, status: 'COMPLETED', startedAt: new Date(Date.now() - 86400000).toISOString(), completedFocusCycles: 1 },
        ]
        if (cmd === 'list_goals_and_missions') return {
          goals: [
            { id: 1, title: 'Ship SHINPO V1.0', status: 'IN_PROGRESS', targetDate: '2026-11-15' },
            { id: 2, title: 'Release Candidate Hardening', status: 'IN_PROGRESS', targetDate: '2026-11-20' },
          ],
          missions: [
            { id: 10, goalId: 1, title: 'Verify Focus Engine layout', status: 'COMPLETED', priority: 1 },
            { id: 11, goalId: 1, title: 'Verify Calendar alignment', status: 'IN_PROGRESS', priority: 2 },
            { id: 12, goalId: 1, title: 'Verify Focus Protection layout', status: 'READY', priority: 3 },
          ],
        }
        if (cmd === 'get_user_progress') return {
          userId: 1,
          totalProgress: 350,
          level: 3,
          levelTitle: 'Focused Strategist',
          currentLevelXp: 150,
          nextLevelThreshold: 400,
          progressPercent: 37.5,
          recentEvents: [
            { id: 1, eventType: 'FOCUS_SESSION_COMPLETED', amount: 50, createdAt: new Date().toISOString() },
            { id: 2, eventType: 'MISSION_COMPLETED', amount: 25, createdAt: new Date().toISOString() },
          ],
        }
        if (cmd === 'get_analytics_dashboard') return {
          summary: {
            totalFocusMinutes: 185,
            completedSessionsCount: 7,
            averageDailyMinutes: 37,
            missionsCompleted: 5,
            missionsTotal: 8,
            currentStreak: 4,
            streakDays: 4,
          },
          recentDebriefs: [
            { sessionId: 101, durationMinutes: 25, completedAt: new Date().toISOString(), quality: 5, note: 'Great focus on UI architecture.' },
            { sessionId: 102, durationMinutes: 45, completedAt: new Date(Date.now() - 86400000).toISOString(), quality: 4, note: 'Reviewed Rust vault logic.' },
          ],
        }
        if (cmd === 'get_guardian_preferences') return {
          preferredMode: 'PROTECTED',
          appMonitoringConsent: true,
          applyToNewSessions: true,
          closureConsent: false,
          backgroundRuntimeConsent: true,
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

async function main() {
  const browser = await chromium.launch({ headless: true })

  // 1. AUTH REGISTRATION VALIDATION SCREENSHOT
  console.log('1. Testing Auth Workspace Registration Validation...')
  {
    const page = await browser.newPage()
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${FRONTEND_URL}/?theme=dark`)
    await page.waitForSelector('.auth-card')

    // Click 'Create workspace' or 'Create Account' tab if not active
    const createTab = await page.$('.auth-tab-btn:has-text("Create workspace"), .auth-tab-btn:has-text("Create Account"), .auth-tab-btn:has-text("Create")')
    if (createTab) await createTab.click()
    await page.waitForTimeout(300)

    // Type 'random gc' with a space to test validation
    await page.fill('#auth-identifier', 'random gc')
    if (await page.$('#auth-email')) {
      await page.fill('#auth-email', 'diddyrandom@gmail.com')
    }
    await page.fill('#auth-password', 'shinpodemodemo_1')

    // Submit form to trigger client-side validation
    await page.click('button[type="submit"]')
    await page.waitForTimeout(300)

    const authShotPath = path.join(EVIDENCE_DIR, '01_auth_register_validation.png')
    await page.screenshot({ path: authShotPath })
    console.log(`Saved: ${authShotPath}`)
    await page.close()
  }

  // 2. FOCUS ENGINE BALANCED LAYOUT
  console.log('2. Testing Focus Engine Balanced 2-Column Layout...')
  {
    const page = await browser.newPage()
    await page.addInitScript(userMockScript)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${FRONTEND_URL}/?v2=true&theme=dark`)
    await page.waitForSelector('.icon-sidebar')

    // Navigate to Focus Engine
    await page.click('button[data-tab="Focus Engine"]')
    await page.waitForSelector('.focus-hero-split')
    await page.waitForTimeout(300)

    const focusShotPath = path.join(EVIDENCE_DIR, '02_focus_engine_balanced_1440x900.png')
    await page.screenshot({ path: focusShotPath })
    console.log(`Saved: ${focusShotPath}`)

    // Test at 1920x1080
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.waitForTimeout(200)
    const focus1080Path = path.join(EVIDENCE_DIR, '02_focus_engine_balanced_1920x1080.png')
    await page.screenshot({ path: focus1080Path })
    console.log(`Saved: ${focus1080Path}`)

    await page.close()
  }

  // 3. CALENDAR REPAIRED LAYOUT & TIME GUTTER
  console.log('3. Testing Calendar Schedule View...')
  {
    const page = await browser.newPage()
    await page.addInitScript(userMockScript)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${FRONTEND_URL}/?v2=true&theme=dark`)
    await page.waitForSelector('.icon-sidebar')

    await page.click('button[data-tab="Schedule"]')
    await page.waitForSelector('.schedule-calendar-layout')
    await page.waitForTimeout(400)

    // Inspect timeline hours
    const hourLabels = await page.$$eval('.schedule-time-axis div', (nodes) =>
      nodes.map((n) => n.textContent?.trim()).filter(Boolean)
    )
    console.log(`Calendar time gutter hour count: ${hourLabels.length}`)
    console.log(`First 3 hours: ${hourLabels.slice(0, 3).join(', ')}`)
    console.log(`Last 3 hours: ${hourLabels.slice(-3).join(', ')}`)
    
    // Check monotonic order
    let isMonotonic = true
    for (let i = 1; i < hourLabels.length; i++) {
      const prev = parseInt(hourLabels[i - 1].replace(':00', ''), 10)
      const curr = parseInt(hourLabels[i].replace(':00', ''), 10)
      if (curr <= prev) {
        isMonotonic = false
        console.error(`Sequence violation: ${hourLabels[i - 1]} precedes ${hourLabels[i]}`)
      }
    }
    console.log(`Calendar hour labels monotonic sequence verified: ${isMonotonic}`)

    // Check sidebar summary card
    const hasRhythmCard = await page.$('.schedule-sidebar-summary-card')
    console.log(`Calendar sidebar rhythm card present: ${Boolean(hasRhythmCard)}`)

    const calShotPath = path.join(EVIDENCE_DIR, '03_calendar_repaired_1440x900.png')
    await page.screenshot({ path: calShotPath })
    console.log(`Saved: ${calShotPath}`)
    await page.close()
  }

  // 4. FOCUS PROTECTION RECOMPOSED LAYOUT & GUARDIAN MODE DISCOVERABILITY
  console.log('4. Testing Focus Protection View & Guardian Mode Discoverability...')
  {
    const page = await browser.newPage()
    await page.addInitScript(userMockScript)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${FRONTEND_URL}/?v2=true&theme=dark`)
    await page.waitForSelector('.icon-sidebar')

    await page.click('button[data-tab="Task Manager"]')
    await page.waitForSelector('.sentinel-panel, .guardian-alpha-workspace, .task-manager-view')
    await page.waitForTimeout(400)

    // Verify Guardian Mode action card and explainer
    const actionBtn = await page.$('[data-testid="btn-configure-guardian"]')
    console.log(`Focus Protection 'Configure Guardian Mode' button present: ${Boolean(actionBtn)}`)

    const explainerCard = await page.$('.guardian-policy-explainer')
    console.log(`Focus Protection Policy & Architecture guide present: ${Boolean(explainerCard)}`)

    const protShotPath = path.join(EVIDENCE_DIR, '04_focus_protection_recomposed.png')
    await page.screenshot({ path: protShotPath })
    console.log(`Saved: ${protShotPath}`)

    // Test routing by clicking Configure Guardian Mode
    if (actionBtn) {
      await actionBtn.click()
      await page.waitForTimeout(400)
      const onFocus = await page.$('.focus-hero-split, #study-mode-section')
      console.log(`Clicked 'Configure Guardian Mode' -> Successfully routed to Focus Engine: ${Boolean(onFocus)}`)
    }

    await page.close()
  }

  // 5. ANALYTICS GRID REPAIRED
  console.log('5. Testing Analytics View...')
  {
    const page = await browser.newPage()
    await page.addInitScript(userMockScript)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${FRONTEND_URL}/?v2=true&theme=dark`)
    await page.waitForSelector('.icon-sidebar')

    await page.click('button[data-tab="Analytics"]')
    await page.waitForSelector('.analytics-view')
    await page.waitForTimeout(300)

    const anaShotPath = path.join(EVIDENCE_DIR, '05_analytics_repaired.png')
    await page.screenshot({ path: anaShotPath })
    console.log(`Saved: ${anaShotPath}`)
    await page.close()
  }

  // 6. AURORA LIGHT SIDEBAR CONTRAST & DASHBOARD REWARDS INTERIOR
  console.log('6. Testing Aurora Light Theme & Dashboard Rewards...')
  {
    const page = await browser.newPage()
    await page.addInitScript(userMockScript)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${FRONTEND_URL}/?v2=true&theme=light`)
    await page.waitForSelector('.icon-sidebar')
    await page.waitForSelector('.dashboard-metrics-grid', { timeout: 10000 })
    await page.waitForTimeout(500)

    // Check clock contrast in Light Mode
    const clockColor = await page.$eval('.capsule-time-region', (el) => window.getComputedStyle(el).color).catch(() => 'unknown')
    console.log(`Aurora Light LiveClock time digits computed color: ${clockColor}`)

    // Check active sidebar button contrast in Light Mode
    const activeBtnColor = await page.$eval('.icon-sidebar .sidebar-btn.active', (el) => window.getComputedStyle(el).color).catch(() => 'unknown')
    const activeSvgStroke = await page.$eval('.icon-sidebar .sidebar-btn.active svg', (el) => window.getComputedStyle(el).stroke).catch(() => 'unknown')
    console.log(`Aurora Light active sidebar button text color: ${activeBtnColor}`)
    console.log(`Aurora Light active sidebar button icon stroke: ${activeSvgStroke}`)

    const auroraLightPath = path.join(EVIDENCE_DIR, '06_aurora_light_dashboard_sidebar.png')
    await page.screenshot({ path: auroraLightPath })
    console.log(`Saved: ${auroraLightPath}`)
    await page.close()
  }

  // 7. CLASSIC LIGHT REWARDS RECOLORED (WARM PARCHMENT / OLIVE)
  console.log('7. Testing Classic Light Rewards View...')
  {
    const page = await browser.newPage()
    await page.addInitScript(userMockScript)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${FRONTEND_URL}/?v2=false&theme=light`)
    await page.waitForSelector('.icon-sidebar')

    const classicActiveBtnColor = await page.$eval('.icon-sidebar .sidebar-btn.active', (el) => window.getComputedStyle(el).color).catch(() => 'unknown')
    const classicActiveSvgStroke = await page.$eval('.icon-sidebar .sidebar-btn.active svg', (el) => window.getComputedStyle(el).stroke).catch(() => 'unknown')
    console.log(`Classic Light active sidebar button text color: ${classicActiveBtnColor}`)
    console.log(`Classic Light active sidebar button icon stroke: ${classicActiveSvgStroke}`)

    await page.click('.sidebar-rewards-card')
    await page.waitForSelector('.rewards-hero')
    await page.waitForTimeout(300)

    const rewardsHeroColor = await page.$eval('.rewards-hero', (el) => window.getComputedStyle(el).color).catch(() => 'unknown')
    console.log(`Classic Light Rewards hero text color: ${rewardsHeroColor}`)

    const classicLightRewardsPath = path.join(EVIDENCE_DIR, '07_classic_light_rewards.png')
    await page.screenshot({ path: classicLightRewardsPath })
    console.log(`Saved: ${classicLightRewardsPath}`)
    await page.close()
  }

  // 8. SETTINGS MODAL AI PROVIDER SELECT
  console.log('8. Testing Settings Modal AI Provider Select...')
  {
    const page = await browser.newPage()
    await page.addInitScript(userMockScript)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${FRONTEND_URL}/?v2=true&theme=dark`)
    await page.waitForSelector('.icon-sidebar')

    // Open settings by clicking the settings button
    const settingsBtn = await page.$('button[aria-label="Settings"]')
    if (settingsBtn) {
      await settingsBtn.click()
    } else {
      await page.keyboard.press('Control+,')
    }
    await page.waitForSelector('.settings-modal-box', { timeout: 5000 }).catch(() => null)
    await page.waitForTimeout(400)

    // Click EONPAI tab in settings
    await page.click('.settings-modal button[data-section="eonpai"]')
    await page.waitForSelector('#native-ai-provider', { timeout: 5000 }).catch(() => null)
    await page.waitForTimeout(400)

    const settingsShotPath = path.join(EVIDENCE_DIR, '08_settings_ai_provider.png')
    await page.screenshot({ path: settingsShotPath })
    console.log(`Saved: ${settingsShotPath}`)
    await page.close()
  }

  await browser.close()
  console.log('\n=== ALL SCREENSHOTS CAPTURED SUCCESSFULLY ===')
}

main().catch((err) => {
  console.error('Playwright verification error:', err)
  process.exit(1)
})
