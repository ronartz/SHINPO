import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const OUT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/slice_7_2'
fs.mkdirSync(OUT_DIR, { recursive: true })

const viewports = [
  { width: 1920, height: 1080, name: '1920x1080' },
  { width: 1440, height: 900, name: '1440x900' },
  { width: 1280, height: 800, name: '1280x800' },
  { width: 1000, height: 768, name: '1000x768' },
]

async function runCapture() {
  console.log('--- Inspecting EONPAI View at 4 Viewports ---')
  const chromePort = 9277
  const chrome = spawn('google-chrome', [
    '--headless=new',
    `--remote-debugging-port=${chromePort}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-extensions',
    `--user-data-dir=/tmp/chrome-profile-${Date.now()}`,
    '--disable-dev-shm-usage',
    'http://localhost:5173/',
  ])

  try {
    let wsUrl = null
    for (let i = 0; i < 40; i++) {
      await sleep(250)
      try {
        const res = await fetch(`http://127.0.0.1:${chromePort}/json/list`)
        const list = await res.json()
        const page = list.find((it) => it.type === 'page' && it.url && it.url.includes('localhost:5173'))
        if (page && page.webSocketDebuggerUrl) {
          wsUrl = page.webSocketDebuggerUrl
          break
        }
      } catch {}
    }

    if (!wsUrl) throw new Error('Could not connect to Chrome debugging port')

    const ws = new WebSocket(wsUrl)
    await new Promise((resolve) => ws.addEventListener('open', resolve))

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
      return new Promise((resolve) => {
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
      if (res.result?.exceptionDetails) {
        console.error('Eval error:', res.result.exceptionDetails)
      }
      return res.result?.result?.value
    }

    await send('Page.enable')
    await send('DOM.enable')

    // Log in via API
    console.log('[Setup] Logging in via auth API...')
    await evaluate(`
      (async () => {
        let res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ usernameOrEmail: "EONX", password: "shinpo_dev" })
        });
        if (res.ok) {
          const data = await res.json();
          localStorage.setItem("shinpo_access_token", data.accessToken);
          localStorage.setItem("shinpo_refresh_token", data.refreshToken);
          localStorage.setItem("shinpo_auth_user", JSON.stringify(data.user));
          location.reload();
        }
      })()
    `)
    await sleep(2500)

    // Select EONPAI tab
    console.log('[Setup] Navigating to EONPAI view...')
    await evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('.sidebar-btn')).find(b => {
          const title = b.getAttribute('title') || '';
          const text = b.textContent || '';
          return title.includes('EONPAI') || text.includes('EONPAI') || title.includes('AI Assistant');
        });
        if (btn) btn.click();
      })()
    `)
    await sleep(1500)

    const results = []

    for (const vp of viewports) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: false,
      })
      await sleep(400)

      // Measure layout metrics
      const metrics = await evaluate(`
        (() => {
          const workspace = document.querySelector('.eonpai-workspace');
          const utility = document.querySelector('.eonpai-utility-panel');
          const convCard = document.querySelector('.eonpai-conversation-card');
          const feed = document.querySelector('.eonpai-chat-feed');
          const content = document.querySelector('.eonpai-chat-content-wrap');
          const composer = document.querySelector('.eonpai-composer');
          const topBar = document.querySelector('.cockpit-top-bar');
          const topBrandTitle = document.querySelector('.top-brand-title');
          const innerTitle = document.querySelector('.eonpai-title, .eonpai-session-title');

          const getBox = el => el ? {
            w: Math.round(el.getBoundingClientRect().width),
            h: Math.round(el.getBoundingClientRect().height),
            top: Math.round(el.getBoundingClientRect().top),
            scrollHeight: el.scrollHeight,
            clientHeight: el.clientHeight,
            overflowY: window.getComputedStyle(el).overflowY,
          } : null;

          return {
            viewport: { w: window.innerWidth, h: window.innerHeight },
            bodyOverflow: window.getComputedStyle(document.body).overflow,
            topBar: getBox(topBar),
            topBrandTitleText: topBrandTitle ? topBrandTitle.innerText : null,
            innerTitleText: innerTitle ? innerTitle.innerText : null,
            workspace: getBox(workspace),
            utility: getBox(utility),
            convCard: getBox(convCard),
            feed: getBox(feed),
            content: getBox(content),
            composer: getBox(composer),
            docScrollHeight: document.documentElement.scrollHeight,
            windowHeight: window.innerHeight,
            hasDocScroll: document.documentElement.scrollHeight > window.innerHeight + 1,
          };
        })()
      `)

      console.log(`Metrics for ${vp.name}:`, JSON.stringify(metrics, null, 2))
      results.push({ viewport: vp.name, metrics })

      // Capture screenshot
      const shot = await send('Page.captureScreenshot', { format: 'png' })
      const filePath = path.join(OUT_DIR, `eonpai_${vp.name}.png`)
      fs.writeFileSync(filePath, Buffer.from(shot.result.data, 'base64'))
      console.log(`Saved screenshot: ${filePath}`)
    }

    fs.writeFileSync(path.join(OUT_DIR, 'metrics.json'), JSON.stringify(results, null, 2))
    ws.close()
  } finally {
    chrome.kill()
  }
}

runCapture().catch(console.error)
