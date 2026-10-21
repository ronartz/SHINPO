import { spawn } from 'child_process'
import fs from 'fs'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function testStudyResources() {
  console.log('Testing Study Resources Add...')
  const chromePort = 9333
  const chrome = spawn('google-chrome', [
    '--headless=new',
    `--remote-debugging-port=${chromePort}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-extensions',
    `--user-data-dir=/tmp/chrome-sr-${Date.now()}`,
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

    const ws = new WebSocket(wsUrl)
    await new Promise((resolve) => ws.addEventListener('open', resolve))

    let msgId = 1
    const pending = new Map()
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg)
        pending.delete(msg.id)
      }
    })

    function send(method, params = {}) {
      const id = msgId++
      return new Promise((resolve) => {
        pending.set(id, resolve)
        ws.send(JSON.stringify({ id, method, params }))
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

    await send('Page.enable')
    await send('DOM.enable')
    await send('Network.enable')
    await send('Console.enable')

    ws.addEventListener('message', (event) => {
      const data = JSON.parse(event.data)
      if (data.method === 'Console.messageAdded' || data.method === 'Runtime.consoleAPICalled') {
        console.log('[BROWSER LOG]', JSON.stringify(data.params))
      }
      if (data.method === 'Network.responseReceived') {
        const url = data.params.response.url
        if (url.includes('contextual-focus')) {
          console.log('[NETWORK RESPONSE]', data.params.response.status, url)
        }
      }
    })

    // Authenticate as EONX
    const loginRes = await fetch('http://localhost:8080/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail: 'EONX', password: 'shinpo_dev' }),
    })
    const loginData = await loginRes.json()

    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        localStorage.setItem('shinpo_access_token', ${JSON.stringify(loginData.accessToken)});
        localStorage.setItem('shinpo_refresh_token', ${JSON.stringify(loginData.refreshToken)});
        localStorage.setItem('shinpo_auth_user', ${JSON.stringify(JSON.stringify(loginData.user))});
      `,
    })

    await send('Page.navigate', { url: 'http://localhost:5173/' })
    await sleep(3000)

    // Navigate to Goals tab
    console.log('Navigating to Goals tab...')
    await evaluate(`
      (() => {
        const goalsBtn = document.querySelector('[data-tutorial="nav-goals"]') || Array.from(document.querySelectorAll('button')).find(b => (b.innerText || b.getAttribute('title') || '').includes('Goals'));
        if (goalsBtn) goalsBtn.click();
      })()
    `)
    await sleep(2000)

    // Find and click "Resources" button on the first task
    console.log('Opening Study Resources dialog...')
    const opened = await evaluate(`
      (() => {
        const resBtn = document.querySelector('.card-resource-btn, .task-row-resource-btn');
        if (resBtn) {
          resBtn.click();
          return true;
        }
        return false;
      })()
    `)
    console.log('Resources button clicked:', opened)
    await sleep(1000)

    // Check if dialog opened
    const dialogOpened = await evaluate(`Boolean(document.querySelector('.study-resources-dialog-card'))`)
    console.log('Dialog opened:', dialogOpened)

    // Click "Add resource" button
    console.log('Clicking "Add resource" button...')
    const addBtnClicked = await evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('Add resource'));
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      })()
    `)
    console.log('Add resource button clicked:', addBtnClicked)
    await sleep(1000)

    // Inspect the form
    const formVisible = await evaluate(`Boolean(document.querySelector('.study-resource-form'))`)
    console.log('Form visible:', formVisible)

    // Fill in destination with bare domain without https:// to test auto-normalization
    const uniqueUrl = `docs.spring.io/security-guide-${Date.now()}`
    console.log('Filling form fields with bare domain:', uniqueUrl)
    await evaluate(`
      (() => {
        const inputs = document.querySelectorAll('.study-resource-form input');
        const destInput = document.querySelector('.study-destination-field input') || inputs[inputs.length - 1];
        if (destInput) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(destInput, ${JSON.stringify(uniqueUrl)});
          destInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `)
    await sleep(500)

    // Click "Save rule" submit button
    console.log('Submitting form with "Save rule"...')
    const submitted = await evaluate(`
      (() => {
        const saveBtn = Array.from(document.querySelectorAll('.study-resource-form button')).find(b => b.innerText && b.innerText.includes('Save rule'));
        if (saveBtn) {
          saveBtn.click();
          return true;
        }
        return false;
      })()
    `)
    console.log('Save rule clicked:', submitted)
    await sleep(2000)

    // Check if form closed or if error appeared
    const resultState = await evaluate(`
      (() => {
        return {
          formStillVisible: Boolean(document.querySelector('.study-resource-form')),
          formError: document.querySelector('.shinpo-field-error')?.innerText,
          panelError: document.querySelector('.study-resource-error')?.innerText,
          resourcesCount: document.querySelectorAll('.study-resource-row').length,
          resourceTexts: Array.from(document.querySelectorAll('.study-resource-row')).map(r => r.innerText.slice(0, 50)),
        };
      })()
    `)
    console.log('Result state:', JSON.stringify(resultState, null, 2))
  } finally {
    chrome.kill('SIGTERM')
  }
}

testStudyResources().catch(console.error)
