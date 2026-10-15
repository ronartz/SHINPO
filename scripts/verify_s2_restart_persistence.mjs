import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const SCREENSHOT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/s2'

async function runRestartPersistence() {
  console.log('\n[STEP 12] Restarting Spring Boot backend to verify complete persistence...')
  execSync('./bin/shinpo restart', { stdio: 'inherit' })
  await sleep(1500)

  // Wait for health endpoint
  let up = false
  for (let i = 0; i < 40; i++) {
    await sleep(500)
    try {
      const res = await fetch('http://127.0.0.1:8080/actuator/health')
      if (res.ok) {
        const h = await res.json()
        if (h.status === 'UP') {
          up = true
          break
        }
      }
    } catch {}
  }

  if (!up) throw new Error('Backend failed to return UP after restart')
  console.log('Backend successfully restarted and UP!')

  // 3. Open Chrome and inspect persisted state
  console.log('\n[STEP 13] Confirming completed session and task persist across restart...')
  const chrome = spawn('google-chrome', [
    '--headless=new',
    '--remote-debugging-port=9226',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    'http://localhost:5173/'
  ])

  try {
    let wsUrl = null
    for (let i = 0; i < 30; i++) {
      await sleep(300)
      try {
        const res = await fetch('http://127.0.0.1:9226/json/list')
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

    async function evalCode(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      })
      if (res.result?.exceptionDetails) {
        throw new Error(`Eval error: ${JSON.stringify(res.result.exceptionDetails)}`)
      }
      return res.result?.result?.value
    }

    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    })

    // Log in the test user in browser
    await evalCode(`
      (async () => {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            usernameOrEmail: "user_s2_8168",
            password: "Password123!"
          })
        });
        const data = await res.json();
        localStorage.setItem("shinpo_access_token", data.accessToken);
        localStorage.setItem("shinpo_current_user", JSON.stringify(data.user));
      })()
    `)

    await send('Page.reload')
    await sleep(2500)

    // Navigate to Schedule and check completed session
    await evalCode(`
      (() => {
        const btn = document.querySelector('[data-tutorial="nav-schedule"]') ||
                    Array.from(document.querySelectorAll(".sidebar-btn")).find(el => el.textContent.includes("Calendar") || el.textContent.includes("Schedule"));
        if (btn) btn.click();
      })()
    `)
    await sleep(2000)

    const res = await send('Page.captureScreenshot', { format: 'png', quality: 90 })
    const filePath = path.join(SCREENSHOT_DIR, '08_Post_Restart_Persistence_Verified.png')
    fs.writeFileSync(filePath, Buffer.from(res.result.data, 'base64'))
    console.log(`Saved screenshot: ${filePath}`)

    // Query backend to confirm DB persistence
    const dbVerification = await evalCode(`
      (async () => {
        const token = localStorage.getItem("shinpo_access_token");
        const sRes = await fetch("/api/focus-sessions", { headers: { "Authorization": "Bearer " + token } });
        const sessions = await sRes.json();
        const mRes = await fetch("/api/missions", { headers: { "Authorization": "Bearer " + token } });
        const missions = await mRes.json();

        return {
          sessionCount: sessions.length,
          completedSessions: sessions.filter(s => s.status === 'COMPLETED').map(s => ({
            id: s.id,
            name: s.name,
            status: s.status,
            quality: s.completionQuality,
            duration: s.durationMinutes,
            missionId: s.missionId
          })),
          completedMissions: missions.filter(m => m.status === 'COMPLETED').map(m => ({
            id: m.id,
            title: m.title,
            status: m.status
          }))
        };
      })()
    `)

    console.log('Post-Restart Database Verification:', JSON.stringify(dbVerification, null, 2))
    ws.close()
  } finally {
    chrome.kill()
  }
}

runRestartPersistence().catch((e) => {
  console.error('Restart persistence error:', e)
  process.exit(1)
})
