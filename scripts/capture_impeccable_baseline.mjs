import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const OUT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/impeccable_audit'
fs.mkdirSync(OUT_DIR, { recursive: true })

async function runAudit() {
  console.log('--- Starting Impeccable Baseline Audit ---')
  const chromePort = 9260
  const chrome = spawn('google-chrome', [
    '--headless=new',
    `--remote-debugging-port=${chromePort}`,
    '--no-sandbox',
    '--disable-gpu',
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
        const page = list.find((it) => it.type === 'page')
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
      if (res.result && res.result.exceptionDetails) {
        console.error('Eval error:', JSON.stringify(res.result.exceptionDetails))
      }
      return res.result?.result?.value
    }

    async function setViewport(width, height) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false,
      })
      await send('Emulation.setVisibleSize', { width, height })
      await sleep(250)
    }

    async function captureScreenshot(filename) {
      const res = await send('Page.captureScreenshot', { format: 'png' })
      const filePath = path.join(OUT_DIR, filename)
      fs.writeFileSync(filePath, Buffer.from(res.result.data, 'base64'))
      console.log(`[Screenshot Saved] ${filename}`)
    }

    await send('Page.enable')
    await send('DOM.enable')
    await send('Runtime.enable')

    await setViewport(1440, 900)
    await sleep(1500)

    // Log in if needed
    console.log('[Setup] Logging in...')
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
    await sleep(2000)

    // Helper functions
    async function selectTab(tabLabel) {
      await evaluate(`
        (() => {
          const btn = Array.from(document.querySelectorAll('.sidebar-btn')).find(b => {
            const title = b.getAttribute('title') || '';
            const text = b.textContent || '';
            return title.includes('${tabLabel}') || text.includes('${tabLabel}');
          });
          if (btn) btn.click();
        })()
      `)
      await sleep(600)
    }

    async function setTheme(isDark) {
      await evaluate(`
        (() => {
          const targetLight = ${!isDark};
          const currentLight = document.documentElement.getAttribute('data-theme') === 'light' || document.body.classList.contains('theme-light');
          if (currentLight !== targetLight) {
            const themeBtn = document.querySelector('.action-btn-circle[title*="Mode"]') ||
                             document.querySelector('button[title*="Mode"]') ||
                             document.querySelector('.topbar-control-btn[title*="Theme"]');
            if (themeBtn) {
              themeBtn.click();
            } else {
              document.documentElement.setAttribute('data-theme', targetLight ? 'light' : 'dark');
              if (targetLight) {
                document.body.classList.add('theme-light');
                const appShell = document.querySelector('.app-shell');
                if (appShell) appShell.classList.add('theme-light');
              } else {
                document.body.classList.remove('theme-light');
                const appShell = document.querySelector('.app-shell');
                if (appShell) appShell.classList.remove('theme-light');
              }
            }
          }
        })()
      `)
      await sleep(400)
    }

    async function setDesignMode(mode) {
      // mode: 'classic' or 'aurora'
      await evaluate(`
        (() => {
          const isAurora = ${mode === 'aurora'};
          const currentAurora = document.querySelector('.app-shell')?.classList.contains('theme-aurora') || false;
          if (isAurora !== currentAurora) {
            const toggleBtn = Array.from(document.querySelectorAll('button')).find(b => 
              b.textContent.includes('Aurora') || b.textContent.includes('Classic')
            );
            if (toggleBtn) toggleBtn.click();
          }
        })()
      `)
      await sleep(600)
    }

    const tabs = [
      { name: 'Dashboard', label: 'Dashboard' },
      { name: 'Focus', label: 'Focus' },
      { name: 'Goals', label: 'Goals' },
      { name: 'Schedule', label: 'Schedule' },
      { name: 'TaskManager', label: 'Task' },
      { name: 'Eonpai', label: 'AI' },
      { name: 'Analytics', label: 'Analytics' }
    ]

    console.log('\n--- Capturing Classic Dark Views ---')
    await setDesignMode('classic')
    await setTheme(true)
    for (const t of tabs) {
      await selectTab(t.label)
      await captureScreenshot(`Classic_Dark_${t.name}.png`)
    }

    console.log('\n--- Capturing Classic Light Views ---')
    await setTheme(false)
    for (const t of tabs) {
      await selectTab(t.label)
      await captureScreenshot(`Classic_Light_${t.name}.png`)
    }

    console.log('\n--- Capturing Aurora Dark Dashboard & AI ---')
    await setDesignMode('aurora')
    await setTheme(true)
    await selectTab('Dashboard')
    await captureScreenshot(`Aurora_Dark_Dashboard.png`)
    await selectTab('AI')
    await captureScreenshot(`Aurora_Dark_Eonpai.png`)

    console.log('\n--- Capturing Aurora Light Dashboard & AI ---')
    await setTheme(false)
    await selectTab('Dashboard')
    await captureScreenshot(`Aurora_Light_Dashboard.png`)
    await selectTab('AI')
    await captureScreenshot(`Aurora_Light_Eonpai.png`)

    // Audit UX copy across DOM
    const copyAudit = await evaluate(`
      (() => {
        const textNodes = [];
        const walk = (node) => {
          if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim().length > 0) {
            textNodes.push(node.nodeValue.trim());
          } else {
            for (let child of node.childNodes) walk(child);
          }
        };
        walk(document.body);
        
        // Scan for buzzwords / robot slop
        const forbiddenPatterns = [
          'SYSTEM: ARISE', 'Daily Spark', 'Productivity Velocity', 'Tasks Execution Board',
          'Synergy', 'Hyper-focus protocol', 'Neural matrix', 'Cognitive velocity'
        ];
        const foundBanned = [];
        textNodes.forEach(t => {
          forbiddenPatterns.forEach(p => {
            if (t.toLowerCase().includes(p.toLowerCase())) {
              foundBanned.push({ pattern: p, text: t });
            }
          });
        });
        return { foundBanned, totalNodes: textNodes.length };
      })()
    `)
    console.log('\n[Copy Audit Result]:', JSON.stringify(copyAudit))

    ws.close()
  } finally {
    chrome.kill()
  }
}

runAudit().catch(err => {
  console.error('Audit error:', err)
  process.exit(1)
})

