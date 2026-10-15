#!/usr/bin/env node
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const beforeDir = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/d1/before'
fs.mkdirSync(beforeDir, { recursive: true })

async function captureBaseline() {
  console.log('Capturing D1 Before screenshots for Dashboard...')

  const chrome = spawn('google-chrome', [
    '--headless=new',
    '--remote-debugging-port=9222',
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
        const res = await fetch('http://127.0.0.1:9222/json/list')
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

    async function captureScreenshot(filePath, width = 1440, height = 900) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false,
      })
      await sleep(500)
      const shot = await send('Page.captureScreenshot', { format: 'png' })
      const data = shot.result?.data || shot.data
      fs.writeFileSync(filePath, Buffer.from(data, 'base64'))
      console.log(`Saved screenshot: ${filePath}`)
    }

    // Login as user_s1_8606
    console.log('Logging in as user_s1_8606...')
    const loginResult = await evalCode(`
      (async () => {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            usernameOrEmail: "user_s1_8606",
            password: "Password123!"
          })
        });
        if (!res.ok) return { ok: false };
        const data = await res.json();
        localStorage.setItem("shinpo_access_token", data.accessToken);
        localStorage.setItem("shinpo_refresh_token", data.refreshToken);
        localStorage.setItem("shinpo_current_user", JSON.stringify(data.user));
        return { ok: true, user: data.user, token: data.accessToken };
      })()
    `)
    console.log('Login result:', loginResult?.ok)

    if (loginResult?.token) {
      // Create a scheduled session for today if none exists
      await evalCode(`
        (async () => {
          const token = localStorage.getItem("shinpo_access_token");
          const res = await fetch("/api/focus-sessions", {
            headers: { "Authorization": "Bearer " + token }
          });
          const sessions = await res.json();
          const hasScheduled = sessions.some(s => s.status === 'SCHEDULED');
          if (!hasScheduled) {
            const now = new Date();
            now.setHours(now.getHours() + 2);
            await fetch("/api/focus-sessions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
              },
              body: JSON.stringify({
                name: "Deep Architecture Review",
                intention: "Review core system performance and bottlenecks",
                durationMinutes: 45,
                scheduledAt: now.toISOString()
              })
            });
          }
        })()
      `)
    }

    // Reload page to load Dashboard
    console.log('Reloading page...')
    await send('Page.reload')
    await sleep(2500)

    // Ensure we are on Dashboard
    await evalCode(`
      (() => {
        const btn = document.querySelector('[data-tutorial="nav-dashboard"]') ||
                    Array.from(document.querySelectorAll(".sidebar-btn")).find(el => el.textContent.includes("Dashboard"));
        if (btn) btn.click();
      })()
    `)
    await sleep(1500)

    // Capture Dark Theme
    console.log('Setting Dark theme and capturing...')
    await evalCode(`
      (() => {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.classList.remove('theme-light');
        document.body.classList.add('theme-dark');
      })()
    `)
    await sleep(500)
    await captureScreenshot(path.join(beforeDir, 'dashboard_1440x900_dark.png'), 1440, 900)

    // Capture Light Theme
    console.log('Setting Light theme and capturing...')
    await evalCode(`
      (() => {
        document.documentElement.setAttribute('data-theme', 'light');
        document.body.classList.remove('theme-dark');
        document.body.classList.add('theme-light');
      })()
    `)
    await sleep(500)
    await captureScreenshot(path.join(beforeDir, 'dashboard_1440x900_light.png'), 1440, 900)

    ws.close()
  } catch (err) {
    console.error('Error capturing baseline:', err)
  } finally {
    chrome.kill()
  }
}

captureBaseline()

