import { spawn } from 'child_process'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function checkRules() {
  const chromePort = 9242
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

    await send('Page.enable')
    await send('DOM.enable')
    await send('CSS.enable')

    await sleep(2000)

    // Log in
    await send('Runtime.evaluate', {
      expression: `
        (async () => {
          const fillBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Quick Fill') || b.className.includes('quick-fill'));
          if (fillBtn) {
            fillBtn.click();
            await new Promise(r => setTimeout(r, 200));
            const submitBtn = document.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.click();
          }
        })()
      `,
      awaitPromise: true,
    })
    await sleep(2000)

    // Get document and find .icon-sidebar
    const doc = await send('DOM.getDocument')
    const rootNodeId = doc.result.root.nodeId
    const nodeRes = await send('DOM.querySelector', { nodeId: rootNodeId, selector: '.icon-sidebar' })
    const nodeId = nodeRes.result.nodeId

    console.log('Sidebar Node ID:', nodeId)

    const rulesRes = await send('CSS.getMatchedStylesForNode', { nodeId })
    console.log('MATCHED RULES:')
    for (const match of rulesRes.result?.matchedCSSRules || []) {
      console.log('Rule selector:', match.rule.selectorList.text, 'origin:', match.rule.origin)
      for (const prop of match.rule.style.cssProperties) {
        if (['display', 'position', 'width', 'flex-direction', 'background'].includes(prop.name)) {
          console.log(`  ${prop.name}: ${prop.value}`)
        }
      }
    }

    // Check style sheets loaded
    const sheets = await send('Runtime.evaluate', {
      expression: `
        Array.from(document.styleSheets).map(s => ({
          href: s.href,
          rulesCount: s.cssRules ? s.cssRules.length : 0,
          rules: Array.from(s.cssRules || []).slice(0, 5).map(r => r.cssText.slice(0, 60))
        }))
      `,
      returnByValue: true,
    })
    console.log('LOADED STYLESHEETS:', JSON.stringify(sheets.result?.result?.value, null, 2))

    ws.close()
  } finally {
    chrome.kill()
  }
}

checkRules().catch(console.error)
