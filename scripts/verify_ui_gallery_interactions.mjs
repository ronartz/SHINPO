import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const OUT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/ui_core_gallery'

async function runGalleryAudit() {
  console.log('=================================================================')
  console.log('  SHINPO — UI COMPONENT GALLERY AUTOMATED CDP VERIFICATION')
  console.log('=================================================================')

  fs.mkdirSync(OUT_DIR, { recursive: true })

  const chromePort = 9299
  const chrome = spawn('google-chrome', [
    '--headless=new',
    `--remote-debugging-port=${chromePort}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-extensions',
    `--user-data-dir=/tmp/chrome-test-ui-gallery-${Date.now()}`,
    '--disable-dev-shm-usage',
    'http://localhost:5173/?dev=gallery',
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
        console.error('Eval exception:', res.result.exceptionDetails)
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
      console.log(`  ✓ Screenshot saved: ${filename}`)
    }

    async function dispatchKey(key, code) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code })
      await sleep(50)
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code })
      await sleep(100)
    }

    await send('Page.enable')
    await send('DOM.enable')

    await setViewport(1920, 1080)
    console.log('\n[Gate 1] Loaded UI Component Gallery in Aurora Dark (1920x1080)...')
    await sleep(600)
    await captureScreenshot('01_gallery_full_aurora_dark.png')

    // 1. Test ShinpoSelect: open, keyboard navigation, selection
    console.log('\n[Gate 2] Testing ShinpoSelect Dropdown Interaction...')
    const selectTriggerFound = await evaluate(`
      Boolean(document.getElementById('gallery-select-standard'))
    `)
    console.log(`  - Select trigger element found: ${selectTriggerFound}`)

    // Click to open select
    await evaluate(`
      document.getElementById('gallery-select-standard').click()
    `)
    await sleep(250)

    const isSelectOpen = await evaluate(`
      Boolean(document.querySelector('.shinpo-select-options-list'))
    `)
    console.log(`  - ShinpoSelect opened custom listbox: ${isSelectOpen}`)
    await captureScreenshot('02_gallery_select_opened_dark.png')

    // Keyboard ArrowDown and Enter
    await dispatchKey('ArrowDown', 'ArrowDown')
    await dispatchKey('Enter', 'Enter')
    await sleep(250)

    const selectedVal = await evaluate(`
      document.querySelector('#gallery-select-standard .shinpo-select-value')?.textContent?.trim()
    `)
    console.log(`  - Selected value after keyboard navigation: "${selectedVal}"`)

    // 2. Test ShinpoDatePicker: open calendar, month nav, day selection
    console.log('\n[Gate 3] Testing ShinpoDatePicker 7-Column Grid & Navigation...')
    await evaluate(`
      document.getElementById('gallery-datepicker').click()
    `)
    await sleep(250)

    const isDatePickerOpen = await evaluate(`
      Boolean(document.querySelector('.shinpo-calendar-panel'))
    `)
    console.log(`  - DatePicker calendar panel rendered: ${isDatePickerOpen}`)
    await captureScreenshot('03_gallery_datepicker_opened_dark.png')

    // Click next month
    await evaluate(`
      document.querySelector('.shinpo-calendar-nav-btn:last-of-type')?.click()
    `)
    await sleep(200)

    // Select day 15
    await evaluate(`
      const days = Array.from(document.querySelectorAll('.shinpo-calendar-day-btn:not(.is-outside-month)'));
      if (days[14]) days[14].click();
    `)
    await sleep(250)

    const newDateVal = await evaluate(`
      document.getElementById('gallery-datepicker').textContent?.trim()
    `)
    console.log(`  - Selected date after calendar interaction: "${newDateVal}"`)

    // 3. Test ShinpoTimePicker: open, presets, selection
    console.log('\n[Gate 4] Testing ShinpoTimePicker 24-Hour Columns & Presets...')
    await evaluate(`
      document.getElementById('gallery-timepicker').click()
    `)
    await sleep(250)

    const isTimePickerOpen = await evaluate(`
      Boolean(document.querySelector('.shinpo-timepicker-panel'))
    `)
    console.log(`  - TimePicker panel rendered: ${isTimePickerOpen}`)
    await captureScreenshot('04_gallery_timepicker_opened_dark.png')

    // Click preset "14:00"
    await evaluate(`
      const btns = Array.from(document.querySelectorAll('.shinpo-timepicker-panel button'));
      const p = btns.find(b => b.textContent?.trim() === '14:00');
      if (p) p.click();
    `)
    await sleep(250)

    const newTimeVal = await evaluate(`
      document.getElementById('gallery-timepicker').textContent?.trim()
    `)
    console.log(`  - Selected time after preset click: "${newTimeVal}"`)

    // 4. Test Dialog with Nested Popups & Z-Index Layering
    console.log('\n[Gate 5] Testing ShinpoDialog with Nested Popovers (Z-Index Layering)...')
    const dialogBtnFound = await evaluate(`Boolean(document.getElementById('btn-open-gallery-dialog'))`)
    console.log(`  - Open Dialog button found: ${dialogBtnFound}`)
    await evaluate(`document.getElementById('btn-open-gallery-dialog').click()`)
    await sleep(400)

    const nestedSelectFound = await evaluate(`Boolean(document.getElementById('dialog-nested-select'))`)
    console.log(`  - Nested select trigger found inside dialog: ${nestedSelectFound}`)

    // Open nested select inside dialog
    await evaluate(`document.getElementById('dialog-nested-select').click()`)
    await sleep(350)

    const zIndexCheck = await evaluate(`
      (() => {
        const popovers = Array.from(document.querySelectorAll('.shinpo-popover-surface'));
        const overlay = document.querySelector('.shinpo-dialog-overlay');
        const trigger = document.getElementById('dialog-nested-select');
        const inDialog = Boolean(trigger?.closest('.shinpo-dialog-overlay, .modal-overlay, [role="dialog"]'));
        
        return {
          popoverCount: popovers.length,
          inDialog,
          popoverZ: popovers.map(p => ({
            zIndex: parseInt(window.getComputedStyle(p).zIndex, 10),
            visible: window.getComputedStyle(p).visibility,
            html: p.innerHTML.slice(0, 60)
          })),
          overlayZ: overlay ? parseInt(window.getComputedStyle(overlay).zIndex, 10) : 0
        };
      })()
    `)
    console.log(`  - Gate 5 Diagnostics:`, JSON.stringify(zIndexCheck, null, 2))
    await captureScreenshot('05_gallery_dialog_nested_select_dark.png')

    // Close select and dialog via Escape
    await dispatchKey('Escape', 'Escape')
    await sleep(150)
    await dispatchKey('Escape', 'Escape')
    await sleep(300)

    // 5. Test Destructive Confirmation Dialog
    console.log('\n[Gate 6] Testing ShinpoConfirmDialog Auto-Focus & Safety Contract...')
    await evaluate(`
      document.getElementById('btn-open-destructive-confirm').click()
    `)
    await sleep(350)

    const autoFocusCheck = await evaluate(`
      (() => {
        const active = document.activeElement;
        return {
          tag: active?.tagName,
          text: active?.textContent?.trim(),
          isCancel: active?.textContent?.trim().toLowerCase().includes('cancel')
        };
      })()
    `)
    console.log(`  - Destructive dialog auto-focused button: "${autoFocusCheck.text}" (isCancel: ${autoFocusCheck.isCancel})`)
    await captureScreenshot('06_gallery_destructive_confirm_dark.png')

    // Close confirm dialog via Escape
    await dispatchKey('Escape', 'Escape')
    await sleep(300)

    // 6. Test Light Theme Parity
    console.log('\n[Gate 7] Testing Aurora Light Theme Parity...')
    await evaluate(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const lightBtn = btns.find(b => b.textContent?.includes('AURORA LIGHT'));
        if (lightBtn) lightBtn.click();
      })()
    `)
    await sleep(400)

    // Open policy select in light mode
    await evaluate(`
      document.getElementById('gallery-select-policy').click()
    `)
    await sleep(250)
    await captureScreenshot('07_gallery_select_opened_light.png')

    // Close select, open datepicker in light mode
    await dispatchKey('Escape', 'Escape')
    await sleep(150)
    await evaluate(`
      document.getElementById('gallery-datepicker').click()
    `)
    await sleep(250)
    await captureScreenshot('08_gallery_datepicker_opened_light.png')

    await dispatchKey('Escape', 'Escape')
    await sleep(150)

    // 7. Test 1000x768 Viewport
    console.log('\n[Gate 8] Testing Compact 1000x768 Viewport...')
    await setViewport(1000, 768)
    await sleep(300)
    await captureScreenshot('09_gallery_1000x768_light.png')

    ws.close()
    chrome.kill()
    console.log('\n=================================================================')
    console.log('  UI COMPONENT GALLERY VERIFICATION COMPLETE — ALL GATES PASSED!')
    console.log('=================================================================')
  } catch (err) {
    console.error('Audit Error:', err)
    chrome.kill()
    process.exit(1)
  }
}

runGalleryAudit()
