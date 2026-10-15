import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const SCREENSHOT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/v2_aurora'
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })

async function runAuroraVerification() {
  console.log('===============================================================')
  console.log('   SHINPO V1 vs V2 — MULTI-VIEWPORT & LAYOUT VERIFICATION')
  console.log('   Viewports: 1000x768, 1280x800, 1440x900, 1920x1080')
  console.log('===============================================================')

  const chromePort = 9228
  const chrome = spawn('google-chrome', [
    '--headless=new',
    `--remote-debugging-port=${chromePort}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    'http://localhost:5173/'
  ])

  try {
    let wsUrl = null
    for (let i = 0; i < 40; i++) {
      await sleep(250)
      try {
        const res = await fetch(`http://127.0.0.1:${chromePort}/json/list`)
        const list = await res.json()
        const page = list.find((it) => it.type === 'page')
        if (page && page.webSocketDebuggerUrl) {
          wsUrl = page.webSocketDebuggerUrl
          break
        }
      } catch {}
    }

    if (!wsUrl) throw new Error('Could not find Chrome webSocketDebuggerUrl')

    const ws = new WebSocket(wsUrl)
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve)
      ws.addEventListener('error', reject)
    })

    let id = 1
    const pending = new Map()

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg)
        pending.delete(msg.id)
      }
    })

    function send(method, params = {}) {
      return new Promise((resolve) => {
        const reqId = id++
        pending.set(reqId, resolve)
        ws.send(JSON.stringify({ id: reqId, method, params }))
      })
    }

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      })
      if (res.result && res.result.exceptionDetails) {
        throw new Error(`Eval error: ${JSON.stringify(res.result.exceptionDetails)}`)
      }
      return res.result?.result?.value
    }

    async function setViewport(width, height) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 2, // High DPI capture for crisp typography
        mobile: false,
      })
    }

    async function captureScreenshot(name) {
      const res = await send('Page.captureScreenshot', { format: 'png' })
      const filePath = path.join(SCREENSHOT_DIR, `${name}.png`)
      fs.writeFileSync(filePath, Buffer.from(res.result.data, 'base64'))
      console.log(`[Captured] ${name}.png saved to ${filePath}`)
      return filePath
    }

    await send('Page.enable')
    await send('DOM.enable')
    await send('Runtime.enable')

    console.log('[Step 1] Navigating to SHINPO application...')
    await send('Page.navigate', { url: 'http://localhost:5173/' })
    await sleep(2000)

    // Check if on login screen
    const isLoginScreen = await evaluate(`Boolean(document.querySelector('.auth-fullscreen-container') || document.querySelector('.auth-card-hero'))`)
    if (isLoginScreen) {
      console.log('[Auth] Detected auth screen, performing Quick Fill & Sign In...')
      await evaluate(`(() => {
        const quickBtn = document.querySelector('.auth-quick-fill-btn');
        if (quickBtn) quickBtn.click();
      })()`)
      await sleep(300)
      await evaluate(`(() => {
        const submitBtn = document.querySelector('.auth-submit-btn');
        if (submitBtn) submitBtn.click();
      })()`)
      await sleep(2000)
    }

    // Helper functions for theme and UI toggle
    async function ensureV2(active) {
      const currentV2 = await evaluate(`Boolean(document.querySelector('.aurora-viewport'))`)
      if (currentV2 !== active) {
        await evaluate(`(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b =>
            b.innerText.includes('V2 AURORA') || b.innerText.includes('Classic View')
          );
          if (btn) btn.click();
        })()`)
        await sleep(600)
      }
    }

    async function setDarkTheme(dark) {
      const isDark = await evaluate(`(() => {
        if (document.querySelector('.aurora-viewport')) {
          return document.querySelector('.aurora-viewport').classList.contains('theme-dark');
        }
        return !document.querySelector('.app-shell')?.classList.contains('theme-light');
      })()`)

      if (isDark !== dark) {
        await evaluate(`(() => {
          const btn = document.querySelector('button[title*="Theme"]') ||
                      document.querySelector('button[title*="Mode"]') ||
                      Array.from(document.querySelectorAll('button')).find(b => b.title && b.title.includes('Theme'));
          if (btn) btn.click();
        })()`)
        await sleep(500)
      }
    }

    const viewports = [
      { name: '1920x1080', width: 1920, height: 1080 },
      { name: '1440x900',  width: 1440, height: 900 },
      { name: '1280x800',  width: 1280, height: 800 },
      { name: '1000x768',  width: 1000, height: 768 },
    ]

    console.log('\n--- PART A: CAPTURING V1 CLASSIC UI BASELINES ---')
    await ensureV2(false)

    for (const vp of viewports) {
      await setViewport(vp.width, vp.height)
      await setDarkTheme(true)
      await sleep(400)
      await captureScreenshot(`V1_Classic_Dark_${vp.name}`)

      await setDarkTheme(false)
      await sleep(400)
      await captureScreenshot(`V1_Classic_Light_${vp.name}`)
    }

    console.log('\n--- PART B: CAPTURING V2 AURORA (RESTORED LAYOUT) ---')
    await ensureV2(true)

    for (const vp of viewports) {
      await setViewport(vp.width, vp.height)
      await setDarkTheme(true)
      await sleep(400)
      await captureScreenshot(`V2_Aurora_Dark_${vp.name}`)

      await setDarkTheme(false)
      await sleep(400)
      await captureScreenshot(`V2_Aurora_Light_${vp.name}`)
    }

    console.log('\n--- PART C: MEASURING GEOMETRY & RESPONSIVE COMPLIANCE ---')
    await setViewport(1440, 900)
    await setDarkTheme(true)
    await sleep(400)

    const v2Metrics = await evaluate(`(() => {
      const topbar = document.querySelector('header[role="banner"]');
      const topbarHeight = topbar ? topbar.getBoundingClientRect().height : 0;
      const liveClock = Boolean(document.querySelector('.dashboard-live-clock'));
      const metricCards = document.querySelectorAll('[aria-label="Performance Metrics"] > *').length;
      const scheduleItems = document.querySelectorAll('[aria-label*="Schedule"] .aurora-card-interactive').length;
      const kanbanCols = document.querySelectorAll('#aurora-tasks-board > div > *').length;
      const noHorizontalOverflow = document.documentElement.scrollWidth <= window.innerWidth;

      return {
        topbarHeight,
        hasLiveClock: liveClock,
        metricCardsCount: metricCards,
        scheduleItemsCount: scheduleItems,
        kanbanColumnsCount: kanbanCols,
        noHorizontalOverflow,
      };
    })()`)

    console.log('[Layout Compliance Metrics]:', JSON.stringify(v2Metrics, null, 2))

    console.log('===============================================================')
    console.log('   VERIFICATION AND COMPARISON RUN COMPLETED')
    console.log('===============================================================')

    ws.close()
  } finally {
    chrome.kill('SIGTERM')
  }
}

runAuroraVerification().catch((err) => {
  console.error('Verification failed:', err)
  process.exit(1)
})
