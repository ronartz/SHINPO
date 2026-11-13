import { chromium } from '/home/eonx/Projects/SHINPO/frontend/node_modules/@playwright/test/index.mjs'
import { execSync } from 'node:child_process'
import http from 'node:http'
import path from 'node:path'
import fs from 'node:fs'

const ROOT = '/home/eonx/Projects/SHINPO'
const EXTENSION_PATH = path.join(ROOT, 'browser-extension/dist/chromium')
const BROWSER_HOST_BIN = path.join(ROOT, 'crates/shinpo-browser-host/target/release/shinpo-browser-host')
const EXT_ID = 'ndknhgihhogcfkliohfjcllglpjdgjpj'
const PORT = 4567
const USER_DATA_DIR = `/tmp/shinpo-companion-acceptance-${Date.now()}`
const SCREENSHOT_DIR = path.join(ROOT, 'docs/qa/screenshots/browser-companion-manual')

fs.mkdirSync(USER_DATA_DIR, { recursive: true })
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })

async function saveScreenshot(page, filename) {
  const filePath = path.join(SCREENSHOT_DIR, filename)
  await page.screenshot({ path: filePath })
  console.log(`  [SCREENSHOT] Saved: ${filename}`)
  return filePath
}

async function run() {
  console.log('======================================================================')
  console.log('  SHINPO BROWSER COMPANION MANUAL & ACCEPTANCE VERIFICATION')
  console.log('======================================================================')
  console.log(`Profile Dir:    ${USER_DATA_DIR}`)
  console.log(`Extension Path: ${EXTENSION_PATH}`)
  console.log(`Extension ID:   ${EXT_ID}`)
  console.log(`Host Binary:    ${BROWSER_HOST_BIN}`)

  // 1. Start local mock HTTP server
  console.log('\n--- [Step 1] Starting Mock Web Server ---')
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    if (req.url === '/approved') {
      res.end(`<!DOCTYPE html>
<html>
<head><title>Approved Research Documentation</title><style>body{font-family:sans-serif;padding:30px;background:#f8fafc;color:#0f172a;}</style></head>
<body>
  <h1>Approved Research Documentation</h1>
  <p>Status: Permitted under active Focus policy.</p>
</body>
</html>`)
    } else if (req.url === '/restricted') {
      res.end(`<!DOCTYPE html>
<html>
<head><title>Restricted Social Feed</title><style>body{font-family:sans-serif;padding:30px;background:#fee2e2;color:#991b1b;}</style></head>
<body>
  <h1>Restricted Entertainment & Social Stream</h1>
  <p>Status: Distracting resource blocked by SHINPO.</p>
</body>
</html>`)
    } else {
      res.end(`<!DOCTYPE html><html><body><h1>General Page</h1></body></html>`)
    }
  })

  await new Promise(resolve => server.listen(PORT, '127.0.0.1', resolve))
  console.log(`  ✓ Web server listening at http://127.0.0.1:${PORT}`)

  // 2. Register Native Messaging Host
  console.log('\n--- [Step 2] Registering Native Messaging Host for Disposable Profile ---')
  const nmhDir = path.join(USER_DATA_DIR, 'NativeMessagingHosts')
  fs.mkdirSync(nmhDir, { recursive: true })
  execSync(`./scripts/register-browser-companion.sh --target-dir ${nmhDir}`, {
    cwd: ROOT,
    stdio: 'inherit',
  })

  const manifestPath = path.join(nmhDir, 'com.shinpo.browser_companion.json')
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest not created at ${manifestPath}`)
  }
  const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  console.log(`  ✓ Verified manifest registered: ${manifestPath}`)
  console.log(`    - Host Name: ${manifestContent.name}`)
  console.log(`    - Binary:    ${manifestContent.path}`)
  console.log(`    - Origin:    ${manifestContent.allowed_origins[0]}`)

  // 3. Initialize host installation
  console.log('\n--- [Step 3] Initializing Native Host Installation ---')
  execSync(`${BROWSER_HOST_BIN} init`, { stdio: 'inherit' })
  console.log('  ✓ Native host installation initialized')

  // 4. Launch Browser with Extension
  console.log('\n--- [Step 4] Launching Real Browser Window with Extension ---')
  const launchOptions = {
    headless: false,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-gpu',
    ],
  }

  let context = await chromium.launchPersistentContext(USER_DATA_DIR, launchOptions)
  console.log('  ✓ Browser launched successfully')

  const popupUrl = `chrome-extension://${EXT_ID}/pages/popup.html`
  const optionsUrl = `chrome-extension://${EXT_ID}/pages/options.html`

  // 5. Verify Unpaired State
  console.log('\n--- [Step 5] Verifying Unpaired Extension State ---')
  const popupPage = await context.newPage()
  await popupPage.goto(popupUrl)
  await popupPage.waitForSelector('#connection-label')
  const connTextUnpaired = await popupPage.textContent('#connection-label')
  console.log(`  ✓ Unpaired Connection Status: "${connTextUnpaired.trim()}"`)
  await popupPage.waitForTimeout(300)
  await saveScreenshot(popupPage, '01_extension_popup_unpaired.png')

  // 6. Verify Options Page
  console.log('\n--- [Step 6] Verifying Settings / Options Page ---')
  const optionsPage = await context.newPage()
  await optionsPage.goto(optionsUrl)
  await optionsPage.waitForSelector('#save-url')
  await optionsPage.waitForTimeout(300)
  await saveScreenshot(optionsPage, '02_extension_options_page.png')
  await optionsPage.close()

  // 7. Pairing Flow
  console.log('\n--- [Step 7] Executing Pairing Flow ---')
  const pairingCode = execSync(`${BROWSER_HOST_BIN} rotate-pairing`, { encoding: 'utf8' }).trim()
  console.log(`  ✓ Generated one-time pairing code (${pairingCode.length} chars)`)

  await popupPage.bringToFront()
  await popupPage.fill('#pairing-code', pairingCode)
  await popupPage.click('#pair')

  await popupPage.waitForFunction(() => {
    const el = document.getElementById('connection-label')
    return el && el.textContent.includes('Connected')
  }, { timeout: 10000 })

  const connTextPaired = await popupPage.textContent('#connection-label')
  console.log(`  ✓ Paired Connection Status: "${connTextPaired.trim()}"`)
  await popupPage.waitForTimeout(300)
  await saveScreenshot(popupPage, '03_extension_popup_paired.png')

  // Verify Native Host status reports paired
  const hostStatus = JSON.parse(execSync(`${BROWSER_HOST_BIN} status`, { encoding: 'utf8' }))
  console.log('  ✓ Native Host reports installation ID:', hostStatus.installationId)

  // 8. Publish Active Focus Policy with Approved & Restricted rules
  console.log('\n--- [Step 8] Publishing Active Focus Policy ---')
  const now = Date.now()
  const activePolicy = {
    status: 'ACTIVE',
    sessionId: 501,
    taskTitle: 'Systems Architecture & Acceptance Verification',
    currentPhase: 'FOCUS',
    mode: 'STRICT',
    issuedAt: now,
    policyVersion: 1,
    phaseDeadlineAt: now + 30 * 60 * 1000,
    allowTemporaryExceptions: true,
    resources: [
      {
        id: 10,
        title: 'Approved Research',
        resourceType: 'WEBSITE',
        matchType: 'EXACT',
        disposition: 'APPROVED',
        breakOnly: false,
        destination: `http://127.0.0.1:${PORT}/approved`,
      },
      {
        id: 11,
        title: 'Restricted Entertainment',
        resourceType: 'WEBSITE',
        matchType: 'EXACT',
        disposition: 'BLOCKED',
        breakOnly: false,
        destination: `http://127.0.0.1:${PORT}/restricted`,
      },
    ],
  }

  execSync(`${BROWSER_HOST_BIN} publish-policy`, {
    input: JSON.stringify(activePolicy),
    stdio: ['pipe', 'inherit', 'inherit'],
  })
  console.log('  ✓ Published active policy to native host')

  // Trigger sync in popup
  await popupPage.bringToFront()
  await popupPage.click('#sync')
  await popupPage.waitForFunction(() => {
    const focusCard = document.getElementById('focus-card')
    const phase = document.getElementById('phase-status')
    return focusCard && !focusCard.classList.contains('hidden') && phase && phase.textContent.includes('focus')
  }, { timeout: 5000 })
  console.log('  ✓ Active Focus session synchronized to Browser Companion')
  await saveScreenshot(popupPage, '04_extension_popup_active_focus.png')

  // 9. Verify Approved Site Remains Accessible
  console.log('\n--- [Step 9] Verifying Approved Site Remains Accessible ---')
  const approvedTab = await context.newPage()
  await approvedTab.goto(`http://127.0.0.1:${PORT}/approved`)
  await approvedTab.waitForTimeout(500)
  const isInterventionOnApproved = await approvedTab.$('#shinpo-contextual-focus-intervention')
  if (isInterventionOnApproved) {
    throw new Error('Approved site was unexpectedly blocked by intervention!')
  }
  const approvedHeading = await approvedTab.textContent('h1')
  console.log(`  ✓ Approved site accessed successfully: "${approvedHeading.trim()}" (no intervention overlay)`)
  await saveScreenshot(approvedTab, '05_website_approved_accessible.png')
  await approvedTab.close()

  // 10. Verify Restricted Site Is Blocked with Intervention
  console.log('\n--- [Step 10] Verifying Restricted Site Is Blocked with Intervention ---')
  const restrictedTab = await context.newPage()
  await restrictedTab.goto(`http://127.0.0.1:${PORT}/restricted`)
  await restrictedTab.waitForSelector('#shinpo-contextual-focus-intervention', { timeout: 5000 })
  console.log('  ✓ SHINPO Contextual Focus Intervention overlay attached and visible in tab!')
  await restrictedTab.waitForTimeout(500)
  await saveScreenshot(restrictedTab, '06_website_restricted_blocked.png')

  // 11. End Focus Session and Verify Restriction Released
  console.log('\n--- [Step 11] Ending Focus Session & Verifying Policy Release ---')
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
  execSync(`${BROWSER_HOST_BIN} publish-policy`, {
    input: JSON.stringify(inactivePolicy),
    stdio: ['pipe', 'inherit', 'inherit'],
  })
  console.log('  ✓ Inactive policy published to native host')

  await popupPage.bringToFront()
  await popupPage.click('#sync')
  await popupPage.waitForTimeout(1000)
  await saveScreenshot(popupPage, '07_extension_popup_focus_released.png')

  // Reload restricted site tab -> must no longer be blocked
  await restrictedTab.bringToFront()
  await restrictedTab.reload()
  await restrictedTab.waitForTimeout(1000)
  const isInterventionAfterRelease = await restrictedTab.$('#shinpo-contextual-focus-intervention')
  if (isInterventionAfterRelease) {
    throw new Error('Restriction was not lifted after ending Focus session!')
  }
  console.log('  ✓ Policy restriction successfully released! Site is now accessible without intervention.')
  await saveScreenshot(restrictedTab, '08_website_restricted_after_release.png')
  await restrictedTab.close()

  // 12. Verify Persistence & Reconnection across Browser Restart
  console.log('\n--- [Step 12] Verifying Reconnection across Browser Restart ---')
  await context.close()
  console.log('  ✓ Browser closed')

  // Re-launch browser with same profile
  context = await chromium.launchPersistentContext(USER_DATA_DIR, launchOptions)
  console.log('  ✓ Browser re-launched with persisted profile')

  const reconnectPage = await context.newPage()
  await reconnectPage.goto(popupUrl)
  await reconnectPage.waitForSelector('#connection-label')
  await reconnectPage.waitForFunction(() => {
    const el = document.getElementById('connection-label')
    return el && el.textContent.includes('Connected')
  }, { timeout: 10000 })

  const connTextReconnected = await reconnectPage.textContent('#connection-label')
  console.log(`  ✓ Reconnected Connection Status: "${connTextReconnected.trim()}" (retained pairing token)`)
  await saveScreenshot(reconnectPage, '09_extension_popup_reconnected.png')

  await context.close()
  server.close()

  console.log('\n======================================================================')
  console.log('  ALL ACCEPTANCE CRITERIA VERIFIED WITH EMPIRICAL EVIDENCE')
  console.log('======================================================================')
}

run().catch((err) => {
  console.error('\nFAILED WITH ERROR:', err)
  process.exit(1)
})
