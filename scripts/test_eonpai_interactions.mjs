import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const OUT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/slice_7_2'

async function runInteractionTest() {
  console.log('--- Testing EONPAI Interactive Workflows ---')
  const chromePort = 9278
  const chrome = spawn('google-chrome', [
    '--headless=new',
    `--remote-debugging-port=${chromePort}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-extensions',
    `--user-data-dir=/tmp/chrome-test-${Date.now()}`,
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

    // Set 1920x1080 viewport
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false,
    })

    // Log in
    console.log('[Auth] Logging in...')
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

    // Navigate to EONPAI
    console.log('[Nav] Opening EONPAI view...')
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

    // Verify textarea Enter vs Shift+Enter behavior
    console.log('[Composer] Testing Shift+Enter vs Enter...')
    const shiftEnterResult = await evaluate(`
      (() => {
        const textarea = document.querySelector('.eonpai-composer-input');
        if (!textarea) return { error: 'Textarea not found' };
        textarea.value = 'First line';
        textarea.dispatchEvent(new Event('input', { bubbles: true }));

        // Dispatch Shift+Enter
        const shiftEnterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          shiftKey: true,
          bubbles: true,
          cancelable: true
        });
        const notCancelled = textarea.dispatchEvent(shiftEnterEvent);
        return {
          shiftEnterNotCancelled: notCancelled,
          currentValue: textarea.value
        };
      })()
    `)
    console.log('Shift+Enter result:', shiftEnterResult)

    // Test Quick Action: "Plan my day"
    console.log('[Actions] Triggering Quick Action: Plan my day...')
    await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('.eonpai-command-row'));
        const planBtn = buttons.find(b => b.textContent.includes('Plan my day'));
        if (planBtn) {
          planBtn.click();
          return true;
        }
        return false;
      })()
    `)
    await sleep(2000)

    // Check if new message or plan was rendered
    const chatStats = await evaluate(`
      (() => {
        const messages = document.querySelectorAll('.eonpai-chat-bubble, .ai-chat-bubble');
        const planCards = document.querySelectorAll('.eonpai-plan-card');
        const actionCards = document.querySelectorAll('.eonpai-action-card, .ai-action-card');
        return {
          messageCount: messages.length,
          planCount: planCards.length,
          actionCount: actionCards.length
        };
      })()
    `)
    console.log('Chat stats after Quick Action:', chatStats)

    // Toggle to Light Mode
    console.log('[Theme] Toggling to Light Mode...')
    await evaluate(`
      (() => {
        const themeBtn = document.querySelector('button[title="Switch to Light Mode"]');
        if (themeBtn) {
          themeBtn.click();
          return true;
        }
        return false;
      })()
    `)
    await sleep(1000)

    const lightShot = await send('Page.captureScreenshot', { format: 'png' })
    const lightFilePath = path.join(OUT_DIR, 'eonpai_light_1920x1080.png')
    fs.writeFileSync(lightFilePath, Buffer.from(lightShot.result.data, 'base64'))
    console.log(`Saved screenshot: ${lightFilePath}`)

    ws.close()
  } finally {
    chrome.kill()
  }
}

runInteractionTest().catch(console.error)
