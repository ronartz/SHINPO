import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

describe('SHINPO native Schedule task picker placement', function () {
  it('keeps the searchable task picker anchored to its field in the real WebView', async function () {
    assert.ok(process.env.SHINPO_TAURI_QA_PROFILE)
    const evidence = process.env.SHINPO_TAURI_EVIDENCE_DIR
    mkdirSync(evidence, { recursive: true })

    await $('h1').waitForDisplayed({ timeout: 120000 })
    const handles = await browser.getWindowHandles()
    if (handles.length) await browser.switchToWindow(handles[0])

    const username = `qasp_${Date.now()}`
    const createWorkspace = await $('button*=Create Workspace')
    if (await createWorkspace.isExisting() && await createWorkspace.getAttribute('aria-pressed') !== 'true') {
      await createWorkspace.click()
    }
    if (await createWorkspace.isExisting()) assert.equal(await createWorkspace.getAttribute('aria-pressed'), 'true', 'workspace creation mode is active')
    await $('#auth-identifier').setValue(username)
    const email = await $('#auth-email')
    if (await email.isExisting()) await email.setValue(`${username}@shinpo.local`)
    await $('#auth-password').setValue(`Master-${randomUUID()}-987#Secure!`)
    await $('button[type="submit"]').click()
    await browser.pause(1500)
    console.log(`Disposable account registration state: ${JSON.stringify(await browser.execute(() => ({ recoveryKeyPresented: Boolean(document.querySelector('#recovery-key-display')), alert: document.querySelector('[role="alert"]')?.textContent?.trim() || null, title: document.querySelector('.animated-card-title')?.textContent?.trim() || null })))}`)
    await $('#recovery-key-display').waitForDisplayed({ timeout: 30000 })
    await $('#recovery-confirmed-checkbox').click()
    await $('#recovery-continue-btn').click()
    try { await $('[aria-label="Dismiss welcome"]').click() } catch {}
    try { await $('button[aria-label="Skip and close tutorial"], .btn-tutorial-skip').click() } catch {}

    await $('[data-tab="Goals & Missions"]').click()
    await browser.waitUntil(async () => await $('[data-tab="Goals & Missions"]').getAttribute('aria-current') === 'page', { timeout: 30000 })
    const createGoal = await $('button*=Create First Goal')
    await createGoal.waitForDisplayed({ timeout: 15000 })
    await createGoal.click()
    const goalDialog = await $('[role="dialog"][aria-labelledby="create-goal-dialog-title"]')
    await goalDialog.waitForDisplayed({ timeout: 10000 })
    await $('#create-goal-name-input').setValue(`Schedule picker goal ${Date.now()}`)
    await goalDialog.$('button[type="submit"]').click()
    await $('.goal-single-summary-card').waitForDisplayed({ timeout: 30000 })
    const newTask = await $('[data-tutorial="new-task"]')
    await newTask.waitForDisplayed({ timeout: 15000 })
    await newTask.click()
    const taskDialog = await $('[role="dialog"][aria-labelledby="create-task-title"]')
    await taskDialog.waitForDisplayed({ timeout: 10000 })
    const taskTitle = `Schedule picker task ${Date.now()}`
    await $('#create-task-title-input').setValue(taskTitle)
    await taskDialog.$('button[type="submit"]').click()
    await browser.waitUntil(async () => (await $('.missions-list-container').getText()).includes(taskTitle), { timeout: 30000 })

    await $('[data-tab="Schedule"]').click()
    await browser.waitUntil(async () => await $('[data-tab="Schedule"]').getAttribute('aria-current') === 'page', { timeout: 30000 })
    const book = await $('button.schedule-btn-book, [data-tutorial="schedule-book-btn"]')
    await book.waitForDisplayed({ timeout: 20000 })
    await book.click()
    const dialog = await $('[role="dialog"]')
    await dialog.waitForDisplayed({ timeout: 15000 })

    const trigger = await $('#schedule-session-task-select')
    await trigger.click()
    const listbox = await $('#schedule-session-task-select-listbox')
    await listbox.waitForDisplayed({ timeout: 10000 })
    const layout = await browser.execute(() => {
      const triggerElement = document.querySelector('#schedule-session-task-select')
      const popover = document.querySelector('.shinpo-select-popover')
      const rect = (element) => {
        const box = element.getBoundingClientRect()
        return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, height: box.height }
      }
      return {
        trigger: rect(triggerElement),
        popover: rect(popover),
        placement: popover.dataset.placement,
        viewport: { width: innerWidth, height: innerHeight },
      }
    })

    assert.ok(Math.abs(layout.popover.x - layout.trigger.x) <= 2, `picker should align with its field: ${JSON.stringify(layout)}`)
    assert.ok(Math.abs(layout.popover.width - layout.trigger.width) <= 6, `picker should closely match its field width: ${JSON.stringify(layout)}`)
    assert.ok(['bottom', 'top'].includes(layout.placement), `picker should use a vertical placement: ${JSON.stringify(layout)}`)
    assert.ok(layout.popover.x >= 0 && layout.popover.right <= layout.viewport.width + 1, `picker should remain in the window: ${JSON.stringify(layout)}`)
    assert.ok(layout.popover.y >= 0 && layout.popover.bottom <= layout.viewport.height + 1, `picker should remain in the window: ${JSON.stringify(layout)}`)
    await browser.saveScreenshot(path.join(evidence, 'schedule-task-picker-native.png'))
    console.log(`Native Schedule picker geometry: ${JSON.stringify(layout)}`)

    const options = await $$('#schedule-session-task-select-listbox [role="option"]')
    assert.equal(options.length, 2, 'the picker contains the independent option and the real created task')
    await options[1].click()
    const selectedTask = await browser.execute(() => document.querySelector('#schedule-session-task-select .shinpo-select-value')?.textContent?.trim())
    assert.equal(selectedTask, taskTitle, 'selecting the task associates it with the scheduled session')
    await dialog.$('input[placeholder^="e.g. Deep Work Session"]').setValue('Native task-linked schedule')
    await dialog.$('button[type="submit"]').click()
    await browser.waitUntil(async () => !(await dialog.isDisplayed().catch(() => false)), { timeout: 30000 })
    const persisted = await browser.execute(async (expectedTitle) => {
      const invoke = window.__TAURI_INTERNALS__?.invoke
      if (typeof invoke !== 'function') throw new Error('Tauri invoke bridge unavailable')
      const tasks = await invoke('local_get_tasks')
      const sessions = await invoke('local_get_focus_sessions')
      const task = tasks.find((item) => item.title === expectedTitle)
      const session = sessions.find((item) => item.name === 'Native task-linked schedule')
      return { taskId: task?.id ?? null, sessionTaskId: session?.missionId ?? null, status: session?.status ?? null }
    }, taskTitle)
    assert.ok(persisted.taskId, `task was persisted: ${JSON.stringify(persisted)}`)
    assert.equal(persisted.sessionTaskId, persisted.taskId, `scheduled task association persisted natively: ${JSON.stringify(persisted)}`)
    assert.equal(persisted.status, 'SCHEDULED', JSON.stringify(persisted))
    await browser.saveScreenshot(path.join(evidence, 'schedule-task-association-native.png'))
    console.log(`Native scheduled task association: ${JSON.stringify(persisted)}`)
  })
})
