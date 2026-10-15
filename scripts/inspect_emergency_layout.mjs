import { spawn } from 'child_process'
import fs from 'fs'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function inspectLayout() {
  const chromePort = 9241
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
      const msgId = id++
      return new Promise((resolve, reject) => {
        pending.set(msgId, resolve)
        ws.send(JSON.stringify({ id: msgId, method, params }))
      })
    }

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      })
      if (res.result && res.result.exceptionDetails) {
        console.error('Eval error:', JSON.stringify(res.result.exceptionDetails))
      }
      return res.result?.result?.value
    }

    await send('Page.enable')
    await send('DOM.enable')

    // Set viewport 1440x900
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    })

    await sleep(1500)

    // Handle login
    await evaluate(`
      (async () => {
        const fillBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Quick Fill') || b.className.includes('quick-fill'));
        if (fillBtn) {
          fillBtn.click();
          await new Promise(r => setTimeout(r, 200));
          const submitBtn = document.querySelector('button[type="submit"]');
          if (submitBtn) submitBtn.click();
        }
      })()
    `)
    await sleep(2500)

    // Ensure we are in Classic mode
    await evaluate(`
      (() => {
        // If in V2 mode, toggle to Classic
        const toggleBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Classic View'));
        if (toggleBtn) toggleBtn.click();
      })()
    `)
    await sleep(1000)

    // Capture screenshot
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    const shotPath = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/emergency_classic_current.png'
    fs.writeFileSync(shotPath, Buffer.from(shot.result.data, 'base64'))
    console.log('Saved screenshot to:', shotPath)

    // Inspect layout metrics
    const metrics = await evaluate(`
      (() => {
        function getElMetrics(sel) {
          const el = document.querySelector(sel);
          if (!el) return { found: false, sel };
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return {
            found: true,
            sel,
            tagName: el.tagName,
            className: el.className,
            rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height), top: Math.round(r.top), left: Math.round(r.left) },
            display: cs.display,
            flexDirection: cs.flexDirection,
            position: cs.position,
            width: cs.width,
            height: cs.height,
            overflow: cs.overflow,
            overflowY: cs.overflowY,
            marginLeft: cs.marginLeft,
          };
        }

        return {
          isV2: document.querySelector('.theme-aurora') !== null,
          appShell: getElMetrics('.app-shell'),
          sidebar: getElMetrics('.icon-sidebar'),
          sidebarHeader: getElMetrics('.sidebar-header'),
          brandBadge: getElMetrics('.brand-badge'),
          nav: getElMetrics('.sidebar-nav') || getElMetrics('.nav-list') || getElMetrics('nav'),
          navItems: Array.from(document.querySelectorAll('.nav-btn, .sidebar-nav-item, .nav-item, nav button, nav a')).map(b => {
            const r = b.getBoundingClientRect();
            return { text: b.textContent.trim().slice(0, 15), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
          }),
          messageBanner: getElMetrics('.shinpo-message-banner') || getElMetrics('.sidebar-quote') || getElMetrics('[class*="message"]'),
          appMain: getElMetrics('.app-main'),
          topbar: getElMetrics('.cockpit-top-bar'),
          workspace: getElMetrics('.app-workspace-content'),
        };
      })()
    `)

    console.log('LAYOUT EVALUATION:');
    console.log(JSON.stringify(metrics, null, 2))

    ws.close()
  } finally {
    chrome.kill()
  }
}

inspectLayout().catch(console.error)
