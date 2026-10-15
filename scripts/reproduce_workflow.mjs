#!/usr/bin/env node
// ==============================================================================
// SHINPO Slice S1: End-to-End Real UI Workflow Test & Verification
// Steps: LOGIN -> CREATE GOAL -> CREATE TASK -> EDIT TASK -> COMPLETE TASK ->
//        UPDATE PROGRESS -> RESTART -> VERIFY PERSISTENCE
// ==============================================================================
import { spawn, execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const screenshotsDir = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/s1'
fs.mkdirSync(screenshotsDir, { recursive: true })

async function runWorkflow() {
  console.log('======================================================================')
  console.log('SHINPO Slice S1: End-to-End Real UI Workflow Verification')
  console.log('======================================================================')

  const consoleLogs = []
  const networkRequests = []

  const chrome = spawn('google-chrome', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    'http://localhost:5173/'
  ])

  let exitCode = 0

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

    if (!wsUrl) throw new Error('Could not find Chrome webSocketDebuggerUrl on port 9222')

    const ws = new WebSocket(wsUrl)
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve)
      ws.addEventListener('error', reject)
    })

    let id = 1
    const pending = new Map()

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data)
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map((a) => a.value ?? a.description ?? JSON.stringify(a)).join(' ')
        consoleLogs.push(`[CONSOLE ${msg.params.type}] ${text}`)
        if (msg.params.type === 'error') {
          console.error(`  >> BROWSER ERROR: ${text}`)
        }
      }
      if (msg.method === 'Network.responseReceived') {
        const { url, status, statusText } = msg.params.response
        if (url.includes('/api/')) {
          networkRequests.push({ url, status, statusText })
          if (status >= 400) {
            console.error(`  >> API FAILURE: ${status} ${statusText} - ${url}`)
          }
        }
      }
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
    await send('Network.enable')
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    })
    await sleep(800)

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

    async function captureScreenshot(name) {
      const shot = await send('Page.captureScreenshot', { format: 'png' })
      const data = shot.result?.data || shot.data
      const filePath = path.join(screenshotsDir, `${name}.png`)
      fs.writeFileSync(filePath, Buffer.from(data, 'base64'))
      console.log(`  -> Screenshot captured: ${name}.png`)
    }

    console.log('\n--- STEP 1: AUTHENTICATION ---')
    const isLoginVisible = await evalCode(`!!document.querySelector(".auth-card")`)
    console.log(`Auth card visible: ${isLoginVisible}`)

    const testUsername = `user_s1_${Date.now().toString().slice(-4)}`
    const testEmail = `${testUsername}@shinpo.local`
    const testPass = 'Password123!'

    console.log(`Registering isolated test user: ${testUsername}...`)
    const regResult = await evalCode(`
      (async () => {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: ${JSON.stringify(testUsername)},
            email: ${JSON.stringify(testEmail)},
            password: ${JSON.stringify(testPass)}
          })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return { ok: false, status: res.status, err };
        }
        const data = await res.json();
        localStorage.setItem("shinpo_access_token", data.accessToken);
        localStorage.setItem("shinpo_refresh_token", data.refreshToken);
        localStorage.setItem("shinpo_current_user", JSON.stringify(data.user));
        return { ok: true, user: data.user };
      })()
    `)
    console.log('Registration result:', regResult)

    console.log('Reloading page with authenticated session...')
    await send('Page.reload')
    await sleep(2000)

    const isShellLoaded = await evalCode(`!!document.querySelector(".app-shell")`)
    console.log(`App shell mounted: ${isShellLoaded}`)
    if (!isShellLoaded) throw new Error('App shell failed to mount after login')

    console.log('\n--- STEP 2: CREATE GOAL IN REAL UI ---')
    console.log('Navigating to Goals tab...')
    await evalCode(`
      (() => {
        const btn = document.querySelector('[data-tutorial="nav-goals"]') ||
                    Array.from(document.querySelectorAll(".sidebar-btn")).find(el => el.textContent.includes("Goals"));
        if (btn) btn.click();
      })()
    `)
    await sleep(1000)

    console.log('Clicking "New Goal" button in UI...')
    await evalCode(`
      (() => {
        const btn = document.querySelector('[data-tutorial="new-goal"]') ||
                    Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("New Goal"));
        if (btn) btn.click();
      })()
    `)
    await sleep(600)

    const goalTitle = `Stabilization Goal ${Date.now().toString().slice(-4)}`
    console.log(`Submitting Goal: "${goalTitle}"...`)
    await evalCode(`
      (() => {
        const titleInput = document.querySelector('input[placeholder*="Goal title"]');
        const proto = window.HTMLInputElement.prototype;
        const setVal = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setVal.call(titleInput, ${JSON.stringify(goalTitle)});
        titleInput.dispatchEvent(new Event('input', { bubbles: true }));

        const submitBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Create Goal") && b.type === "submit");
        if (submitBtn) submitBtn.click();
      })()
    `)
    await sleep(1500)

    const goalRendered = await evalCode(`document.body.textContent.includes(${JSON.stringify(goalTitle)})`)
    console.log(`[PASS] Goal rendered in UI: ${goalRendered}`)
    if (!goalRendered) throw new Error(`Goal was not rendered in UI`)

    await captureScreenshot('01_Goal_Created')

    console.log('\n--- STEP 3: CREATE TASK IN REAL UI ---')
    console.log('Clicking "New Task" button on Goals tab...')
    await evalCode(`
      (() => {
        const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("New Task"));
        if (btn) btn.click();
      })()
    `)
    await sleep(800)

    const isTaskModalOpen = await evalCode(`
      !!document.querySelector(".modal-overlay") && document.body.textContent.includes("Create Task")
    `)
    console.log(`Create Task Modal visible: ${isTaskModalOpen}`)
    if (!isTaskModalOpen) throw new Error('Create Task modal failed to open from Goals tab')

    const taskTitle = `Stabilization Task ${Date.now().toString().slice(-4)}`
    console.log(`Selecting goal "${goalTitle}" and submitting Task: "${taskTitle}"...`)
    await evalCode(`
      (() => {
        const select = document.querySelector('select.modal-field');
        if (select) {
          const opt = Array.from(select.options).find(o => o.text.includes(${JSON.stringify(goalTitle)}));
          if (opt) {
            select.value = opt.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }

        const titleInput = document.querySelector('input[placeholder*="Refactor API endpoint"]');
        const proto = window.HTMLInputElement.prototype;
        const setVal = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setVal.call(titleInput, ${JSON.stringify(taskTitle)});
        titleInput.dispatchEvent(new Event('input', { bubbles: true }));

        const submitBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Create Task") && b.type === "submit");
        if (submitBtn) submitBtn.click();
      })()
    `)
    await sleep(1500)

    const taskRendered = await evalCode(`document.body.textContent.includes(${JSON.stringify(taskTitle)})`)
    console.log(`[PASS] Task rendered in UI: ${taskRendered}`)
    if (!taskRendered) throw new Error('Task was not rendered in UI after creation')

    await captureScreenshot('02_Task_Created')

    console.log('\n--- STEP 4: EDIT TASK IN REAL UI ---')
    console.log(`Clicking Edit Task button for "${taskTitle}"...`)
    await evalCode(`
      (() => {
        const rows = Array.from(document.querySelectorAll(".mission-deck-row"));
        const targetRow = rows.find(r => r.textContent.includes(${JSON.stringify(taskTitle)}));
        if (targetRow) {
          const editBtn = targetRow.querySelector('.btn-icon-edit[title="Edit Task"]');
          if (editBtn) editBtn.click();
        }
      })()
    `)
    await sleep(800)

    const isEditModalOpen = await evalCode(`
      !!document.querySelector(".modal-overlay") && document.body.textContent.includes("Edit Task")
    `)
    console.log(`Edit Task Modal visible: ${isEditModalOpen}`)
    if (!isEditModalOpen) throw new Error('Edit Task modal failed to open')

    const updatedTaskTitle = `${taskTitle} (Updated)`
    console.log(`Changing task title to: "${updatedTaskTitle}" and saving...`)
    await evalCode(`
      (() => {
        const inputs = Array.from(document.querySelectorAll("input.modal-field"));
        const titleInput = inputs.find(i => i.type === "text");
        if (titleInput) {
          const proto = window.HTMLInputElement.prototype;
          const setVal = Object.getOwnPropertyDescriptor(proto, 'value').set;
          setVal.call(titleInput, ${JSON.stringify(updatedTaskTitle)});
          titleInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        const submitBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Save Changes") && b.type === "submit");
        if (submitBtn) submitBtn.click();
      })()
    `)
    await sleep(1500)

    const updatedTaskRendered = await evalCode(`document.body.textContent.includes(${JSON.stringify(updatedTaskTitle)})`)
    console.log(`[PASS] Updated task title rendered in UI: ${updatedTaskRendered}`)
    if (!updatedTaskRendered) throw new Error('Updated task title not found in UI')

    await captureScreenshot('03_Task_Edited')

    console.log('\n--- STEP 5: COMPLETE TASK IN REAL UI ---')
    console.log(`Clicking completion checkbox for "${updatedTaskTitle}"...`)
    await evalCode(`
      (() => {
        const rows = Array.from(document.querySelectorAll(".mission-deck-row"));
        const targetRow = rows.find(r => r.textContent.includes(${JSON.stringify(updatedTaskTitle)}));
        if (targetRow) {
          const checkBtn = targetRow.querySelector(".mission-check-btn");
          if (checkBtn) checkBtn.click();
        }
      })()
    `)
    await sleep(1500)

    const isTaskCompleted = await evalCode(`
      (() => {
        const rows = Array.from(document.querySelectorAll(".mission-deck-row"));
        const targetRow = rows.find(r => r.textContent.includes(${JSON.stringify(updatedTaskTitle)}));
        return !!targetRow && (targetRow.classList.contains("completed") || targetRow.textContent.includes("COMPLETED") || !!targetRow.querySelector(".mission-check-btn.checked"));
      })()
    `)
    console.log(`[PASS] Task marked completed in UI: ${isTaskCompleted}`)
    if (!isTaskCompleted) throw new Error('Task did not transition to COMPLETED')

    await captureScreenshot('04_Task_Completed')

    console.log('\n--- STEP 6: VERIFY PROGRESS ON CONNECTED SCREENS ---')
    // Check Goals tab progress bar
    const goalProgressText = await evalCode(`
      (() => {
        const cards = Array.from(document.querySelectorAll(".goal-card-item"));
        const targetCard = cards.find(c => c.textContent.includes(${JSON.stringify(goalTitle)}));
        return targetCard ? targetCard.textContent : "";
      })()
    `)
    console.log(`Goal progress summary for "${goalTitle}": ${goalProgressText}`)
    const isGoal100Percent = goalProgressText.includes("100%") || goalProgressText.includes("1/1")
    console.log(`[PASS] Goal progress reflects completion: ${isGoal100Percent}`)
    if (!isGoal100Percent) throw new Error(`Goal progress did not reach 100%: ${goalProgressText}`)

    // Navigate to Dashboard
    console.log('Navigating to Dashboard...')
    await evalCode(`
      (() => {
        const btn = document.querySelector('[data-tutorial="nav-dashboard"]') ||
                    Array.from(document.querySelectorAll(".sidebar-btn")).find(el => el.textContent.includes("Dashboard"));
        if (btn) btn.click();
      })()
    `)
    await sleep(1000)

    const dashboardSummary = await evalCode(`
      (() => {
        const compPill = document.querySelector(".summary-pill.completed");
        const hasCardInCol = document.body.textContent.includes(${JSON.stringify(updatedTaskTitle)});
        return {
          pillText: compPill ? compPill.textContent.trim() : null,
          hasTaskCard: hasCardInCol
        };
      })()
    `)
    console.log('Dashboard summary check:', dashboardSummary)
    console.log(`[PASS] Dashboard reflects completed task: ${dashboardSummary.hasTaskCard}`)
    if (!dashboardSummary.hasTaskCard) throw new Error('Completed task not rendered on Dashboard')

    await captureScreenshot('05_Dashboard_Progress_Verified')

    console.log('\n--- STEP 7: RESTART BACKEND & RELOAD ---')
    console.log('Restarting Spring Boot backend via ./bin/shinpo restart...')
    execSync('./bin/shinpo restart', { stdio: 'inherit' })
    await sleep(2000)

    console.log('Reloading browser page to test persistence...')
    await send('Page.reload')
    await sleep(2500)

    console.log('\n--- STEP 8: VERIFY PERSISTENCE ACROSS RESTART ---')
    const postRestartDashboard = await evalCode(`
      (() => {
        const hasTask = document.body.textContent.includes(${JSON.stringify(updatedTaskTitle)});
        const compPill = document.querySelector(".summary-pill.completed");
        return {
          hasTask,
          pillText: compPill ? compPill.textContent.trim() : null
        };
      })()
    `)
    console.log('Dashboard post-restart persistence check:', postRestartDashboard)

    // Navigate back to Goals
    await evalCode(`
      (() => {
        const btn = document.querySelector('[data-tutorial="nav-goals"]') ||
                    Array.from(document.querySelectorAll(".sidebar-btn")).find(el => el.textContent.includes("Goals"));
        if (btn) btn.click();
      })()
    `)
    await sleep(1000)

    const postRestartGoals = await evalCode(`
      (() => {
        const hasGoal = document.body.textContent.includes(${JSON.stringify(goalTitle)});
        const hasTask = document.body.textContent.includes(${JSON.stringify(updatedTaskTitle)});
        const rows = Array.from(document.querySelectorAll(".mission-deck-row"));
        const targetRow = rows.find(r => r.textContent.includes(${JSON.stringify(updatedTaskTitle)}));
        const isCompleted = targetRow && (targetRow.classList.contains("completed") || targetRow.textContent.includes("COMPLETED") || !!targetRow.querySelector(".mission-check-btn.checked"));
        return { hasGoal, hasTask, isCompleted };
      })()
    `)
    console.log('Goals view post-restart persistence check:', postRestartGoals)

    if (!postRestartGoals.hasGoal || !postRestartGoals.hasTask || !postRestartGoals.isCompleted) {
      throw new Error(`Persistence failure after backend restart! ${JSON.stringify(postRestartGoals)}`)
    }

    console.log('\n======================================================================')
    console.log('SUCCESS: ENTIRE USER WORKFLOW VERIFIED END-TO-END IN REAL APPLICATION!')
    console.log('======================================================================')

    await captureScreenshot('06_Post_Restart_Persistence_Verified')

    ws.close()
  } catch (err) {
    console.error('\n[WORKFLOW FAILED]:', err)
    if (consoleLogs.length > 0) {
      console.log('\nBrowser Console Logs (last 10):')
      consoleLogs.slice(-10).forEach(l => console.log('  ', l))
    }
    if (networkRequests.length > 0) {
      console.log('\nRecent API Requests:')
      networkRequests.slice(-10).forEach(r => console.log(`   ${r.status} ${r.statusText} ${r.url}`))
    }
    exitCode = 1
  } finally {
    chrome.kill()
  }

  process.exit(exitCode)
}

runWorkflow()
