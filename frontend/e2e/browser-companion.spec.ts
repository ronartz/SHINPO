import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'
import http from 'node:http'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '../..')
const EXT_SRC_PAGES = path.join(ROOT_DIR, 'browser-extension/src/pages')
const SCREENSHOT_DIR = path.join(ROOT_DIR, 'docs/qa/screenshots/browser-extension')

let server: http.Server
let baseUrl: string

// Base mock status object
function createMockStatus(overrides = {}) {
  return {
    connection: {
      state: 'CONNECTED',
      paired: true,
      lastSyncAt: new Date().toISOString(),
      error: null,
      source: 'local host',
    },
    monitoringEnabled: true,
    reviewUrl: 'http://localhost:5173/focus',
    policy: {
      active: true,
      degraded: false,
      sessionId: 'session-e2e-01',
      taskTitle: 'Audit Browser Companion Accessibility',
      mode: 'STANDARD',
      sessionStatus: 'ACTIVE',
      currentPhase: 'FOCUS',
      phaseRemainingSeconds: 1500,
      phaseDeadlineAtMs: Date.now() + 1500 * 1000,
      policyVersion: 12,
      remainingLeaseSeconds: 300,
      inactiveReason: null,
    },
    capabilities: {
      youtube: 'ROUTE_AND_UI',
      discordWeb: 'VALIDATED_ROUTE',
      genericWeb: 'EXPLICIT_RULES',
    },
    ...overrides,
  }
}

/**
 * Injects a mock implementation of chrome/browser extension APIs
 */
async function injectExtensionMock(page: any, initialStatus: any, initialIntervention?: any) {
  await page.addInitScript(({ status, intervention }: { status: any; intervention?: any }) => {
    const currentStatus = JSON.parse(JSON.stringify(status))
    const currentIntervention = intervention ? JSON.parse(JSON.stringify(intervention)) : null
    const storage: Record<string, any> = {}

    const mockApi = {
      runtime: {
        getURL: (p: string = '') => `chrome-extension://mock-extension-id/${p}`,
        openOptionsPage: () => {
          console.log('[Mock Extension] openOptionsPage called')
        },
        sendMessage: async (msg: any) => {
          if (!msg || typeof msg !== 'object') {
            return { ok: false, error: { message: 'Invalid message' } }
          }
          switch (msg.type) {
            case 'GET_STATUS':
            case 'STATUS':
              return { ok: true, payload: currentStatus }
            case 'PAIR':
              if (!msg.pairingCode || msg.pairingCode.trim().length === 0) {
                return { ok: false, error: { message: 'Empty pairing code' } }
              }
              currentStatus.connection.state = 'CONNECTED'
              currentStatus.connection.paired = true
              currentStatus.connection.lastSyncAt = new Date().toISOString()
              return { ok: true, payload: currentStatus }
            case 'SYNC_NOW':
              currentStatus.connection.lastSyncAt = new Date().toISOString()
              return { ok: true, payload: currentStatus }
            case 'SET_MONITORING_ENABLED':
              currentStatus.monitoringEnabled = Boolean(msg.enabled)
              return { ok: true, payload: currentStatus }
            case 'SET_REVIEW_URL':
              currentStatus.reviewUrl = msg.reviewUrl
              return { ok: true, payload: { reviewUrl: msg.reviewUrl } }
            case 'DISCONNECT':
              currentStatus.connection.state = 'UNPAIRED'
              currentStatus.connection.paired = false
              currentStatus.policy.active = false
              currentStatus.policy.sessionId = null
              return { ok: true, payload: currentStatus }
            case 'GET_INTERVENTION':
              if (!currentIntervention) {
                return { ok: false, error: { message: 'Intervention not found' } }
              }
              return { ok: true, payload: currentIntervention }
            case 'RETURN_TO_STUDY':
              return { ok: true, payload: { destination: currentIntervention?.returnUrl || 'http://localhost:5173' } }
            case 'REQUEST_EXCEPTION':
              if (!currentIntervention?.canRequestException) {
                return { ok: false, error: { message: 'Temporary exception not allowed' } }
              }
              return { ok: true, payload: { expiresAt: Date.now() + 300 * 1000 } }
            case 'REVIEW_RULES':
              return { ok: true, payload: { opened: true } }
            default:
              return { ok: false, error: { message: `Unknown message type ${msg.type}` } }
          }
        },
      },
      storage: {
        local: {
          get: (keys: any, cb?: (res: any) => void) => {
            const res = typeof keys === 'string' ? { [keys]: storage[keys] } : storage
            if (cb) cb(res)
            return Promise.resolve(res)
          },
          set: (items: any, cb?: () => void) => {
            Object.assign(storage, items)
            if (cb) cb()
            return Promise.resolve()
          },
        },
      },
    }

    // @ts-expect-error Mocking chrome extension API in test environment
    window.chrome = mockApi
    // @ts-expect-error Mocking browser extension API in test environment
    window.browser = mockApi
  }, { status: initialStatus, intervention: initialIntervention })
}

test.describe('SHINPO Browser Companion Interactive UI Suite', () => {
  test.beforeAll(async () => {
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true })
    await fs.mkdir(path.join(SCREENSHOT_DIR, 'popup'), { recursive: true })
    await fs.mkdir(path.join(SCREENSHOT_DIR, 'options'), { recursive: true })
    await fs.mkdir(path.join(SCREENSHOT_DIR, 'intervention'), { recursive: true })

    // Start lightweight local HTTP server for serving extension pages with module CORS support
    server = http.createServer(async (req, res) => {
      try {
        const parsedUrl = new URL(req.url || '/', 'http://127.0.0.1')
        let filePath = path.join(EXT_SRC_PAGES, parsedUrl.pathname)
        if (!filePath.startsWith(EXT_SRC_PAGES)) {
          res.writeHead(403)
          res.end('Forbidden')
          return
        }
        const stat = await fs.stat(filePath)
        if (stat.isDirectory()) {
          filePath = path.join(filePath, 'popup.html')
        }
        const ext = path.extname(filePath)
        const mimeTypes: Record<string, string> = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'application/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.png': 'image/png',
          '.svg': 'image/svg+xml',
        }
        const data = await fs.readFile(filePath)
        res.writeHead(200, {
          'Content-Type': mimeTypes[ext] || 'application/octet-stream',
          'Access-Control-Allow-Origin': '*',
        })
        res.end(data)
      } catch {
        res.writeHead(404)
        res.end('Not Found')
      }
    })

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as any
        baseUrl = `http://127.0.0.1:${address.port}`
        resolve()
      })
    })
  })

  test.afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve))
    }
  })

  test('Popup: Unpaired state renders pairing input and keeps Sync disabled after busy state', async ({ page }) => {
    const unpairedStatus = createMockStatus({
      connection: { state: 'UNPAIRED', paired: false, lastSyncAt: null, error: null },
      policy: { active: false, sessionId: null },
    })

    await injectExtensionMock(page, unpairedStatus)
    await page.goto(`${baseUrl}/popup.html`)

    // Verify status pill and connection detail
    await expect(page.locator('#status-pill')).toHaveClass(/warning/)
    await expect(page.locator('#connection-label')).toHaveText('Unpaired')
    await expect(page.locator('#pair-card')).toBeVisible()
    await expect(page.locator('#focus-card')).toBeHidden()

    // Verify Sync and Disconnect are strictly disabled
    const syncBtn = page.locator('#sync')
    const disconnectBtn = page.locator('#disconnect')
    const pairBtn = page.locator('#pair')

    await expect(syncBtn).toBeDisabled()
    await expect(disconnectBtn).toBeDisabled()
    await expect(pairBtn).toBeEnabled()

    // Attempt pairing with an empty code (triggers busy/error cycle)
    await pairBtn.click()
    await expect(page.locator('#message')).toHaveText('Please enter a pairing code from SHINPO Desktop')

    // CRITICAL: Ensure setBusy(false) DID NOT re-enable Sync button when still unpaired
    await expect(syncBtn).toBeDisabled()
    await expect(disconnectBtn).toBeDisabled()

    // Now enter valid pairing code and pair
    await page.locator('#pairing-code').fill('VALID-PAIRING-TOKEN-123')
    await pairBtn.click()

    await expect(page.locator('#message')).toHaveText('Paired successfully!')
    await expect(page.locator('#status-pill')).toHaveClass(/connected/)
    await expect(page.locator('#connection-label')).toHaveText('Connected')
    await expect(page.locator('#pair-card')).toBeHidden()

    // Now Sync and Disconnect should be enabled
    await expect(syncBtn).toBeEnabled()
    await expect(disconnectBtn).toBeEnabled()
  })

  test('Popup: Connected with Active Focus session renders timer, mode, pause, and lease', async ({ page }) => {
    const activeStatus = createMockStatus()
    await injectExtensionMock(page, activeStatus)
    await page.goto(`${baseUrl}/popup.html`)

    // Verify Active Focus card elements
    await expect(page.locator('#focus-card')).toBeVisible()
    await expect(page.locator('#task-title')).toHaveText('Audit Browser Companion Accessibility')
    await expect(page.locator('#focus-mode')).toHaveText('STANDARD FOCUS')
    await expect(page.locator('#paused-badge')).toBeHidden()
    await expect(page.locator('#countdown-time')).toHaveText('25:00')
    await expect(page.locator('#phase-status')).toContainText('focus · 25:00 remaining')
    await expect(page.locator('#lease')).toHaveText('Lease: 300s')

    // Test monitoring switch toggle
    const monitoringInput = page.locator('#monitoring')
    await expect(monitoringInput).toBeChecked()

    await monitoringInput.click()
    await expect(monitoringInput).not.toBeChecked()
    await expect(page.locator('#status-alert')).toBeVisible()
    await expect(page.locator('#status-alert-text')).toContainText('Monitoring is paused')

    // Turn monitoring back on
    await monitoringInput.click()
    await expect(monitoringInput).toBeChecked()
    await expect(page.locator('#status-alert')).toBeHidden()
  })

  test('Popup: Disconnect modal flow requires explicit confirmation', async ({ page }) => {
    const activeStatus = createMockStatus()
    await injectExtensionMock(page, activeStatus)
    await page.goto(`${baseUrl}/popup.html`)

    const disconnectModal = page.locator('#disconnect-modal')
    await expect(disconnectModal).toBeHidden()

    // Click disconnect to open modal
    await page.locator('#disconnect').click()
    await expect(disconnectModal).toBeVisible()

    // Test dismiss via Cancel
    await page.locator('#cancel-disconnect').click()
    await expect(disconnectModal).toBeHidden()
    await expect(page.locator('#status-pill')).toHaveClass(/connected/)

    // Open again and test dismiss via Escape
    await page.locator('#disconnect').click()
    await expect(disconnectModal).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(disconnectModal).toBeHidden()

    // Open and confirm disconnect
    await page.locator('#disconnect').click()
    await expect(disconnectModal).toBeVisible()
    await page.locator('#confirm-disconnect').click()

    await expect(disconnectModal).toBeHidden()
    await expect(page.locator('#status-pill')).toHaveClass(/warning/)
    await expect(page.locator('#connection-label')).toHaveText('Unpaired')
    await expect(page.locator('#pair-card')).toBeVisible()
  })

  test('Popup: Renders all 4 themes cleanly with zero WCAG AA violations', async ({ page }) => {
    const activeStatus = createMockStatus()
    await injectExtensionMock(page, activeStatus)
    await page.goto(`${baseUrl}/popup.html`)

    const themes = ['aurora-dark', 'aurora-light', 'classic-dark', 'classic-light']

    for (const theme of themes) {
      // Select theme via dropdown
      await page.selectOption('#theme-select', theme)
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)

      // Allow CSS transitions to settle
      await page.waitForTimeout(150)

      // Capture screenshot
      const screenshotPath = path.join(SCREENSHOT_DIR, 'popup', `popup-${theme}.png`)
      await page.screenshot({ path: screenshotPath })

      // Accessibility audit
      const a11y = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze()
      const violations = a11y.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
      expect(violations, `A11y violations found in theme ${theme}`).toEqual([])
    }
  })

  test('Options: Loads diagnostics, saves review URL, and maintains accessibility', async ({ page }) => {
    const status = createMockStatus()
    await injectExtensionMock(page, status)
    await page.goto(`${baseUrl}/options.html`)

    // Check header and status
    await expect(page.locator('#connection-label')).toHaveText('Connected')
    await expect(page.locator('#opt-host-status')).toHaveText('Connected to SHINPO Desktop')

    // Check Diagnostics table
    await expect(page.locator('#diag-state')).toHaveText('CONNECTED')
    await expect(page.locator('#diag-policy-version')).toHaveText('12')
    await expect(page.locator('#diag-session-id')).toHaveText('session-e2e-01')
    await expect(page.locator('#diag-mode')).toHaveText('STANDARD FOCUS')
    await expect(page.locator('#diag-lease')).toHaveText('300 seconds remaining')
    await expect(page.locator('#diag-error')).toHaveText('None (healthy)')

    // Test saving Focus rules URL
    const reviewUrlInput = page.locator('#review-url')
    await expect(reviewUrlInput).toHaveValue('http://localhost:5173/focus')
    await reviewUrlInput.fill('http://localhost:5173/updated-rules')
    await page.locator('#save-url').click()

    await expect(page.locator('#message-banner')).toBeVisible()
    await expect(page.locator('#message-text')).toHaveText('Focus rules destination saved.')
    await expect(reviewUrlInput).toHaveValue('http://localhost:5173/updated-rules')

    // Test themes and screenshots
    const themes = ['aurora-dark', 'aurora-light', 'classic-dark', 'classic-light']
    for (const theme of themes) {
      await page.selectOption('#theme-select', theme)
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await page.waitForTimeout(150)

      const screenshotPath = path.join(SCREENSHOT_DIR, 'options', `options-${theme}.png`)
      await page.screenshot({ path: screenshotPath })

      const a11y = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze()
      const violations = a11y.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
      expect(violations, `Options a11y violations in theme ${theme}`).toEqual([])
    }
  })

  test('Intervention: Displays blocked domain, primary Return button, and strict confirmation', async ({ page }) => {
    const mockIntervention = {
      id: 'interv-uuid-1234',
      taskTitle: 'Mastering Advanced Algorithms',
      reason: 'Domain is blocked under Standard Focus policy.',
      destinationHost: 'distracting-games.example',
      destination: 'https://distracting-games.example/play',
      returnUrl: 'https://learning-docs.example/algorithms',
      canReturn: true,
      canRequestException: true,
      mode: 'STRICT',
      sessionId: 'session-e2e-01',
      expiresAt: Date.now() + 600 * 1000,
    }

    await injectExtensionMock(page, createMockStatus(), mockIntervention)
    await page.goto(`${baseUrl}/intervention.html#interv-uuid-1234`)

    // Check displayed context
    await expect(page.locator('#task-title')).toHaveText('Mastering Advanced Algorithms')
    await expect(page.locator('#focus-mode')).toHaveText('STRICT FOCUS')
    await expect(page.locator('#destination')).toHaveText('distracting-games.example')
    await expect(page.locator('#reason')).toHaveText('Domain is blocked under Standard Focus policy.')

    // Primary Return to Study button is enabled
    const returnBtn = page.locator('#return')
    const allowBtn = page.locator('#allow')
    await expect(returnBtn).toBeEnabled()
    await expect(allowBtn).toBeEnabled()

    // Clicking Allow in STRICT mode reveals confirmation banner
    await expect(page.locator('#confirmation')).toBeHidden()
    await allowBtn.click()
    await expect(page.locator('#confirmation')).toBeVisible()

    // Confirm exception
    await page.locator('#confirm-allow').click()
    await expect(page.locator('#message')).toHaveText('Exception granted. Navigating to resource…')

    // Test screenshots and a11y across themes
    const themes = ['aurora-dark', 'aurora-light', 'classic-dark', 'classic-light']
    for (const theme of themes) {
      await page.evaluate((th) => document.documentElement.setAttribute('data-theme', th), theme)
      await page.waitForTimeout(150)

      const screenshotPath = path.join(SCREENSHOT_DIR, 'intervention', `intervention-${theme}.png`)
      await page.screenshot({ path: screenshotPath })

      const a11y = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze()
      const violations = a11y.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
      expect(violations, `Intervention a11y violations in theme ${theme}`).toEqual([])
    }
  })
})
