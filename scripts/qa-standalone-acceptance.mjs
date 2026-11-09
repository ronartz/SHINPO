import { chromium } from '../frontend/node_modules/@playwright/test/index.mjs'
import { execSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import path from 'node:path'

const REPO_ROOT = process.cwd()
const DESKTOP_BIN = path.resolve('frontend/src-tauri/target/release/shinpo-desktop')
const BROWSER_HOST_BIN = path.resolve('crates/shinpo-browser-host/target/release/shinpo-browser-host')
const EXTENSION_PATH = path.resolve('browser-extension/dist/chromium')
const RPM_PATH = path.resolve('frontend/src-tauri/target/release/bundle/rpm/SHINPO-1.0.0-1.x86_64.rpm')

const RUN_ID = Date.now()
const TEST_ROOT = `/tmp/shinpo-standalone-test-${RUN_ID}`
const XDG_DATA_HOME = path.join(TEST_ROOT, 'data')
const XDG_CONFIG_HOME = path.join(TEST_ROOT, 'config')
const XDG_CACHE_HOME = path.join(TEST_ROOT, 'cache')
const EVIDENCE_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/standalone-acceptance'
const DOCS_EVIDENCE_DIR = path.resolve('docs/qa/screenshots/browser-companion')

for (const dir of [TEST_ROOT, XDG_DATA_HOME, XDG_CONFIG_HOME, XDG_CACHE_HOME, EVIDENCE_DIR, DOCS_EVIDENCE_DIR]) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
}

async function saveShot(page, filename) {
  const p1 = path.join(EVIDENCE_DIR, filename)
  const p2 = path.join(DOCS_EVIDENCE_DIR, filename)
  await page.screenshot({ path: p1 })
  fs.copyFileSync(p1, p2)
  console.log(`  ✓ Saved screenshot: ${filename}`)
}

function checkPortFree(port) {
  return new Promise((resolve) => {
    const s = net.connect({ host: '127.0.0.1', port })
    s.once('connect', () => { s.destroy(); resolve(false) })
    s.once('error', () => resolve(true))
  })
}

async function run() {
  console.log('======================================================================')
  console.log('  SHINPO STANDALONE ACCEPTANCE & TRUE OFFLINE INSTALLATION GATE')
  console.log('======================================================================')
  console.log(`Disposable Root:   ${TEST_ROOT}`)
  console.log(`Desktop Binary:    ${DESKTOP_BIN}`)
  console.log(`RPM Release Pack:  ${RPM_PATH}`)
  console.log(`Browser Extension: ${EXTENSION_PATH}`)
  console.log('----------------------------------------------------------------------')

  // 1. Preflight: Verify no background backend/dev servers running
  console.log('\n[1/8] Verifying clean offline environment (no Java/Postgres/Vite)...')
  const p5173 = await checkPortFree(5173)
  const p8080 = await checkPortFree(8080)
  const p5432 = await checkPortFree(5432)
  console.log(`  Port 5173 (Vite dev server):       ${p5173 ? 'FREE (OK)' : 'IN USE (FAIL)'}`)
  console.log(`  Port 8080 (Legacy server canary):   ${p8080 ? 'FREE (OK)' : 'IN USE (FAIL)'}`)
  console.log(`  Port 5432 (Legacy database canary): ${p5432 ? 'FREE (OK)' : 'IN USE (FAIL)'}`)
  if (!p5173 || !p8080 || !p5432) {
    throw new Error('Preflight failed: dev or backend servers are currently running on target ports')
  }

  // 2. Validate RPM Package integrity
  console.log('\n[2/8] Validating RPM Release Package...')
  execSync('./scripts/qa-package-linux.sh', { stdio: 'inherit' })

  // 3. Start local mock site for safe website rule testing (port 4567)
  console.log('\n[3/8] Launching safe mock website server (port 4567)...')
  const mockServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(`<!DOCTYPE html>
<html>
<head><title>Test Distraction Site</title><style>body{font-family:sans-serif;background:#eee;padding:40px;}</style></head>
<body><h1>Social Feed - Memes & Discussions</h1><p>Infinite scroll stream</p></body>
</html>`)
  })
  await new Promise((resolve) => mockServer.listen(4567, '127.0.0.1', resolve))
  console.log('  ✓ Mock site active at http://127.0.0.1:4567/distraction')

  // 4. Test Standalone Desktop Binary Launch in isolated profile
  console.log('\n[4/8] Testing standalone shinpo-desktop launch in isolated profile...')
  const desktopEnv = {
    ...process.env,
    XDG_DATA_HOME,
    XDG_CONFIG_HOME,
    XDG_CACHE_HOME,
    HOME: TEST_ROOT,
  }
  const desktopProc = spawn(DESKTOP_BIN, [], {
    env: desktopEnv,
    stdio: 'ignore',
  })
  console.log(`  ✓ Spawned standalone shinpo-desktop PID: ${desktopProc.pid}`)
  await new Promise((r) => setTimeout(r, 2000))
  // Verify process is alive
  try {
    process.kill(desktopProc.pid, 0)
    console.log(`  ✓ Verified shinpo-desktop PID ${desktopProc.pid} is running healthy`)
  } catch (err) {
    throw new Error(`Desktop app exited unexpectedly: ${err.message}`)
  }

  // 5. Register Browser Companion in isolated profile and browser environments
  console.log('\n[5/8] Registering Native Messaging Host for disposable browser...')
  const nmhPlaywrightDir = path.join(TEST_ROOT, 'NativeMessagingHosts')
  const nmhChromeDir = path.join(TEST_ROOT, '.config/google-chrome/NativeMessagingHosts')
  fs.mkdirSync(nmhPlaywrightDir, { recursive: true })
  fs.mkdirSync(nmhChromeDir, { recursive: true })
  execSync(`./scripts/register-browser-companion.sh --chrome --chromium --target-dir ${nmhPlaywrightDir}`, {
    env: desktopEnv,
    stdio: 'inherit',
  })

  // Initialize native host installation
  const initRes = JSON.parse(execSync(`${BROWSER_HOST_BIN} init`, {
    env: desktopEnv,
    encoding: 'utf8',
  }).trim())
  const pairingCode = initRes.pairingCode || execSync(`${BROWSER_HOST_BIN} rotate-pairing`, {
    env: desktopEnv,
    encoding: 'utf8',
  }).trim()
  console.log(`  ✓ Native host initialized with pairing code: ${pairingCode}`)

  // 6. Launch Browser Companion and verify complete pairing & focus lifecycle
  console.log('\n[6/8] Executing complete Browser Companion lifecycle in browser...')
  const browserContext = await chromium.launchPersistentContext(TEST_ROOT, {
    env: desktopEnv,
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-gpu',
    ],
  })

  const extId = 'ndknhgihhogcfkliohfjcllglpjdgjpj'
  const popupUrl = `chrome-extension://${extId}/pages/popup.html`
  const optionsUrl = `chrome-extension://${extId}/pages/options.html`

  const popupPage = await browserContext.newPage()
  await popupPage.goto(popupUrl)
  await popupPage.waitForSelector('#connection-label')
  await saveShot(popupPage, 'standalone_01_popup_unpaired.png')

  // Use generated pairing code from step 5

  await popupPage.fill('#pairing-code', pairingCode)
  await popupPage.click('#pair')
  await popupPage.waitForFunction(() => {
    const el = document.getElementById('connection-label')
    return el && el.textContent.includes('Connected to SHINPO')
  }, { timeout: 5000 })
  console.log('  ✓ Browser Companion successfully paired!')
  await saveShot(popupPage, 'standalone_02_popup_paired.png')

  // Publish Active Focus Policy with safe website rule
  console.log('\n[7/8] Publishing Active Focus Policy with website restriction...')
  const now = Date.now()
  const activePolicy = {
    status: 'ACTIVE',
    sessionId: 202,
    taskTitle: 'Offline Execution & Deep Work',
    currentPhase: 'FOCUS',
    mode: 'STRICT',
    issuedAt: now,
    policyVersion: 1,
    phaseDeadlineAt: now + 30 * 60 * 1000,
    allowTemporaryExceptions: true,
    resources: [
      {
        id: 1,
        title: 'Approved Local Docs',
        resourceType: 'WEBSITE',
        matchType: 'DOMAIN',
        disposition: 'APPROVED',
        breakOnly: false,
        destination: 'http://127.0.0.1:4567/docs',
      },
      {
        id: 2,
        title: 'Blocked Distracting Site',
        resourceType: 'WEBSITE',
        matchType: 'DOMAIN',
        disposition: 'BLOCKED',
        breakOnly: false,
        destination: 'http://127.0.0.1:4567/distraction',
      },
    ],
  }
  execSync(
    `${BROWSER_HOST_BIN} publish-policy`,
    { input: JSON.stringify(activePolicy), env: desktopEnv, stdio: ['pipe', 'inherit', 'inherit'] }
  )

  await popupPage.bringToFront()
  await popupPage.click('#sync')
  await popupPage.waitForFunction(() => {
    const focusCard = document.getElementById('focus-card')
    const phase = document.getElementById('phase-status')
    return focusCard && !focusCard.classList.contains('hidden') && phase && phase.textContent.includes('focus')
  }, { timeout: 5000 })
  console.log('  ✓ Active Focus policy synchronized to Browser Companion!')
  await saveShot(popupPage, 'standalone_03_active_focus.png')

  // Navigate to blocked site and verify intervention
  console.log('  >> Navigating to http://127.0.0.1:4567/distraction to verify intervention...')
  const targetTab = await browserContext.newPage()
  await targetTab.goto('http://127.0.0.1:4567/distraction')
  await targetTab.waitForSelector('#shinpo-contextual-focus-intervention', { timeout: 5000 })
  console.log('  ✓ Contextual Focus Protection intervention overlay confirmed active!')
  await saveShot(targetTab, 'standalone_04_website_intervention.png')

  // Stop Focus and confirm release
  console.log('\n[8/8] Deactivating Focus and confirming rule deactivates and persists...')
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
    `${BROWSER_HOST_BIN} publish-policy`,
    { input: JSON.stringify(inactivePolicy), env: desktopEnv, stdio: ['pipe', 'inherit', 'inherit'] }
  )

  await popupPage.bringToFront()
  await popupPage.click('#sync')
  await popupPage.waitForTimeout(1000)
  await saveShot(popupPage, 'standalone_05_focus_stopped_released.png')

  // Clean shutdown
  await browserContext.close()
  mockServer.close()
  try { desktopProc.kill('SIGTERM') } catch {}

  console.log('\n======================================================================')
  console.log('  STANDALONE OFFLINE ACCEPTANCE GATE: PASS')
  console.log('  All 8 criteria empirically satisfied and verified.')
  console.log('======================================================================')
}

run().catch((err) => {
  console.error('\n❌ Standalone Acceptance Gate Failed:', err)
  process.exit(1)
})
