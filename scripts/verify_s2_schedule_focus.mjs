import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const SCREENSHOT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/s2'
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })

async function runS2Acceptance() {
  console.log('=== SHINPO SLICE S2 ACCEPTANCE VERIFICATION ===')
  
  const chrome = spawn('google-chrome', [
    '--headless=new',
    '--remote-debugging-port=9225',
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
        const res = await fetch('http://127.0.0.1:9225/json/list')
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

    async function captureScreenshot(fileName) {
      const res = await send('Page.captureScreenshot', { format: 'png', quality: 90 })
      const filePath = path.join(SCREENSHOT_DIR, fileName)
      fs.writeFileSync(filePath, Buffer.from(res.result.data, 'base64'))
      console.log(`Saved screenshot: ${filePath}`)
      return filePath
    }

    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    })

    const testUser = 'user_s2_' + Math.floor(Math.random() * 10000)
    console.log(`\n[STEP 1] Registering isolated test user: ${testUser}...`)

    const regData = await evalCode(`
      (async () => {
        const regRes = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: ${JSON.stringify(testUser)},
            email: ${JSON.stringify(testUser + "@shinpo.local")},
            password: "Password123!"
          })
        });
        const data = await regRes.json();
        localStorage.setItem("shinpo_access_token", data.accessToken);
        localStorage.setItem("shinpo_current_user", JSON.stringify(data.user));
        return data;
      })()
    `)
    const token = regData.accessToken
    const userId = regData.user.id
    console.log(`Registered user id ${userId}`)

    await send('Page.reload')
    await sleep(2500)

    console.log('\n[STEP 2] Creating a Goal and a Task...')
    const goalAndMission = await evalCode(`
      (async () => {
        const token = localStorage.getItem("shinpo_access_token");
        const gRes = await fetch("/api/goals", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
          body: JSON.stringify({
            title: "Async Task Pipeline Scaling",
            description: "Scale asynchronous task pipeline and schedule execution",
            startDate: "2026-10-01",
            targetDate: "2026-12-31"
          })
        });
        const goal = await gRes.json();

        const mRes = await fetch("/api/missions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
          body: JSON.stringify({
            goalId: goal.id,
            title: "Worker Pool Thread Architecture",
            description: "Benchmark and tune thread pools for zero thread starvation",
            estimatedMinutes: 25,
            scheduledDate: new Date().toISOString().split("T")[0]
          })
        });
        const mission = await mRes.json();
        return { goal, mission };
      })()
    `)
    console.log('Created Goal & Mission:', goalAndMission)

    await send('Page.reload')
    await sleep(2000)

    console.log('\n[STEP 3 & 4] Navigating to Schedule & verifying Empty State in Light and Dark themes...')
    await evalCode(`
      (() => {
        const btn = document.querySelector('[data-tutorial="nav-schedule"]') ||
                    Array.from(document.querySelectorAll(".sidebar-btn")).find(el => el.textContent.includes("Calendar") || el.textContent.includes("Schedule"));
        if (btn) btn.click();
      })()
    `)
    await sleep(1500)

    // Switch to Light Theme and Capture Empty Schedule
    await evalCode(`document.documentElement.setAttribute('data-theme', 'light')`)
    await sleep(500)
    await captureScreenshot('01_Schedule_Empty_State_Light.png')

    // Switch to Dark Theme and Capture Empty Schedule
    await evalCode(`document.documentElement.setAttribute('data-theme', 'dark')`)
    await sleep(500)
    await captureScreenshot('01_Schedule_Empty_State_Dark.png')

    // Keep Light Theme for Scheduling
    await evalCode(`document.documentElement.setAttribute('data-theme', 'light')`)
    await sleep(500)

    console.log('\n[STEP 5] Scheduling a Focus Session connected to the Task...')
    await evalCode(`
      (() => {
        const bookBtn = document.querySelector('.schedule-btn-book');
        if (bookBtn) bookBtn.click();
      })()
    `)
    await sleep(800)

    // Select the task and submit
    const scheduledBooking = await evalCode(`
      (() => {
        const modal = document.querySelector('.modal-box');
        if (!modal) return { ok: false, error: 'Modal not found' };

        const select = modal.querySelector('select');
        const taskOption = Array.from(select.options).find(o => o.textContent.includes('Worker Pool Thread Architecture'));
        if (taskOption) {
          select.value = taskOption.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const nameInput = modal.querySelector('input[type="text"]');
        if (nameInput) {
          nameInput.value = "Worker Pool Benchmarking Block";
          nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        const submitBtn = modal.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.click();
        } else {
          modal.querySelector('form')?.requestSubmit();
        }
        return { ok: true, taskValue: select?.value };
      })()
    `)
    console.log('Scheduled booking submitted:', scheduledBooking)
    await sleep(2000)

    // Capture Populated Schedule in Light and Dark themes
    await captureScreenshot('02_Schedule_Booked_Session_Light.png')
    await evalCode(`document.documentElement.setAttribute('data-theme', 'dark')`)
    await sleep(500)
    await captureScreenshot('02_Schedule_Booked_Session_Dark.png')
    await evalCode(`document.documentElement.setAttribute('data-theme', 'light')`)
    await sleep(500)

    console.log('\n[STEP 6] Testing Editing of Scheduled Session...')
    const editClick = await evalCode(`
      (() => {
        const editBtn = document.querySelector('.schedule-btn-edit');
        if (!editBtn) return { ok: false, error: 'Edit button not found' };
        editBtn.click();
        return { ok: true };
      })()
    `)
    console.log('Clicked edit button:', editClick)
    await sleep(800)

    const modalEditTitle = await evalCode(`document.querySelector('.modal-title')?.textContent?.trim()`)
    console.log('Modal title in edit mode:', modalEditTitle)

    // Change duration to 30m and intention
    await evalCode(`
      (() => {
        const modal = document.querySelector('.modal-box');
        const intInput = Array.from(modal.querySelectorAll('input[type="text"]'))[1];
        if (intInput) {
          intInput.value = "Complete thread starvation benchmarks with JCU";
          intInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        const btn30 = Array.from(modal.querySelectorAll('.auth-tab-btn')).find(b => b.textContent.includes('30m'));
        if (btn30) btn30.click();

        const submitBtn = modal.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.click();
        } else {
          modal.querySelector('form')?.requestSubmit();
        }
      })()
    `)
    await sleep(2000)
    await captureScreenshot('03_Schedule_Session_Edited.png')

    // Verify session updated in DOM
    const updatedMeta = await evalCode(`document.querySelector('.schedule-session-meta')?.textContent?.trim()`)
    console.log('Updated session meta:', updatedMeta)

    console.log('\n[STEP 7 & 8] Starting Focus from Schedule & verifying Countdown...')
    const startClick = await evalCode(`
      (() => {
        const startBtn = document.querySelector('.schedule-btn-engage');
        if (!startBtn) return { ok: false, error: 'Start button not found' };
        startBtn.click();
        return { ok: true };
      })()
    `)
    console.log('Clicked start from schedule:', startClick)
    await sleep(2500)

    // Capture Focus View Active Timer in Light & Dark
    await captureScreenshot('04_Focus_Active_Countdown_Light.png')
    await evalCode(`document.documentElement.setAttribute('data-theme', 'dark')`)
    await sleep(500)
    await captureScreenshot('04_Focus_Active_Countdown_Dark.png')
    await evalCode(`document.documentElement.setAttribute('data-theme', 'light')`)
    await sleep(500)

    console.log('\n[STEP 9] Testing Pause and Resume...')
    const pauseRes = await evalCode(`
      (() => {
        const pauseBtn = Array.from(document.querySelectorAll('.btn-timer')).find(b => b.textContent.includes('Pause'));
        if (!pauseBtn) return { ok: false, error: 'Pause button not found' };
        pauseBtn.click();
        return { ok: true };
      })()
    `)
    console.log('Clicked Pause:', pauseRes)
    await sleep(1500)

    const resumeRes = await evalCode(`
      (() => {
        const resumeBtn = Array.from(document.querySelectorAll('.btn-timer')).find(b => b.textContent.includes('Resume'));
        if (!resumeBtn) return { ok: false, error: 'Resume button not found' };
        resumeBtn.click();
        return { ok: true };
      })()
    `)
    console.log('Clicked Resume:', resumeRes)
    await sleep(1500)
    await captureScreenshot('05_Focus_Paused_Resumed.png')

    console.log('\n[STEP 10] Completing Session and Submitting Reflection with Task Completion...')
    await evalCode(`
      (() => {
        const compBtn = Array.from(document.querySelectorAll('.btn-timer')).find(b => b.textContent.includes('Complete'));
        if (compBtn) compBtn.click();
      })()
    `)
    await sleep(1000)

    await captureScreenshot('06_Session_Summary_Reflection_Modal.png')

    // Fill reflection and submit with task completion checked
    const completionSubmit = await evalCode(`
      (() => {
        const modal = document.querySelector('.modal-box');
        if (!modal) return { ok: false, error: 'Summary modal not open' };

        // Select 5 stars
        const stars = modal.querySelectorAll('.star-btn');
        if (stars.length >= 5) stars[4].click();

        // Fill accomplishment
        const inputs = Array.from(modal.querySelectorAll('input[type="text"]'));
        if (inputs[0]) {
          inputs[0].value = "Resolved thread pool contention and verified with 10k mock requests";
          inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
        }

        // Fill notes
        const textarea = modal.querySelector('textarea');
        if (textarea) {
          textarea.value = "Thread queue capacity set to 250 with graceful caller-runs rejection policy.";
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // Ensure task completion is checked
        const taskCheck = modal.querySelector('#mark-task-completed-check');
        const taskCheckFound = Boolean(taskCheck);
        if (taskCheck && !taskCheck.checked) {
          taskCheck.click();
        }

        const submitBtn = modal.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.click();
        } else {
          modal.querySelector('form')?.requestSubmit();
        }
        return { ok: true, taskCheckFound };
      })()
    `)
    console.log('Summary submitted:', completionSubmit)
    await sleep(3000)

    console.log('\n[STEP 11] Verifying Cross-Screen Synchronization (Dashboard, Tasks, Goals)...')
    // Navigate to Dashboard
    await evalCode(`
      (() => {
        const btn = document.querySelector('[data-tutorial="nav-overview"]') ||
                    Array.from(document.querySelectorAll(".sidebar-btn")).find(el => el.textContent.includes("Overview") || el.textContent.includes("Dashboard"));
        if (btn) btn.click();
      })()
    `)
    await sleep(2000)
    await captureScreenshot('07_Dashboard_And_Goals_Synchronized.png')

    // Check task status in database via API
    const verifyState = await evalCode(`
      (async () => {
        const token = localStorage.getItem("shinpo_access_token");
        const mRes = await fetch("/api/missions", { headers: { "Authorization": "Bearer " + token } });
        const missions = await mRes.json();
        const mission = missions.find(m => m.title.includes("Worker Pool"));

        const sRes = await fetch("/api/focus-sessions", { headers: { "Authorization": "Bearer " + token } });
        const sessions = await sRes.json();
        const completedSession = sessions.find(s => s.status === "COMPLETED");

        return {
          missionStatus: mission?.status,
          sessionStatus: completedSession?.status,
          sessionAccomplishment: completedSession?.result?.accomplishment || completedSession?.accomplishment,
          sessionQuality: completedSession?.completionQuality
        };
      })()
    `)
    console.log('Verified Synchronized State:', verifyState)

    ws.close()
  } finally {
    chrome.kill()
  }
}

runS2Acceptance().catch((err) => {
  console.error('S2 Acceptance Error:', err)
  process.exit(1)
})
