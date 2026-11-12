import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

describe('SHINPO native Calendar overlapping session layout', function () {
  it('keeps same-day overlapping sessions in separate readable event lanes', async function () {
    assert.ok(process.env.SHINPO_TAURI_QA_PROFILE)
    const evidence = process.env.SHINPO_TAURI_EVIDENCE_DIR
    mkdirSync(evidence, { recursive: true })

    await $('h1').waitForDisplayed({ timeout: 120000 })
    const handles = await browser.getWindowHandles()
    if (handles.length) await browser.switchToWindow(handles[0])

    const username = `qacal_${Date.now()}`
    const createWorkspace = await $('button*=Create Workspace')
    if (await createWorkspace.isExisting() && await createWorkspace.getAttribute('aria-pressed') !== 'true') {
      await createWorkspace.click()
    }
    if (await createWorkspace.isExisting()) assert.equal(await createWorkspace.getAttribute('aria-pressed'), 'true')
    await $('#auth-identifier').setValue(username)
    const email = await $('#auth-email')
    if (await email.isExisting()) await email.setValue(`${username}@shinpo.local`)
    await $('#auth-password').setValue(`Calendar-${randomUUID()}-987#Secure!`)
    await $('button[type="submit"]').click()
    await $('#recovery-key-display').waitForDisplayed({ timeout: 30000 })
    await $('#recovery-confirmed-checkbox').click()
    await $('#recovery-continue-btn').click()
    try { await $('[aria-label="Dismiss welcome"]').click() } catch {}
    try { await $('button[aria-label="Skip and close tutorial"], .btn-tutorial-skip').click() } catch {}

    await $('[data-tab="Schedule"]').click()
    await browser.waitUntil(async () => await $('[data-tab="Schedule"]').getAttribute('aria-current') === 'page', { timeout: 30000 })

    const scheduleSession = async (name) => {
      await $('button.schedule-btn-book, [data-tutorial="schedule-book-btn"]').click()
      const dialog = await $('[role="dialog"]')
      await dialog.waitForDisplayed({ timeout: 15000 })
      await dialog.$('input[placeholder*="Deep Work Session"]').setValue(name)
      await dialog.$('button[type="submit"]').click()
      await dialog.waitForDisplayed({ reverse: true, timeout: 30000 })
    }

    const suffix = randomUUID().slice(0, 6)
    const firstName = `Overlap Alpha ${suffix}`
    const secondName = `Overlap Beta ${suffix}`
    await scheduleSession(firstName)
    await scheduleSession(secondName)

    const stagger = await browser.execute(async (names) => {
      const invoke = window.__TAURI_INTERNALS__?.invoke
      if (typeof invoke !== 'function') throw new Error('Native Tauri invoke bridge is unavailable')
      const sessions = await invoke('local_get_focus_sessions')
      const first = sessions.find((session) => session.name === names[0])
      const second = sessions.find((session) => session.name === names[1])
      if (!first?.scheduledAt || !second) throw new Error(`Could not find the two UI-created sessions: ${JSON.stringify(sessions)}`)
      const scheduledAt = new Date(new Date(first.scheduledAt).getTime() + 60_000).toISOString()
      const updated = await invoke('local_update_focus_session', { request: {
        sessionId: second.id,
        goalId: second.goalId ?? null,
        missionId: second.missionId ?? null,
        name: second.name,
        intention: second.intention ?? null,
        durationMinutes: second.durationMinutes,
        scheduledAt,
      } })
      return { first: first.scheduledAt, second: updated.scheduledAt }
    }, [firstName, secondName])
    assert.equal(new Date(stagger.second).getTime() - new Date(stagger.first).getTime(), 60_000, `the persisted session starts must have the exact one-minute screenshot stagger: ${JSON.stringify(stagger)}`)

    // Re-enter Schedule so the view reloads the native-persisted IPC update.
    await $('[data-tab="Analytics"]').click()
    await browser.waitUntil(async () => await $('[data-tab="Analytics"]').getAttribute('aria-current') === 'page', { timeout: 30000 })
    await $('[data-tab="Schedule"]').click()
    await browser.waitUntil(async () => await $('[data-tab="Schedule"]').getAttribute('aria-current') === 'page', { timeout: 30000 })
    // The native update above is intentionally outside the React adapter to set
    // an exact one-minute fixture. Refresh through SHINPO's real UI so the
    // rendered calendar is evaluated against the persisted native value.
    await $('button[aria-label="Refresh Data"]').click()
    await browser.waitUntil(async () => {
      const eventLabels = await browser.execute((names) => [...document.querySelectorAll('.schedule-grid-event-select')]
        .filter((event) => names.some((name) => event.getAttribute('aria-label')?.includes(name)))
        .map((event) => event.getAttribute('aria-label')),
      [firstName, secondName])
      const second = eventLabels.find((label) => label?.includes(secondName))
      const expectedTime = new Date(stagger.second).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      return eventLabels.length === 2 && second?.includes(expectedTime)
    }, { timeout: 30000, timeoutMsg: 'the refreshed Calendar should render the persisted +1-minute start time' })

    await browser.waitUntil(async () => await $$('.schedule-grid-event').length >= 2, { timeout: 30000 })
    for (const toast of await $$('.shinpo-toast-dismiss')) {
      if (await toast.isDisplayed()) await toast.click()
    }
    await browser.execute((names) => {
      const event = [...document.querySelectorAll('.schedule-grid-event')]
        .find((candidate) => names.some((name) => candidate.textContent.includes(name)))
      event?.scrollIntoView({ block: 'center', inline: 'nearest' })
    }, [firstName, secondName])
    await browser.pause(250)
    const layout = await browser.execute((names) => {
      const events = [...document.querySelectorAll('.schedule-grid-event')]
        .filter((event) => names.some((name) => event.textContent.includes(name)))
        .map((event) => {
          const box = event.getBoundingClientRect()
          const title = event.querySelector('.schedule-grid-event-title')
          const titleBox = title.getBoundingClientRect()
          return {
            name: title.textContent.trim(),
            x: box.x,
            y: box.y,
            right: box.right,
            bottom: box.bottom,
            width: box.width,
            height: box.height,
            laneCount: event.classList.contains('is-overlapping'),
            titleWidth: titleBox.width,
            titleHeight: titleBox.height,
            titleScrollWidth: title.scrollWidth,
            titleClientWidth: title.clientWidth,
            accessibleName: event.querySelector('button')?.getAttribute('aria-label'),
            tooltip: event.querySelector('button')?.getAttribute('title'),
          }
        })
      const scroller = document.querySelector('.schedule-calendar-scroll')
      return {
        events,
        grid: { scrollWidth: scroller.scrollWidth, clientWidth: scroller.clientWidth },
        viewport: { width: innerWidth, height: innerHeight },
      }
    }, [firstName, secondName])

    assert.equal(layout.events.length, 2, `both scheduled events should be visible in the current week: ${JSON.stringify(layout)}`)
    assert.ok(layout.events.every((event) => event.laneCount), `overlapping events should use explicit lanes: ${JSON.stringify(layout)}`)
    assert.ok(layout.events[0].right <= layout.events[1].x || layout.events[1].right <= layout.events[0].x, `overlapping cards must not cover one another: ${JSON.stringify(layout)}`)
    const firstRenderedEvent = layout.events.find((event) => event.name === firstName)
    const secondRenderedEvent = layout.events.find((event) => event.name === secondName)
    const renderedMinuteOffset = secondRenderedEvent.y - firstRenderedEvent.y
    assert.ok(renderedMinuteOffset > 0.5 && renderedMinuteOffset < 1.5, `the later event should render one minute below the first in the calendar time grid: ${JSON.stringify({ stagger, renderedMinuteOffset, events: layout.events })}`)
    assert.ok(layout.events.every((event) => event.accessibleName?.includes(event.name) && event.tooltip?.includes(event.name)), `full session names must remain available when compact titles wrap: ${JSON.stringify(layout)}`)

    await browser.saveScreenshot(path.join(evidence, 'calendar-overlapping-sessions-native.png'))
    console.log(`Native Calendar exact one-minute stagger: ${JSON.stringify(stagger)}; rendered overlap geometry: ${JSON.stringify(layout)}`)
  })
})
