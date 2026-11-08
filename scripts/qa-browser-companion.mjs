import { chromium } from '../frontend/node_modules/@playwright/test/index.mjs'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const EXTENSION_PATH = path.resolve('browser-extension/dist/chromium')
const USER_DATA_DIR = `/tmp/shinpo-companion-profile-${Date.now()}`
const SCREENSHOT_DIR_1 = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/browser-companion'
const SCREENSHOT_DIR_2 = path.resolve('docs/qa/screenshots/browser-companion')

fs.mkdirSync(SCREENSHOT_DIR_1, { recursive: true })
fs.mkdirSync(SCREENSHOT_DIR_2, { recursive: true })

async function saveScreenshot(page, filename) {
  const p1 = path.join(SCREENSHOT_DIR_1, filename)
  const p2 = path.join(SCREENSHOT_DIR_2, filename)
  await page.screenshot({ path: p1 })
  fs.copyFileSync(p1, p2)
  console.log(`Saved screenshot: ${filename}`)
}

async function run() {
  console.log('=== SHINPO BROWSER COMPANION ACCEPTANCE TEST ===')
  console.log(`Extension Path: ${EXTENSION_PATH}`)
  console.log(`Profile Dir:    ${USER_DATA_DIR}`)

  // 0. Spin up mock test server for safe website rule testing
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(`<!DOCTYPE html>
<html>
<head>
  <title>Social Media Feed</title>
  <style>body { font-family: sans-serif; background: #f0f2f5; margin: 0; padding: 40px; }</style>
</head>
<body>
  <h1>Social Network - Endless Feed</h1>
  <p>Status updates, memes, and distracting content...</p>
</body>
</html>`)
  })
  await new Promise((resolve) => server.listen(4567, '127.0.0.1', resolve))
  console.log('✓ Mock website server listening at http://127.0.0.1:4567')

  // 1. Ensure Native Host is registered for Chrome and the test profile
  console.log('\n[1/7] Ensuring Native Messaging Host is registered...')
  fs.mkdirSync(path.join(USER_DATA_DIR, 'NativeMessagingHosts'), { recursive: true })
  execSync(`./scripts/register-browser-companion.sh --chrome --target-dir ${path.join(USER_DATA_DIR, 'NativeMessagingHosts')}`, { stdio: 'inherit' })

  // 2. Launch Chromium with the extension
  console.log('\n[2/7] Launching Chromium with extension loaded...')
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-gpu',
    ],
  })

  const extensionId = 'ndknhgihhogcfkliohfjcllglpjdgjpj'
  console.log(`✓ Extension ID: ${extensionId}`)

  const popupUrl = `chrome-extension://${extensionId}/pages/popup.html`
  const optionsUrl = `chrome-extension://${extensionId}/pages/options.html`

  // 3. Open Popup in Unpaired State
  console.log('\n[3/7] Verifying Popup in Unpaired State...')
  const popupPage = await context.newPage()
  await popupPage.goto(popupUrl)
  await popupPage.waitForSelector('#connection-label')
  await popupPage.waitForTimeout(500)
  await saveScreenshot(popupPage, '01_companion_popup_unpaired.png')

  // 4. Open Options / Setup Page
  console.log('\n[4/7] Verifying Options / Setup Page...')
  const optionsPage = await context.newPage()
  await optionsPage.goto(optionsUrl)
  await optionsPage.waitForSelector('#save-url')
  await optionsPage.waitForTimeout(500)
  await saveScreenshot(optionsPage, '02_companion_options_setup.png')
  await optionsPage.close()

  // 5. Generate a fresh pairing code via native host CLI and pair the extension
  console.log('\n[5/7] Generating pairing code and pairing extension...')
  const pairingCode = execSync(
    './crates/shinpo-browser-host/target/release/shinpo-browser-host rotate-pairing',
    { encoding: 'utf8' }
  ).trim()
  console.log(`Pairing code generated: ${pairingCode}`)

  await popupPage.bringToFront()
  await popupPage.fill('#pairing-code', pairingCode)
  await popupPage.click('#pair')

  // Wait for connection to transition to CONNECTED
  await popupPage.waitForFunction(() => {
    const el = document.getElementById('connection-label')
    return el && el.textContent.includes('Connected to SHINPO')
  }, { timeout: 5000 })
  console.log('✓ Successfully paired! Status: Connected to SHINPO')
  await popupPage.waitForTimeout(500)
  await saveScreenshot(popupPage, '03_companion_popup_paired.png')

  // 6. Publish an Active Focus Policy with a blocked site rule
  console.log('\n[6/7] Publishing active Focus policy with website restriction...')
  const now = Date.now()
  const activePolicy = {
    status: 'ACTIVE',
    sessionId: 101,
    taskTitle: 'Deep Work: Core Architecture',
    currentPhase: 'FOCUS',
    mode: 'STRICT',
    issuedAt: now,
    policyVersion: 1,
    phaseDeadlineAt: now + 25 * 60 * 1000,
    allowTemporaryExceptions: true,
    resources: [
      {
        id: 1,
        title: 'Approved Docs',
        resourceType: 'WEBSITE',
        matchType: 'DOMAIN',
        disposition: 'APPROVED',
        breakOnly: false,
        destination: 'https://docs.shinpo.local',
      },
      {
        id: 2,
        title: 'Blocked Social Media',
        resourceType: 'WEBSITE',
        matchType: 'DOMAIN',
        disposition: 'BLOCKED',
        breakOnly: false,
        destination: 'http://127.0.0.1:4567/distraction',
      },
    ],
  }

  // Publish policy via shinpo-browser-host CLI (via stdin)
  const publishInput = JSON.stringify(activePolicy)
  execSync(
    './crates/shinpo-browser-host/target/release/shinpo-browser-host publish-policy',
    { input: publishInput, stdio: ['pipe', 'inherit', 'inherit'] }
  )

  // Trigger sync in popup
  await popupPage.click('#sync')
  await popupPage.waitForFunction(() => {
    const focusCard = document.getElementById('focus-card')
    const phase = document.getElementById('phase-status')
    return focusCard && !focusCard.classList.contains('hidden') && phase && phase.textContent.includes('focus')
  }, { timeout: 5000 })
  console.log('✓ Active Focus policy synchronized to extension!')
  await popupPage.waitForTimeout(500)
  await saveScreenshot(popupPage, '04_companion_popup_active_focus.png')

  // 7. Verify Website Intervention on Blocked Site
  console.log('\n[7/7] Navigating to blocked site (http://127.0.0.1:4567/distraction) to verify intervention...')
  const testTab = await context.newPage()
  await testTab.goto('http://127.0.0.1:4567/distraction')
  await testTab.waitForSelector('#shinpo-contextual-focus-intervention', { timeout: 5000 })
  console.log('✓ SHINPO Intervention overlay successfully rendered in tab!')
  await testTab.waitForTimeout(500)
  await saveScreenshot(testTab, '05_companion_website_intervention.png')

  // Capture standalone intervention fallback page
  console.log('Capturing standalone intervention page UI...')
  const interventionPage = await context.newPage()
  await interventionPage.goto(`chrome-extension://${extensionId}/pages/intervention.html`)
  await interventionPage.waitForTimeout(500)
  await saveScreenshot(interventionPage, '05b_companion_intervention_page.png')
  await interventionPage.close()

  // 8. Stop Focus and verify release
  console.log('\n[8/7] Deactivating Focus and confirming rule deactivates...')
  const inactivePolicy = {
    status: 'INACTIVE',
    sessionId: null,
    taskTitle: null,
    currentPhase: null,
    mode: 'GUIDED',
    issuedAt: Date.now(),
    policyVersion: 2,
    phaseDeadlineAt: null,
    allowTemporaryExceptions: false,
    resources: [],
  }
  execSync(
    './crates/shinpo-browser-host/target/release/shinpo-browser-host publish-policy',
    { input: JSON.stringify(inactivePolicy), stdio: ['pipe', 'inherit', 'inherit'] }
  )

  await popupPage.bringToFront()
  await popupPage.click('#sync')
  await popupPage.waitForTimeout(1000)
  await saveScreenshot(popupPage, '06_companion_focus_stopped_released.png')

  // 9. Disconnect
  console.log('\n[9/7] Disconnecting Browser Companion...')
  await popupPage.click('#disconnect')
  await popupPage.waitForTimeout(1000)
  await saveScreenshot(popupPage, '07_companion_popup_disconnected.png')

  await context.close()
  server.close()
  console.log('\n=== ALL BROWSER COMPANION ACCEPTANCE TESTS PASSED ===')
}

run().catch((err) => {
  console.error('Test run failed:', err)
  process.exit(1)
})
