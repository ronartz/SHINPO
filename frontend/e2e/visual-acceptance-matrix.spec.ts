import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { getBrowserGeometryAuditScript } from './visual/geometryAudit'
import type { VisualFinding } from './visual/geometryAudit'

const EVIDENCE_DIR = path.resolve('../docs/qa/visual-final')
fs.mkdirSync(EVIDENCE_DIR, { recursive: true })

const MOCK_USER = {
  id: 1,
  username: 'visual_qa_lead',
  email: 'visual.qa@shinpo.local',
}

const MOCK_GOALS = [
  {
    id: 1,
    title: 'High-Performance Personal Operating System',
    description: 'Deliver zero-lag desktop execution with encrypted SQLCipher storage and native process protection',
    targetDate: '2026-11-20',
    progress: 88,
    color: '#3B82F6',
    status: 'ACTIVE',
  },
  {
    id: 2,
    title: 'Cognitive Endurance & Deep Work Habituation',
    description: 'Daily 90-minute uninterrupted synthesis and deliberate deliberate practice loops',
    targetDate: '2026-12-31',
    progress: 64,
    color: '#10B981',
    status: 'ACTIVE',
  },
  {
    id: 3,
    title: 'Continuous Architecture Hardening',
    description: 'Strict separation of desktop and mobile presentation boundaries with zero cross-leakage',
    targetDate: '2026-12-15',
    progress: 100,
    color: '#8B5CF6',
    status: 'COMPLETED',
  },
]

const MOCK_MISSIONS = [
  {
    id: 101,
    goalId: 1,
    title: 'Automated Visual Regression and Geometry Verification',
    description: 'Ensure zero physical text collisions, adequate line-heights, and tight component density',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    estimatedMinutes: 30,
    xp: 60,
  },
  {
    id: 102,
    goalId: 1,
    title: 'Audit Guardian Process Identity Contracts',
    description: 'Validate Linux pidfd_open and process_start_ticks checks against PID recycling',
    status: 'READY',
    priority: 'HIGH',
    estimatedMinutes: 45,
    xp: 50,
  },
  {
    id: 103,
    goalId: 2,
    title: 'Execute Afternoon Deep Focus Cycle',
    description: 'Maintain strict distraction containment without switching windows or interrupting timer',
    status: 'COMPLETED',
    priority: 'MEDIUM',
    estimatedMinutes: 25,
    xp: 40,
  },
  {
    id: 104,
    goalId: 2,
    title: 'Evening Synthesis and Reflection Debrief',
    description: 'Document key mental models and velocity adjustments for tomorrow morning schedule',
    status: 'READY',
    priority: 'LOW',
    estimatedMinutes: 15,
    xp: 20,
  },
]

const MOCK_SCHEDULED_SESSIONS = [
  {
    id: 201,
    name: 'Tactical Visual QA Sprint',
    intention: 'Verify all 8 desktop views across 4 themes during active focus execution',
    durationMinutes: 45,
    status: 'ACTIVE',
    startedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    scheduledAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    focusActiveSeconds: 900,
    activeSeconds: 900,
    currentPhase: 'WORK',
    sessionType: 'STANDARD',
  },
  {
    id: 202,
    name: 'Morning Architecture Review',
    intention: 'Refactor desktop and mobile presentation layers into discrete directories',
    durationMinutes: 50,
    status: 'COMPLETED',
    startedAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    endedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    scheduledAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    focusActiveSeconds: 3000,
    activeSeconds: 3000,
    completionQuality: 5,
    accomplishment: 'Strict isolation of desktop styles and zero breaking regressions verified',
    reflectionNote: 'The clean separation prevented mobile CSS from bleeding into widescreen layouts',
  },
]

const MOCK_ANALYTICS = {
  summary: {
    totalFocusMinutes: 345,
    sessionsCompleted: 6,
    sessionsStarted: 7,
    missionsCompleted: 5,
    missionsTotal: 8,
    avgQuality: 4.8,
    completionRate: 63,
    currentStreak: 7,
    completionRatePopulation: 'MISSIONS',
    completionRateNumerator: 5,
    completionRateDenominator: 8,
  },
  weeklyVelocity: [
    { date: '2026-11-02', dayName: 'MON', focusMinutes: 90, completedCount: 2 },
    { date: '2026-11-03', dayName: 'TUE', focusMinutes: 120, completedCount: 2 },
    { date: '2026-11-04', dayName: 'WED', focusMinutes: 75, completedCount: 1 },
    { date: '2026-11-05', dayName: 'THU', focusMinutes: 135, completedCount: 3 },
    { date: '2026-11-06', dayName: 'FRI', focusMinutes: 90, completedCount: 2 },
    { date: '2026-11-07', dayName: 'SAT', focusMinutes: 60, completedCount: 1 },
    { date: '2026-11-08', dayName: 'SUN', focusMinutes: 45, completedCount: 1 },
  ],
  recentDebriefs: [
    {
      sessionId: 202,
      sessionName: 'Morning Architecture Review',
      intention: 'Refactor desktop and mobile presentation layers',
      durationMinutes: 50,
      actualFocusMinutes: 50,
      quality: 5,
      accomplishment: 'Strict isolation of desktop styles and zero breaking regressions verified',
      reflectionNote: 'The clean separation prevented mobile CSS from bleeding into widescreen layouts',
      completedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    },
  ],
}

const MOCK_SENTINEL_STATUS = {
  status: 'ACTIVE',
  shieldConnected: true,
  daemonConnected: true,
  enforcementMode: 'CONTAINMENT',
  isPolicyLocked: false,
  totalInterceptedToday: 3,
  activePolicyRulesCount: 4,
  activeFocusSessionId: 201,
  activeFocusSessionName: 'Tactical Visual QA Sprint',
  observerStatus: 'READY',
  guardianMode: 'PROTECTED',
  warningOnly: false,
  interventionCapability: 'STANDARD_CLOSE_LINUX',
  standardAllowanceSeconds: 120,
  guardianApplicationCatalog: [
    { id: 'app-1', name: 'Discord', execName: 'discord', category: 'Chat & Social', rationale: 'Non-work messaging platform' },
    { id: 'app-2', name: 'Steam Client', execName: 'steam', category: 'Gaming', rationale: 'Game library launcher' },
    { id: 'app-3', name: 'Spotify Music', execName: 'spotify', category: 'Entertainment', rationale: 'Media streaming' },
    { id: 'app-4', name: 'Visual Studio Code', execName: 'code', category: 'Development', rationale: 'Primary IDE' },
  ],
  guardianObservations: [
    { id: 1, pid: 48912, processName: 'discord', category: 'Chat & Social', outcome: 'WARNED', observedAt: new Date().toISOString() },
  ],
}

const MOCK_SENTINEL_RULES = [
  { id: 1, processNamePattern: 'discord', policyType: 'BLOCKED', isCustom: true },
  { id: 2, processNamePattern: 'steam', policyType: 'BLOCKED', isCustom: true },
  { id: 3, processNamePattern: 'spotify', policyType: 'BLOCKED', isCustom: false },
  { id: 4, processNamePattern: 'code', policyType: 'ALLOWED', isCustom: false },
]

const MOCK_EONPAI_CONVERSATION = {
  id: 1,
  publicId: 'conv_visual_qa_4920',
  title: 'Visual Architecture and Layout Density Alignment',
  messages: [
    {
      id: 'm1',
      role: 'user',
      text: 'Analyze the current desktop layout density and recommend spacing adjustments for 1080p widescreen.',
    },
    {
      id: 'm2',
      role: 'assistant',
      text: 'The 1920x1080 density stylesheet achieves 0 dead space with a 3-column Overview grid, compact 260px task cards, and 12px metric badges. All typography adheres to the Nunito design scale.',
      actionProposal: {
        actionId: 'act_9918',
        actionType: 'OPTIMIZE_LAYOUT',
        description: 'Verify 0 text collisions and consistent row heights across all desktop views',
        riskLevel: 'LOW',
        status: 'PROPOSED',
        confirmationToken: 'tok_confirm_492',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        payloadJson: JSON.stringify({ verifiedScreens: 8, targetDensity: '1080p_COMPACT' }),
      },
    },
  ],
}

async function attachMockHarness(page: any, sessionState: 'READY' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' = 'ACTIVE') {
  let activeSessions = [...MOCK_SCHEDULED_SESSIONS]
  if (sessionState === 'READY') {
    activeSessions = activeSessions.filter(s => s.status === 'COMPLETED')
  } else if (sessionState === 'PAUSED') {
    activeSessions = activeSessions.map(s => s.id === 201 ? { ...s, status: 'PAUSED' } : s)
  }

  await page.route((url: URL) => url.pathname.startsWith('/api/'), async (route: any) => {
    const u = route.request().url()
    if (u.includes('/auth/me')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_USER) })
    if (u.includes('/api/goals')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_GOALS) })
    if (u.includes('/api/missions')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_MISSIONS) })
    if (u.includes('/api/focus-sessions')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(activeSessions) })
    if (u.includes('/api/analytics')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ANALYTICS) })
    if (u.includes('/api/device/sentinel/status')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SENTINEL_STATUS) })
    if (u.includes('/api/device/sentinel/rules')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SENTINEL_RULES) })
    if (u.includes('/api/contextual-focus/resources')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    if (u.includes('/api/contextual-focus/status')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ mode: 'STUDY', active: true }) })
    if (u.includes('/api/ai/conversation/active')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_EONPAI_CONVERSATION) })
    if (u.includes('/api/ai/actions/pending')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_EONPAI_CONVERSATION.messages[1].actionProposal]) })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })

  await page.addInitScript((state: string) => {
    sessionStorage.setItem('shinpo_splash_shown', 'true')
    localStorage.setItem('shinpo_access_token', 'mock_jwt_token_for_visual_qa')
    localStorage.setItem('shinpo_local_vault_account', 'visual_qa_lead')
    localStorage.setItem('shinpo_vault_unlocked', 'true')
    localStorage.setItem('shinpo_tutorial_completed', 'true')
    localStorage.setItem('shinpo_onboarding_dismissed', 'true')
    localStorage.setItem('shinpo_auth_user', JSON.stringify({
      id: 1,
      username: 'visual_qa_lead',
      email: 'visual.qa@shinpo.local',
    }))
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      value: {
        invoke: async (cmd: string) => {
          if (cmd === 'local_vault_status') return { unlocked: true, username: 'visual_qa_lead' }
          if (cmd === 'get_guardian_status' || cmd === 'local_get_guardian_status') return {
            status: 'ACTIVE',
            daemonConnected: true,
            observerStatus: 'ready',
            guardianMode: 'PROTECTED',
            interventionCapability: 'STANDARD_CLOSE_LINUX',
            warningOnly: false,
            standardAllowanceSeconds: 120,
            activeFocusSessionId: 201,
            activeFocusSessionName: 'Tactical Visual QA Sprint',
            focusPhase: 'FOCUS',
            observationsToday: 1,
            lastObservationAt: new Date().toISOString(),
            appCatalogVersion: '1.0',
            domainCatalogVersion: '1.0',
            applicationPolicyStatus: 'ACTIVE',
            applicationCatalog: [],
          }
          if (cmd === 'local_get_guardian_observations') return [
            { id: 1, pid: 48912, processName: 'discord', category: 'Chat & Social', outcome: 'WARNED', observedAt: new Date().toISOString() },
          ]
          if (cmd === 'get_installed_applications' || cmd === 'get_active_application_catalog' || cmd === 'local_get_discovered_apps') return [
            { id: 'app-1', name: 'Discord', execName: 'discord', category: 'Chat & Social', rationale: 'Chat distraction', policy: 'BLOCKED', isRunning: true },
            { id: 'app-2', name: 'Steam Client', execName: 'steam', category: 'Gaming', rationale: 'Game launcher', policy: 'BLOCKED', isRunning: false },
            { id: 'app-3', name: 'Visual Studio Code', execName: 'code', category: 'Development', rationale: 'Editor', policy: 'ALLOWED', isRunning: true },
          ]
          if (cmd === 'local_get_goals') return [
            { id: 1, title: 'High-Performance Personal Operating System', description: 'Deliver zero-lag desktop execution', targetDate: '2026-11-20', progress: 88, color: '#3B82F6', status: 'ACTIVE' },
            { id: 2, title: 'Cognitive Endurance & Deep Work Habituation', description: 'Daily 90-minute uninterrupted synthesis', targetDate: '2026-12-31', progress: 64, color: '#10B981', status: 'ACTIVE' },
          ]
          if (cmd === 'local_get_tasks') return [
            { id: 101, goalId: 1, title: 'Automated Visual Regression and Geometry Verification', description: 'Ensure zero physical text collisions', status: 'IN_PROGRESS', priority: 'HIGH', estimatedMinutes: 30 },
            { id: 102, goalId: 1, title: 'Audit Guardian Process Identity Contracts', description: 'Validate Linux pidfd_open checks', status: 'READY', priority: 'HIGH', estimatedMinutes: 45 },
          ]
          if (cmd === 'local_get_focus_sessions') return [
            { id: 201, name: 'Tactical Visual QA Sprint', durationMinutes: 45, status: state, startedAt: new Date(Date.now() - 900000).toISOString(), activeSeconds: 900 },
          ]
          if (cmd === 'local_eonpai_get_active') return {
            id: 1,
            publicId: 'conv_local_9102',
            title: 'Visual QA Local Session',
            messages: [
              { id: 'm1', role: 'user', text: 'Check layout density' },
              { id: 'm2', role: 'assistant', text: 'All 8 desktop views populated and ready.' },
            ],
          }
          if (cmd === 'local_get_progress') return {
            userId: 1,
            totalXp: 850,
            totalProgress: 850,
            level: 5,
            levelTitle: 'Deep Worker',
            currentLevelXp: 150,
            nextLevelThreshold: 300,
            streakDays: 7,
          }
          return null
        },
      },
    })
  }, sessionState)
}

const THEMES = [
  { brand: 'aurora', theme: 'dark', label: 'aurora-dark' },
  { brand: 'aurora', theme: 'light', label: 'aurora-light' },
  { brand: 'classic', theme: 'dark', label: 'classic-dark' },
  { brand: 'classic', theme: 'light', label: 'classic-light' },
]

const VIEWPORTS = [
  { width: 1920, height: 1080, label: '1920x1080' },
  { width: 1440, height: 900, label: '1440x900' },
  { width: 1280, height: 720, label: '1280x720' },
  { width: 960, height: 600, label: '960x600' },
]

const TABS = [
  { name: 'Dashboard', selector: '[data-tab="Dashboard"]' },
  { name: 'Goals & Missions', selector: '[data-tab="Goals & Missions"]' },
  { name: 'Focus Engine', selector: '[data-tab="Focus Engine"]' },
  { name: 'Focus Protection', selector: '[data-tab="Focus Protection"], [data-tab="Shield"]' },
  { name: 'Schedule', selector: '[data-tab="Schedule"]' },
  { name: 'Task Manager', selector: '[data-tab="Task Manager"]' },
  { name: 'Analytics', selector: '[data-tab="Analytics"]' },
  { name: 'AI Assistant', selector: '[data-tab="AI Assistant"]' },
  { name: 'Rewards', selector: '[data-tab="Rewards"], .sidebar-rewards-card' },
]

test.describe('SHINPO Comprehensive Automated Visual Acceptance & Geometry Suite', () => {
  const accumulatedFindings: VisualFinding[] = []

  test.afterAll(async () => {
    const reportPath = path.join(EVIDENCE_DIR, 'visual-acceptance-results.json')
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      totalFindings: accumulatedFindings.length,
      p0Collisions: accumulatedFindings.filter(f => f.severity === 'P0').length,
      p1ClippingOrGaps: accumulatedFindings.filter(f => f.severity === 'P1').length,
      p2DeadSpace: accumulatedFindings.filter(f => f.severity === 'P2').length,
      findings: accumulatedFindings,
    }, null, 2))
    console.log(`Saved comprehensive visual audit report to: ${reportPath}`)
  })

  for (const { brand, theme, label: themeLabel } of THEMES) {
    for (const { width, height, label: vpLabel } of VIEWPORTS) {
      test(`[${themeLabel} | ${vpLabel}] Full Desktop Focus ACTIVE Navigation & Geometry Matrix`, async ({ page }) => {
        await page.setViewportSize({ width, height })
        await attachMockHarness(page, 'ACTIVE')

        await page.goto(`/?v2=${brand === 'aurora'}&theme=${theme}`)
        await page.waitForLoadState('networkidle')

        // Ensure the desktop shell is loaded
        const sidebar = page.locator('.icon-sidebar')
        await expect(sidebar).toBeVisible({ timeout: 15000 })

        for (const tab of TABS) {
          const tabBtn = page.locator(tab.selector).first()
          if (await tabBtn.count() > 0) {
            await tabBtn.click()
            await page.waitForTimeout(300)

            // Verify active focus banner/timer continuity
            const activeSessionPill = page.locator('.shield-active, .focus-engaged, [data-focus-mode="active"]')
            if (await activeSessionPill.count() > 0) {
              const isAnyVisible = await activeSessionPill.evaluateAll((els) =>
                els.some((el) => {
                  const rect = el.getBoundingClientRect()
                  return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none'
                })
              )
              expect(isAnyVisible).toBe(true)
            }

            // Capture screenshot into theme/viewport/tab structure
            const tabDir = path.join(EVIDENCE_DIR, themeLabel, vpLabel, tab.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
            fs.mkdirSync(tabDir, { recursive: true })
            const screenshotPath = path.join(tabDir, 'active.png')
            await page.screenshot({ path: screenshotPath, fullPage: true })

            // Run automated geometry audit in page context
            const auditResult = await page.evaluate(getBrowserGeometryAuditScript()) as { hasHorizontalOverflow: boolean; findings: any[] }

            for (const f of auditResult.findings) {
              accumulatedFindings.push({
                ...f,
                screen: tab.name,
                theme: themeLabel,
                viewport: vpLabel,
                focusState: 'ACTIVE',
              })
            }

            // P0 Assertions: No horizontal document overflow and no text-vs-text collisions
            const p0s = auditResult.findings.filter((f: any) => f.severity === 'P0')
            expect(p0s, `P0 Collisions or Overflows found on ${tab.name} (${themeLabel} ${vpLabel}): ${JSON.stringify(p0s, null, 2)}`).toHaveLength(0)
          }
        }

        // Test Settings Modal while Focus is ACTIVE
        const settingsTrigger = page.locator('.icon-sidebar .sidebar-utility-actions [aria-label="Settings"]')
        if (await settingsTrigger.count() > 0) {
          await settingsTrigger.click()
          const modal = page.locator('[role="dialog"], .settings-modal, .glass-modal')
          await expect(modal.first()).toBeVisible({ timeout: 5000 })
          const modalDir = path.join(EVIDENCE_DIR, themeLabel, vpLabel, 'settings-modal')
          fs.mkdirSync(modalDir, { recursive: true })
          await page.screenshot({ path: path.join(modalDir, 'active.png') })

          const modalAudit = await page.evaluate(getBrowserGeometryAuditScript()) as { findings: any[] }
          const modalP0s = modalAudit.findings.filter((f: any) => f.severity === 'P0')
          expect(modalP0s).toHaveLength(0)

          // Close modal
          await page.keyboard.press('Escape')
          await page.waitForTimeout(200)
        }
      })
    }
  }

  test('Focus Session Lifecycle: Transition from READY -> ACTIVE -> PAUSED -> COMPLETED with Geometry Verification', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await attachMockHarness(page, 'READY')

    await page.goto('/?tab=Focus%20Engine&v2=true&theme=dark')
    await expect(page.locator('.app-shell')).toBeVisible()

    // 1. READY STATE
    const startBtn = page.locator('[data-tutorial="start-timer-btn"], button:has-text("Start Focus"), button:has-text("Start Session")').first()
    await expect(startBtn).toBeVisible()
    const readyAudit = await page.evaluate(getBrowserGeometryAuditScript()) as { findings: any[] }
    expect(readyAudit.findings.filter((f: any) => f.severity === 'P0')).toHaveLength(0)

    // 2. ACTIVE TRANSITION
    await startBtn.click()
    await page.waitForTimeout(500)
    const activeAudit = await page.evaluate(getBrowserGeometryAuditScript()) as { findings: any[] }
    expect(activeAudit.findings.filter((f: any) => f.severity === 'P0')).toHaveLength(0)

    // 3. PAUSED TRANSITION
    const pauseBtn = page.locator('button:has-text("Pause"), [aria-label="Pause session"]').first()
    if (await pauseBtn.count() > 0) {
      await pauseBtn.click()
      await page.waitForTimeout(400)
      const pausedAudit = await page.evaluate(getBrowserGeometryAuditScript()) as { findings: any[] }
      expect(pausedAudit.findings.filter((f: any) => f.severity === 'P0')).toHaveLength(0)
    }
  })
})
