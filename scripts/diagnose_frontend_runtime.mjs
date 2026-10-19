import { spawn } from 'child_process'
import fs from 'fs'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function testFullNavigation() {
  // First obtain valid auth session from backend
  const loginRes = await fetch('http://127.0.0.1:8080/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernameOrEmail: 'EONX', password: 'shinpo_dev' }),
  })
  if (!loginRes.ok) throw new Error(`Backend login failed: ${await loginRes.text()}`)
  const authData = await loginRes.json()
  console.log('✓ Successfully authenticated with backend as user:', authData.user.username)

  const chrome = spawn('google-chrome', [
    '--headless=new',
    '--remote-debugging-port=9288',
    '--no-sandbox',
    '--disable-gpu',
    'about:blank',
  ])

  try {
    let wsUrl = null
    for (let i = 0; i < 30; i++) {
      await sleep(200)
      try {
        const ver = await fetch('http://127.0.0.1:9288/json/version').then((r) => r.json())
        if (ver.webSocketDebuggerUrl) {
          wsUrl = ver.webSocketDebuggerUrl
          break
        }
      } catch {}
    }

    if (!wsUrl) throw new Error('Could not connect to Chrome port 9288')

    const ws = new WebSocket(wsUrl)
    let id = 1
    const pending = new Map()
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg)
        pending.delete(msg.id)
      }
    })
    await new Promise((res) => ws.addEventListener('open', res))

    const send = (method, params = {}) => {
      const msgId = id++
      return new Promise((resolve) => {
        pending.set(msgId, resolve)
        ws.send(JSON.stringify({ id: msgId, method, params }))
      })
    }

    const targetRes = await send('Target.createTarget', { url: 'about:blank' })
    const targetId = targetRes.result.targetId
    const pageWs = new WebSocket(`ws://127.0.0.1:9288/devtools/page/${targetId}`)
    await new Promise((res) => pageWs.addEventListener('open', res))

    const consoleLogs = []
    const pageErrors = []

    let pid = 1
    const pagePending = new Map()
    pageWs.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id && pagePending.has(msg.id)) {
        pagePending.get(msg.id)(msg)
        pagePending.delete(msg.id)
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        consoleLogs.push({ type: msg.params.type, text: msg.params.args.map((a) => a.value || a.description).join(' ') })
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        pageErrors.push(msg.params.exceptionDetails)
      }
    })

    const pageSend = (method, params = {}) => {
      const msgId = pid++
      return new Promise((resolve) => {
        pagePending.set(msgId, resolve)
        pageWs.send(JSON.stringify({ id: msgId, method, params }))
      })
    }

    const evaluate = async (expression) => {
      const res = await pageSend('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      })
      if (res.result?.exceptionDetails) {
        throw new Error(`Eval exception: ${JSON.stringify(res.result.exceptionDetails)}`)
      }
      return res.result?.result?.value
    }

    await pageSend('Page.enable')
    await pageSend('Runtime.enable')

    // Navigate to set localStorage
    await pageSend('Page.navigate', { url: 'http://127.0.0.1:5173/' })
    await sleep(1500)

    console.log('Seeding authenticated session in localStorage...')
    await evaluate(`
      localStorage.setItem('shinpo_access_token', ${JSON.stringify(authData.accessToken)});
      localStorage.setItem('shinpo_refresh_token', ${JSON.stringify(authData.refreshToken)});
      localStorage.setItem('shinpo_auth_user', JSON.stringify(${JSON.stringify(authData.user)}));
    `)

    // Reload page with authenticated session
    console.log('Reloading page with active session...')
    await pageSend('Page.reload')
    await sleep(3500)

    // Check if main app shell rendered
    const shellEval = await evaluate(`
      (() => {
        const main = document.querySelector('main') || document.querySelector('.shinpo-shell') || document.querySelector('.app-shell');
        const activeNav = document.querySelector('.sidebar-btn.active')?.getAttribute('title');
        const navItems = Array.from(document.querySelectorAll('.sidebar-btn')).map(n => n.getAttribute('title'));
        return {
          hasMain: Boolean(main),
          activeNav,
          navItems,
          rootText: document.getElementById('root')?.innerText?.slice(0, 300),
        };
      })()
    `)
    console.log('App shell state after authenticated load:', shellEval)

    // Capture screenshot of authenticated overview
    const shot1 = await pageSend('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync('/tmp/shinpo_authenticated_overview.png', Buffer.from(shot1.result.data, 'base64'))
    console.log('Saved /tmp/shinpo_authenticated_overview.png')

    // Navigate to each view
    const views = ['Goals', 'Focus', 'Calendar', 'Analytics', 'Task Manager', 'EONPAI']
    for (const viewName of views) {
      console.log(`Navigating to view: ${viewName}...`)
      await evaluate(`
        (() => {
          const btn = Array.from(document.querySelectorAll('.sidebar-btn')).find(b => {
            const t = (b.getAttribute('title') || b.textContent || '').toLowerCase();
            return t.includes('${viewName.toLowerCase()}');
          });
          if (btn) btn.click();
        })()
      `)
      await sleep(1500)
      const viewState = await evaluate(`
        ({
          title: document.title,
          activeTab: document.querySelector('.sidebar-btn.active')?.getAttribute('title'),
          heading: document.querySelector('h1, h2, .view-title, .header-title')?.textContent?.trim(),
          textSnippet: (document.querySelector('main') || document.body)?.innerText?.slice(0, 150) || '',
        })
      `)
      console.log(`  ✓ View ${viewName} rendered:`, viewState)

      const viewShot = await pageSend('Page.captureScreenshot', { format: 'png' })
      fs.writeFileSync(`/tmp/shinpo_view_${viewName.toLowerCase().replace(/\\s+/g, '_')}.png`, Buffer.from(viewShot.result.data, 'base64'))
    }

    console.log('--- Page Exceptions Total (' + pageErrors.length + ') ---')
    if (pageErrors.length > 0) {
      console.log(JSON.stringify(pageErrors, null, 2))
    }

    console.log('--- Console Errors (' + consoleLogs.filter(l => l.type === 'error').length + ') ---')
    const errorsOnly = consoleLogs.filter((l) => l.type === 'error')
    if (errorsOnly.length > 0) {
      console.log(JSON.stringify(errorsOnly, null, 2))
    }

    pageWs.close()
    ws.close()
  } finally {
    chrome.kill('SIGTERM')
  }
}

testFullNavigation().catch((err) => {
  console.error(err)
  process.exit(1)
})

