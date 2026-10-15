import { spawn } from 'child_process'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function inspect() {
  const chromePort = 9229
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
        const msgId = id++
        pending.set(msgId, resolve)
        ws.send(JSON.stringify({ id: msgId, method, params }))
      })
    }

    await send('Page.enable')
    await send('Runtime.enable')

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      })
      if (res.result && res.result.exceptionDetails) {
        console.error('Eval error:', res.result.exceptionDetails)
      }
      return res.result?.result?.value
    }

    await sleep(2000)

    // Handle login if present
    await evaluate(`
      (async () => {
        const fillBtn = document.querySelector('button.auth-quick-fill-btn');
        if (fillBtn) {
          fillBtn.click();
          await new Promise(r => setTimeout(r, 200));
          const submitBtn = document.querySelector('button[type="submit"]');
          if (submitBtn) submitBtn.click();
        }
      })()
    `)
    await sleep(2000)

    // Check if in V2 or Classic
    const initialMode = await evaluate(`!!document.querySelector('.aurora-viewport') ? 'V2' : 'Classic'`)
    console.log('Initial Mode:', initialMode)

    async function getScrollDiagnostics(name) {
      return await evaluate(`
        (() => {
          const docScrollHeight = document.scrollingElement.scrollHeight;
          const docClientHeight = document.scrollingElement.clientHeight;
          const docScrollTop = document.scrollingElement.scrollTop;

          const sidebar = document.querySelector('aside');
          const sidebarRect = sidebar ? sidebar.getBoundingClientRect() : null;
          const sidebarComputed = sidebar ? window.getComputedStyle(sidebar) : null;

          const topbar = document.querySelector('header');
          const topbarRect = topbar ? topbar.getBoundingClientRect() : null;
          const topbarComputed = topbar ? window.getComputedStyle(topbar) : null;

          const main = document.querySelector('main');
          const mainRect = main ? main.getBoundingClientRect() : null;
          const mainComputed = main ? window.getComputedStyle(main) : null;

          const appShell = document.querySelector('.app-shell, .aurora-viewport');
          const appShellComputed = appShell ? window.getComputedStyle(appShell) : null;

          // Find all elements with scrollable overflow
          const allEls = Array.from(document.querySelectorAll('*'));
          const scrollables = allEls.filter(el => {
            const cs = window.getComputedStyle(el);
            const hasOverflow = ['auto', 'scroll'].includes(cs.overflowY);
            return hasOverflow && el.scrollHeight > el.clientHeight;
          }).map(el => ({
            tag: el.tagName,
            className: el.className,
            scrollHeight: el.scrollHeight,
            clientHeight: el.clientHeight,
            scrollTop: el.scrollTop
          }));

          return {
            window: { innerWidth: window.innerWidth, innerHeight: window.innerHeight },
            document: { docScrollHeight, docClientHeight, docScrollTop },
            sidebar: {
              rect: sidebarRect ? { top: sidebarRect.top, bottom: sidebarRect.bottom, height: sidebarRect.height } : null,
              position: sidebarComputed ? sidebarComputed.position : null,
              overflowY: sidebarComputed ? sidebarComputed.overflowY : null,
              height: sidebarComputed ? sidebarComputed.height : null,
            },
            topbar: {
              rect: topbarRect ? { top: topbarRect.top, bottom: topbarRect.bottom, height: topbarRect.height } : null,
              position: topbarComputed ? topbarComputed.position : null,
            },
            main: {
              rect: mainRect ? { top: mainRect.top, bottom: mainRect.bottom, height: mainRect.height } : null,
              overflowY: mainComputed ? mainComputed.overflowY : null,
              height: mainComputed ? mainComputed.height : null,
            },
            scrollables
          };
        })()
      `)
    }

    // Switch to Classic first to test Classic baseline
    await evaluate(`
      const toggle = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Classic View'));
      if (toggle) toggle.click();
    `)
    await sleep(1500)

    const classicMode = await evaluate(`!!document.querySelector('.aurora-viewport') ? 'V2' : 'Classic'`)
    console.log('Mode 1:', classicMode)

    let classicBefore = await getScrollDiagnostics()
    console.log('\n--- CLASSIC BEFORE SCROLL ---')
    console.log(JSON.stringify(classicBefore, null, 2))

    console.log('\n--- CLASSIC SCROLLING (window.scrollTo(0, 10000)) ---')
    await evaluate(`window.scrollTo(0, 10000)`)
    await sleep(500)

    let classicAfter = await getScrollDiagnostics()
    console.log('Classic scrollTop after scrollTo(10000):', classicAfter.document.docScrollTop)
    console.log('Classic Sidebar top after scroll:', classicAfter.sidebar?.rect?.top)
    console.log('Classic Topbar top after scroll:', classicAfter.topbar?.rect?.top)

    // Scroll back to top
    await evaluate(`window.scrollTo(0, 0)`)
    await sleep(500)

    // Switch to V2
    console.log('\n--- SWITCHING TO V2 ---')
    await evaluate(`
      const toggleV2 = document.querySelector('button.v2-preview-btn');
      if (toggleV2) toggleV2.click();
    `)
    await sleep(1500)

    const v2Mode = await evaluate(`!!document.querySelector('.aurora-viewport') ? 'V2' : 'Classic'`)
    console.log('Mode 2:', v2Mode)

    let v2Before = await getScrollDiagnostics()
    console.log('\n--- V2 BEFORE SCROLL ---')
    console.log(JSON.stringify(v2Before, null, 2))

    console.log('\n--- V2 SCROLLING (window.scrollTo(0, 10000)) ---')
    await evaluate(`window.scrollTo(0, 10000)`)
    await sleep(500)

    let v2After = await getScrollDiagnostics()
    console.log('V2 scrollTop after scrollTo(10000):', v2After.document.docScrollTop)
    console.log('V2 Sidebar top after scroll:', v2After.sidebar?.rect?.top)
    console.log('V2 Topbar top after scroll:', v2After.topbar?.rect?.top)


    ws.close()
  } finally {
    chrome.kill()
  }
}

inspect().catch(console.error)
