#!/usr/bin/env node
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const afterDir = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/d1/after'
fs.mkdirSync(afterDir, { recursive: true })

const viewports = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1440x900',  width: 1440, height: 900  },
  { name: '1280x800',  width: 1280, height: 800  },
  { name: '1000x768',  width: 1000, height: 768  },
]

async function captureAfter() {
  console.log('Capturing D1 After screenshots across all requested viewports and themes...')

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

    async function captureScreenshot(filePath, width, height) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false,
      })
      await sleep(600)
      const shot = await send('Page.captureScreenshot', { format: 'png' })
      const data = shot.result?.data || shot.data
      fs.writeFileSync(filePath, Buffer.from(data, 'base64'))
      console.log(`Saved screenshot: ${path.basename(filePath)} (${width}x${height})`)
    }

    // Register or login as representative visual acceptance user
    const acceptanceUser = 'alex_lead'
    console.log(`Setting up representative product workspace for user: ${acceptanceUser}...`)
    await evalCode(`
      (async () => {
        let token = null;
        let user = null;
        // Try login first
        let res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ usernameOrEmail: ${JSON.stringify(acceptanceUser)}, password: "Password123!" })
        });
        if (res.ok) {
          const data = await res.json();
          token = data.accessToken;
          user = data.user;
        } else {
          // Register
          res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: ${JSON.stringify(acceptanceUser)},
              email: ${JSON.stringify(acceptanceUser + "@shinpo.local")},
              password: "Password123!"
            })
          });
          if (res.ok) {
            const data = await res.json();
            token = data.accessToken;
            user = data.user;
          }
        }

        if (!token) return { ok: false };
        localStorage.setItem("shinpo_access_token", token);
        localStorage.setItem("shinpo_current_user", JSON.stringify(user));

        // Clean existing goals to create pristine representative state
        const gRes = await fetch("/api/goals", { headers: { "Authorization": "Bearer " + token } });
        if (gRes.ok) {
          const existingGoals = await gRes.json();
          for (const g of existingGoals) {
            await fetch("/api/goals/" + g.id, { method: "DELETE", headers: { "Authorization": "Bearer " + token } });
          }
        }

        const today = new Date().toISOString().split("T")[0];

        // Create Goal 1: High-Performance Execution System
        const g1Res = await fetch("/api/goals", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
          body: JSON.stringify({
            title: "Master Execution System",
            description: "Core architecture and continuous delivery pipeline for SHINPO",
            startDate: today,
            targetDate: "2026-11-30"
          })
        });
        const g1 = await g1Res.json();

        // Create Goal 2: Fedora Desktop Packaging
        const g2Res = await fetch("/api/goals", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
          body: JSON.stringify({
            title: "Personal MVP Deployment",
            description: "Four-user local Fedora release with native process shield",
            startDate: today,
            targetDate: "2026-10-31"
          })
        });
        const g2 = await g2Res.json();

        // Task 0: Focus Shield IPC Interception Calibration (Goal 1 - In Progress)
        const t0Res = await fetch("/api/missions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
          body: JSON.stringify({
            goalId: g1.id,
            title: "Focus Shield IPC Interception Calibration",
            description: "Calibrate background tamper detection and Unix domain socket response latency",
            estimatedMinutes: 30,
            scheduledDate: today
          })
        });
        const t0 = await t0Res.json();
        await fetch("/api/missions/" + t0.id, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
          body: JSON.stringify({
            goalId: g1.id,
            title: "Focus Shield IPC Interception Calibration",
            description: "Calibrate background tamper detection and Unix domain socket response latency",
            estimatedMinutes: 30,
            scheduledDate: today,
            status: "IN_PROGRESS"
          })
        });

        // Task 1: Complete Core Focus Architecture Review (Goal 1 - Ready, Priority)
        await fetch("/api/missions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
          body: JSON.stringify({
            goalId: g1.id,
            title: "Complete Core Focus Architecture Review",
            description: "Review background IPC boundaries and enforce timer anchor precision",
            estimatedMinutes: 45,
            scheduledDate: today
          })
        });

        // Task 2: Implement Dynamic Kanban Resizing (Goal 1 - Ready)
        await fetch("/api/missions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
          body: JSON.stringify({
            goalId: g1.id,
            title: "Implement Dynamic Kanban Resizing",
            description: "Ensure 3-column boards utilize 100% available container width",
            estimatedMinutes: 30,
            scheduledDate: today
          })
        });

        // Task 3: Initial Sentinel IPC Protocol Validation (Goal 2 - Completed)
        const t3Res = await fetch("/api/missions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
          body: JSON.stringify({
            goalId: g2.id,
            title: "Initial Sentinel IPC Protocol Validation",
            description: "Verify Unix domain socket tamper response latency",
            estimatedMinutes: 25,
            scheduledDate: today
          })
        });
        const t3 = await t3Res.json();
        // Mark Task 3 completed via POST
        await fetch("/api/missions/" + t3.id + "/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
          body: JSON.stringify({ actualMinutes: 25 })
        });

        // Task 4: Stabilization Pipeline Verification (Goal 2 - Completed)
        const t4Res = await fetch("/api/missions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
          body: JSON.stringify({
            goalId: g2.id,
            title: "Stabilization Pipeline Verification",
            description: "End-to-end integration and restart persistence verification",
            estimatedMinutes: 25,
            scheduledDate: today
          })
        });
        const t4 = await t4Res.json();
        // Mark Task 4 completed via POST
        await fetch("/api/missions/" + t4.id + "/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
          body: JSON.stringify({ actualMinutes: 25 })
        });

        // Create Scheduled Focus Sessions (with long titles to verify wrapping)
        await fetch("/api/focus-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
          body: JSON.stringify({
            name: "Focus Shield Calibration & Telemetry Verification",
            intention: "Validate background process interception rules and tamper defense",
            durationMinutes: 30,
            scheduledAt: new Date().toISOString()
          })
        });

        await fetch("/api/focus-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
          body: JSON.stringify({
            name: "Deep Architecture Performance Review",
            intention: "Core system performance and bottleneck analysis across domains",
            durationMinutes: 45,
            scheduledAt: new Date().toISOString()
          })
        });

        await fetch("/api/focus-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
          body: JSON.stringify({
            name: "Daily Execution Cadence Alignment",
            intention: "Prioritize upcoming sprint blocks and confirm goal targets",
            durationMinutes: 20,
            scheduledAt: new Date().toISOString()
          })
        });

        return { ok: true };
      })()
    `)

    // Reload page to load authenticated Dashboard with representative data
    await send('Page.reload')
    await sleep(2500)

    // Ensure Dashboard tab is active
    await evalCode(`
      (() => {
        const btn = document.querySelector('[data-tutorial="nav-dashboard"]') ||
                    Array.from(document.querySelectorAll(".sidebar-btn")).find(el => el.textContent.includes("Dashboard"));
        if (btn) btn.click();
      })()
    `)
    await sleep(1500)

    // Audit computed styles for D1.4 verification
    const auditMetrics = await evalCode(`
      (() => {
        function getStyle(sel, prop) {
          const el = document.querySelector(sel);
          if (!el) return 'NOT_FOUND';
          return window.getComputedStyle(el).getPropertyValue(prop);
        }

        return {
          viewport: {
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            dpr: window.devicePixelRatio,
            visualScale: window.visualViewport ? window.visualViewport.scale : null
          },
          clock: {
            digitsFontSize: getStyle('.live-clock-digits', 'font-size'),
            digitsFontWeight: getStyle('.live-clock-digits', 'font-weight'),
            colonFontSize: getStyle('.clock-colon', 'font-size'),
            secondsFontSize: getStyle('.clock-seconds', 'font-size'),
            ampmFontSize: getStyle('.live-clock-ampm', 'font-size'),
            dateFontSize: getStyle('.live-clock-date-display', 'font-size'),
            clockPadding: getStyle('.dashboard-live-clock', 'padding')
          },
          metrics: {
            valueFontSize: getStyle('.metric-card-value', 'font-size'),
            valueFontWeight: getStyle('.metric-card-value', 'font-weight'),
            labelFontSize: getStyle('.metric-card-label', 'font-size'),
            subFontSize: getStyle('.metric-card-sub', 'font-size'),
            cardPadding: getStyle('.dashboard-metric-card', 'padding')
          },
          sidebar: {
            btnFontSize: getStyle('.sidebar-btn', 'font-size'),
            btnPadding: getStyle('.sidebar-btn', 'padding'),
            btnMinHeight: getStyle('.sidebar-btn', 'min-height'),
            sectionHeaderFontSize: getStyle('.sidebar-section-header', 'font-size'),
            brandTitleFontSize: getStyle('.brand-title', 'font-size'),
            quoteFontSize: getStyle('.sidebar-upper-quote-text', 'font-size'),
            quotePadding: getStyle('.sidebar-upper-quote', 'padding'),
            statusQuietPadding: getStyle('.sidebar-status-quiet', 'padding'),
            statusQuietTitleFontSize: getStyle('.status-quiet-title', 'font-size'),
            statusQuietSubFontSize: getStyle('.status-quiet-sub', 'font-size')
          },
          cockpit: {
            priorityTitleFontSize: getStyle('.hero-session-title', 'font-size'),
            priorityDescFontSize: getStyle('.hero-session-desc', 'font-size'),
            heroBtnFontSize: getStyle('.btn-hero-action', 'font-size'),
            heroBtnMinHeight: getStyle('.btn-hero-action', 'min-height'),
            sidecarTitleFontSize: getStyle('.sidecar-card-title', 'font-size'),
            scheduleNameFontSize: getStyle('.schedule-session-name', 'font-size'),
            scheduleSubFontSize: getStyle('.schedule-session-sub', 'font-size'),
            scheduleTimePillFontSize: getStyle('.schedule-time-pill', 'font-size'),
            durationPillFontSize: getStyle('.duration-pill', 'font-size')
          },
          board: {
            boardTitleFontSize: getStyle('.flight-deck-board-panel .board-panel-title', 'font-size'),
            summaryPillFontSize: getStyle('.flight-deck-board-panel .summary-pill', 'font-size'),
            columnTitleFontSize: getStyle('.column-title-text', 'font-size'),
            columnCountBadgeFontSize: getStyle('.column-count-badge', 'font-size'),
            cardTitleFontSize: getStyle('.card-title', 'font-size'),
            cardCheckBtnWidth: getStyle('.card-check-btn', 'width'),
            cardCheckBtnHeight: getStyle('.card-check-btn', 'height'),
            cardGoalTagFontSize: getStyle('.card-goal-tag', 'font-size'),
            cardDurationChipFontSize: getStyle('.card-duration-chip', 'font-size'),
            cardPriorityChipFontSize: getStyle('.card-priority-chip', 'font-size'),
            cardQuickArmBtnFontSize: getStyle('.card-quick-arm-btn', 'font-size')
          }
        };
      })()
    `)
    console.log('\\n=== D1.4 COMPUTED STYLES AUDIT ===')
    console.log(JSON.stringify(auditMetrics, null, 2))
    console.log('===================================\\n')

    // Loop through viewports and capture both themes
    for (const vp of viewports) {
      console.log(`\n--- Capturing viewport ${vp.name} ---`)

      // 1. Dark Theme - Top View
      await evalCode(`
        (() => {
          document.documentElement.setAttribute('data-theme', 'dark');
          document.body.classList.remove('theme-light');
          document.body.classList.add('theme-dark');
          window.scrollTo(0, 0);
        })()
      `)
      await sleep(400)
      await captureScreenshot(
        path.join(afterDir, `dashboard_${vp.name}_dark.png`),
        vp.width,
        vp.height
      )

      // 1b. Dark Theme - Board View (scrolled into tasks board)
      await evalCode(`
        (() => {
          const board = document.getElementById('tasks-board');
          if (board) board.scrollIntoView();
        })()
      `)
      await sleep(400)
      await captureScreenshot(
        path.join(afterDir, `dashboard_${vp.name}_board_dark.png`),
        vp.width,
        vp.height
      )

      // 2. Light Theme - Top View
      await evalCode(`
        (() => {
          document.documentElement.setAttribute('data-theme', 'light');
          document.body.classList.remove('theme-dark');
          document.body.classList.add('theme-light');
          window.scrollTo(0, 0);
        })()
      `)
      await sleep(400)
      await captureScreenshot(
        path.join(afterDir, `dashboard_${vp.name}_light.png`),
        vp.width,
        vp.height
      )

      // 2b. Light Theme - Board View
      await evalCode(`
        (() => {
          const board = document.getElementById('tasks-board');
          if (board) board.scrollIntoView();
        })()
      `)
      await sleep(400)
      await captureScreenshot(
        path.join(afterDir, `dashboard_${vp.name}_board_light.png`),
        vp.width,
        vp.height
      )
    }

    // Now test and capture an Empty State
    console.log('\n--- Capturing Empty State ---')
    // Register a fresh empty user
    const emptyUser = `user_empty_${Date.now().toString().slice(-4)}`
    await evalCode(`
      (async () => {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: ${JSON.stringify(emptyUser)},
            email: ${JSON.stringify(emptyUser + "@shinpo.local")},
            password: "Password123!"
          })
        });
        const data = await res.json();
        localStorage.setItem("shinpo_access_token", data.accessToken);
        localStorage.setItem("shinpo_refresh_token", data.refreshToken);
        localStorage.setItem("shinpo_current_user", JSON.stringify(data.user));
      })()
    `)
    await send('Page.reload')
    await sleep(2000)

    // Delete starter goals/tasks to render pure zero-data state
    await evalCode(`
      (async () => {
        const token = localStorage.getItem("shinpo_access_token");
        const gRes = await fetch("/api/goals", { headers: { "Authorization": "Bearer " + token } });
        const goals = await gRes.json();
        for (const g of goals) {
          await fetch("/api/goals/" + g.id, { method: "DELETE", headers: { "Authorization": "Bearer " + token } });
        }
      })()
    `)
    await send('Page.reload')
    await sleep(2000)

    // Dark Empty State
    await evalCode(`
      (() => {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.classList.remove('theme-light');
        document.body.classList.add('theme-dark');
      })()
    `)
    await sleep(400)
    await captureScreenshot(
      path.join(afterDir, `dashboard_1440x900_empty_dark.png`),
      1440,
      900
    )

    // Light Empty State
    await evalCode(`
      (() => {
        document.documentElement.setAttribute('data-theme', 'light');
        document.body.classList.remove('theme-dark');
        document.body.classList.add('theme-light');
      })()
    `)
    await sleep(400)
    await captureScreenshot(
      path.join(afterDir, `dashboard_1440x900_empty_light.png`),
      1440,
      900
    )

    console.log('\nAll D1 screenshots captured successfully!')
    ws.close()
  } catch (err) {
    console.error('Error during captureAfter:', err)
  } finally {
    chrome.kill()
  }
}

captureAfter()

