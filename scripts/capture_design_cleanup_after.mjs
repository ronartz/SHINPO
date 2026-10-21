import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const OUT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/design_cleanup/after'
fs.mkdirSync(OUT_DIR, { recursive: true })

async function runCaptureAfter() {
  console.log('Capturing AFTER design refinement screenshots and auditing DOM quality...')
  const chromePort = 9298
  const chrome = spawn('google-chrome', [
    '--headless=new',
    `--remote-debugging-port=${chromePort}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-extensions',
    `--user-data-dir=/tmp/chrome-cleanup-after-${Date.now()}`,
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

    if (!wsUrl) throw new Error('Could not connect to Chrome remote debugging port')

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
      if (res.result?.exceptionDetails) {
        console.error('Evaluation exception:', res.result.exceptionDetails)
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
      await sleep(300)
    }

    async function captureScreenshot(filename) {
      const shot = await send('Page.captureScreenshot', { format: 'png' })
      const filePath = path.join(OUT_DIR, filename)
      fs.writeFileSync(filePath, Buffer.from(shot.result.data, 'base64'))
      console.log(`[Captured AFTER] ${filename}`)
      return filePath
    }

    await send('Page.enable')
    await send('DOM.enable')
    await setViewport(1920, 1080)

    // 1. Authenticate
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

    async function setV2(enabled) {
      await evaluate(`
        (() => {
          const v2Btn = document.querySelector('.v2-preview-btn');
          const isV2 = v2Btn ? v2Btn.textContent.includes('Classic') : false;
          if (isV2 !== ${enabled} && v2Btn) {
            v2Btn.click();
          }
        })()
      `)
      await sleep(600)
    }

    async function setTheme(isLight) {
      await evaluate(`
        (() => {
          const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
          const isCurrentlyLight = currentTheme === 'light';
          if (isCurrentlyLight !== ${isLight}) {
            const btns = Array.from(document.querySelectorAll('.top-bar-actions .action-btn-circle'));
            const themeBtn = btns.find(b => b.title && b.title.includes('Mode'));
            if (themeBtn) themeBtn.click();
          }
        })()
      `)
      await sleep(600)
    }

    async function navigateTo(tabName) {
      await evaluate(`
        (() => {
          const btns = Array.from(document.querySelectorAll('.icon-sidebar .sidebar-btn'));
          const target = btns.find(b => {
            const txt = b.textContent.trim().toLowerCase();
            return txt.includes('${tabName.toLowerCase()}');
          });
          if (target) target.click();
        })()
      `)
      await sleep(800)
    }

    // Capture standard 16 views
    console.log('Capturing standard 16 views in AFTER state...')

    // 1. Dashboard Aurora Dark
    await setV2(true)
    await setTheme(false)
    await navigateTo('dashboard')
    await captureScreenshot('after_01_dashboard_aurora_dark.png')

    // 2. Dashboard Aurora Light
    await setTheme(true)
    await captureScreenshot('after_01_dashboard_aurora_light.png')

    // 3. Dashboard Classic Dark
    await setTheme(false)
    await setV2(false)
    await captureScreenshot('after_01_dashboard_classic_dark.png')

    // 4. Dashboard Classic Light
    await setTheme(true)
    await captureScreenshot('after_01_dashboard_classic_light.png')

    // Return to Aurora V2
    await setV2(true)

    // 5. Goals & Kanban Dark
    await setTheme(false)
    await navigateTo('goals')
    await captureScreenshot('after_02_goals_dark.png')

    // 6. Goals Light
    await setTheme(true)
    await captureScreenshot('after_02_goals_light.png')

    // 7. Focus Engine Dark
    await setTheme(false)
    await navigateTo('focus')
    await captureScreenshot('after_03_focus_dark.png')

    // 8. Focus Engine Light
    await setTheme(true)
    await captureScreenshot('after_03_focus_light.png')

    // 9. Calendar / Schedule Dark
    await setTheme(false)
    await navigateTo('calendar')
    await captureScreenshot('after_04_schedule_dark.png')

    // 10. Calendar Light
    await setTheme(true)
    await captureScreenshot('after_04_schedule_light.png')

    // 11. Analytics Dark
    await setTheme(false)
    await navigateTo('analytics')
    await captureScreenshot('after_05_analytics_dark.png')

    // 12. Analytics Light
    await setTheme(true)
    await captureScreenshot('after_05_analytics_light.png')

    // 13. Task Manager Dark
    await setTheme(false)
    await navigateTo('task')
    await captureScreenshot('after_06_taskmanager_dark.png')

    // 14. Task Manager Light
    await setTheme(true)
    await captureScreenshot('after_06_taskmanager_light.png')

    // 15. EONPAI Dark
    await setTheme(false)
    await navigateTo('eonpai')
    await captureScreenshot('after_07_eonpai_dark.png')

    // 16. EONPAI Light
    await setTheme(true)
    await captureScreenshot('after_07_eonpai_light.png')

    // Multi-viewport responsive tests
    console.log('Testing 4 desktop viewports on Dashboard...')
    await navigateTo('dashboard')
    await setTheme(false)

    const viewports = [
      { w: 1920, h: 1080, name: 'after_viewport_1920x1080.png' },
      { w: 1440, h: 900, name: 'after_viewport_1440x900.png' },
      { w: 1280, h: 800, name: 'after_viewport_1280x800.png' },
      { w: 1000, h: 768, name: 'after_viewport_1000x768.png' },
    ]

    const viewportAuditResults = []

    for (const vp of viewports) {
      await setViewport(vp.w, vp.h)
      await captureScreenshot(vp.name)

      const overflow = await evaluate(`
        (() => {
          const doc = document.documentElement;
          const body = document.body;
          const main = document.querySelector('.app-main') || document.querySelector('main');
          return {
            windowWidth: window.innerWidth,
            docScrollWidth: doc.scrollWidth,
            hasDocHorizontalOverflow: doc.scrollWidth > window.innerWidth,
            bodyScrollWidth: body.scrollWidth,
            hasBodyHorizontalOverflow: body.scrollWidth > window.innerWidth,
            mainScrollWidth: main ? main.scrollWidth : null,
            mainClientWidth: main ? main.clientWidth : null,
          };
        })()
      `)

      viewportAuditResults.push({
        viewport: `${vp.w}x${vp.h}`,
        ...overflow,
      })
    }

    // Reset to 1920x1080 for DOM audits
    await setViewport(1920, 1080)

    console.log('Running quantitative DOM quality audits...')
    const domAudit = await evaluate(`
      (() => {
        // 1. Check card tilts
        const allElements = Array.from(document.querySelectorAll('*'));
        const tiltedElements = [];
        for (const el of allElements) {
          const style = window.getComputedStyle(el);
          const transform = style.transform;
          if (transform && transform !== 'none') {
            // Check if matrix indicates rotation (non-zero sin/cos cross terms)
            const match = transform.match(/matrix\\(([^)]+)\\)/);
            if (match) {
              const [a, b, c, d] = match[1].split(',').map(Number);
              // In 2D rotation matrix: a=cos(theta), b=sin(theta), c=-sin(theta), d=cos(theta)
              if (Math.abs(b) > 0.001 || Math.abs(c) > 0.001) {
                tiltedElements.push({
                  tag: el.tagName,
                  className: el.className,
                  transform: transform,
                });
              }
            }
          }
        }

        // 2. Check zero-offset neon glow box-shadows
        // We look for box-shadow with '0px 0px [blur > 4px]' with colored components (not black/white shadows or 0 0 0 focus rings)
        const glowingElements = [];
        for (const el of allElements) {
          const style = window.getComputedStyle(el);
          const shadow = style.boxShadow;
          if (shadow && shadow !== 'none') {
            // Format in computed style is usually e.g. "rgb(255, 77, 94) 0px 0px 12px 0px" or "0px 0px 12px 0px rgb(...)"
            const parts = shadow.split(/,\\s*(?=[a-z(])/i);
            for (const part of parts) {
              const zeroOffsetGlow = /0px\\s+0px\\s+([5-9]|[1-9][0-9]+)px/.test(part);
              const isSpreadRing = /0px\\s+0px\\s+0px\\s+[1-9]px/.test(part);
              if (zeroOffsetGlow && !isSpreadRing) {
                // Ignore black/dark shadows (e.g. rgba(0, 0, 0, ...) depth shadows)
                if (!part.includes('rgb(0, 0, 0)') && !part.includes('rgba(0, 0, 0,')) {
                  glowingElements.push({
                    tag: el.tagName,
                    className: el.className,
                    shadow: part,
                  });
                }
              }
            }
          }
        }

        // 3. Ambient glow presence
        const ambientGlow = document.querySelector('.aurora-ambient-glow');
        const ambientGlowVisible = ambientGlow ? window.getComputedStyle(ambientGlow).display !== 'none' : false;

        // 4. Button metrics
        const primaryBtns = Array.from(document.querySelectorAll('.aurora-btn-primary, .btn-timer.primary, .btn-primary'));
        const btnMetrics = primaryBtns.slice(0, 5).map(b => {
          const s = window.getComputedStyle(b);
          return {
            text: b.textContent.trim().slice(0, 20),
            height: s.height,
            borderRadius: s.borderRadius,
            backgroundImage: s.backgroundImage,
            backgroundColor: s.backgroundColor,
            boxShadow: s.boxShadow,
          };
        });

        return {
          totalElementsScanned: allElements.length,
          tiltedElementsCount: tiltedElements.length,
          tiltedElements,
          glowingElementsCount: glowingElements.length,
          glowingElements,
          ambientGlowVisible,
          btnMetrics,
        };
      })()
    `)

    const auditSummary = {
      timestamp: new Date().toISOString(),
      viewportAudits: viewportAuditResults,
      domAudit,
    }

    const metricsPath = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/design_cleanup/verification_metrics.json'
    fs.writeFileSync(metricsPath, JSON.stringify(auditSummary, null, 2))
    console.log(`[Audit Complete] Metrics saved to: ${metricsPath}`)

    ws.close()
    console.log('All AFTER captures and audits finished successfully!')
  } finally {
    chrome.kill('SIGKILL')
  }
}

runCaptureAfter().catch((err) => {
  console.error('Fatal in capture after:', err)
  process.exit(1)
})
