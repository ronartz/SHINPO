import assert from 'node:assert/strict'
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

function evidenceDirectory() {
  const directory = process.env.SHINPO_WARP_EVIDENCE_DIR || process.env.SHINPO_TAURI_EVIDENCE_DIR
  mkdirSync(directory, { recursive: true })
  return directory
}

async function state() {
  return browser.execute(() => {
    const card = document.querySelector('.auth-card')
    const rect = card.getBoundingClientRect()
    const warp = document.querySelector('.auth-warp')
    const beam = warp?.querySelector('.auth-warp__beam')
    return {
      theme: document.documentElement.dataset.theme,
      brand: document.documentElement.dataset.brand,
      viewport: { width: innerWidth, height: innerHeight },
      card: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      warp: warp && beam ? {
        planeCount: warp.querySelectorAll('.auth-warp__plane').length,
        beamCount: warp.querySelectorAll('.auth-warp__beam').length,
        pointerEvents: getComputedStyle(warp).pointerEvents,
        position: getComputedStyle(warp).position,
        zIndex: getComputedStyle(warp).zIndex,
        cardZIndex: getComputedStyle(card).zIndex,
        animationName: getComputedStyle(beam).animationName,
        animationDuration: getComputedStyle(beam).animationDuration,
        opacity: getComputedStyle(beam).opacity,
        transform: getComputedStyle(beam).transform,
        gridImage: getComputedStyle(warp.querySelector('.auth-warp__plane')).backgroundImage,
        backgroundColor: getComputedStyle(document.querySelector('.auth-fullscreen-container')).backgroundColor,
        ariaHidden: warp.getAttribute('aria-hidden'),
      } : null,
    }
  })
}

async function captureAuth(label, expectedTheme, expectedBrand, cardGeometry) {
  await $('#auth-password').waitForDisplayed({ timeout: 30000 })
  await browser.setWindowSize(1400, 900)
  await browser.pause(450)
  const before = await state()
  assert.equal(before.theme, expectedTheme, `${label}: theme setting did not reach the auth screen`)
  assert.equal(before.brand, expectedBrand, `${label}: brand setting did not reach the auth screen`)
  assert.equal(before.viewport.width, 1400)
  assert.equal(before.viewport.height, 900)
  assert.equal(before.documentWidth, before.viewport.width, `${label}: horizontal overflow`)
  assert.equal(before.documentHeight, before.viewport.height, `${label}: vertical overflow`)
  assert.equal(before.reducedMotion, false, `${label}: expected normal motion preference`)
  assert.ok(before.warp, `${label}: warp layer is missing`)
  assert.equal(await browser.execute(() => document.querySelector('.auth-ripple')), null, `${label}: old ripple remains mounted`)
  assert.equal(before.warp.planeCount, 4)
  assert.equal(before.warp.beamCount, 8)
  assert.equal(before.warp.pointerEvents, 'none')
  assert.equal(before.warp.position, 'absolute')
  assert.equal(before.warp.zIndex, '0')
  assert.equal(before.warp.cardZIndex, '10')
  assert.equal(before.warp.ariaHidden, 'true')
  assert.ok(before.warp.gridImage.includes('linear-gradient'), `${label}: perspective grid is missing`)
  assert.equal(before.warp.animationName, 'authWarpTravel')
  assert.ok(['8s', '9s', '10s', '11s', '12s'].includes(before.warp.animationDuration), `${label}: unexpected beam duration ${before.warp.animationDuration}`)
  assert.notEqual(before.warp.gridImage, 'none', `${label}: grid is not visible`)
  if (cardGeometry) assert.deepEqual(before.card, cardGeometry, `${label}: auth card geometry changed`)

  const file = path.join(evidenceDirectory(), `auth-warp-${label}-1400x900.png`)
  await browser.saveScreenshot(file)
  await browser.pause(700)
  const after = await state()
  assert.deepEqual(after.card, before.card, `${label}: ring animation moved/resized the card`)
  assert.equal(after.documentHeight, after.viewport.height, `${label}: animation introduced vertical overflow`)
  assert.notEqual(after.warp.transform, before.warp.transform, `${label}: beam did not travel during the observation window`)
  console.log(`Warp ${label}: ${JSON.stringify(before)}`)
  console.log(`Screenshot: ${file}`)
  return before.card
}

async function signOut() {
  await $('[aria-label="Sign Out"]').click()
  await $('#auth-password').waitForDisplayed({ timeout: 30000 })
}

async function signIn(username, password) {
  const signInTab = await $('button*=Sign In')
  if (await signInTab.isDisplayed()) await signInTab.click()
  await $('#auth-identifier').setValue(username)
  await $('#auth-password').setValue(password)
  await $('button[type="submit"]').click()
  await $('[data-tab="Dashboard"]').waitForDisplayed({ timeout: 60000 })
}

async function setAppearance(theme, brand) {
  await $('[aria-label="Settings"]').click()
  await $('[aria-label="Close Settings"]').waitForDisplayed({ timeout: 15000 })
  const themeLabel = theme === 'dark' ? 'Dark Theme' : 'Light Theme'
  await $(`button*=${themeLabel}`).click()
  const brandLabel = brand === 'aurora' ? 'Aurora View (V2 Cinematic)' : 'Classic View'
  await $(`button*=${brandLabel}`).click()
  await browser.waitUntil(async () => await browser.execute((expectedTheme, expectedBrand) =>
    document.documentElement.dataset.theme === expectedTheme && document.documentElement.dataset.brand === expectedBrand
  , theme, brand), { timeout: 15000, timeoutMsg: `Settings did not apply ${brand} ${theme}` })
  await $('[aria-label="Close Settings"]').click()
}

describe('SHINPO native authentication Warp background acceptance', function () {
  it('captures all four real theme combinations using local Settings and authentication', async function () {
    if (process.env.SHINPO_EXPECT_REDUCED_MOTION === '1') this.skip()
    assert.ok(process.env.SHINPO_TAURI_QA_PROFILE)
    const handles = await browser.getWindowHandles()
    if (handles.length) await browser.switchToWindow(handles[0])

    await captureAuth('aurora-dark-initial', 'dark', 'aurora', {
      x: 470, y: 100.796875, width: 460, height: 698.390625,
    })
    const username = `qa_warp_${Date.now()}`
    const password = `Warp-QA-${randomUUID()}-Safe!`
    const email = await $('#auth-email')
    if (await email.isExisting()) await email.setValue(`${username}@example.invalid`)
    await $('#auth-identifier').setValue(username)
    await $('#auth-password').setValue(password)
    await $('button[type="submit"]').click()
    await $('#recovery-key-display').waitForDisplayed({ timeout: 60000 })
    await $('#recovery-confirmed-checkbox').click()
    await $('#recovery-continue-btn').click()
    const welcome = await $('[aria-label="Dismiss welcome"]')
    try { if (await welcome.isDisplayed()) await welcome.click() } catch {}
    await $('[data-tab="Dashboard"]').waitForDisplayed({ timeout: 30000 })

    await setAppearance('dark', 'classic')
    await signOut()
    await $('button*=Sign In').click()
    const classicDarkGeometry = await captureAuth('classic-dark', 'dark', 'classic')

    await signIn(username, password)
    await setAppearance('light', 'classic')
    await signOut()
    const classicLightGeometry = await captureAuth('classic-light', 'light', 'classic')

    await signIn(username, password)
    await setAppearance('light', 'aurora')
    await signOut()
    const auroraLightGeometry = await captureAuth('aurora-light', 'light', 'aurora')

    for (const card of [classicDarkGeometry, classicLightGeometry, auroraLightGeometry]) {
      assert.equal(card.width, 460, 'auth card width differs from the accepted 460px layout')
    }
    await signIn(username, password)
    await setAppearance('dark', 'aurora')
    await signOut()
    const auroraDarkGeometry = await captureAuth('aurora-dark', 'dark', 'aurora')
    assert.deepEqual(auroraDarkGeometry, {
      x: 470, y: 129.796875, width: 460, height: 640.390625,
    }, 'Sign In card geometry differs from the accepted native screenshot')
    for (const card of [classicDarkGeometry, classicLightGeometry, auroraLightGeometry]) {
      assert.deepEqual(card, auroraDarkGeometry, 'theme change altered the Sign In card geometry')
    }
    await $('#auth-identifier').setValue(username)
    await $('#auth-password').setValue(password)
    const toggle = await $('[aria-label="Show password"]')
    await toggle.click()
    assert.equal(await $('#auth-password').getAttribute('type'), 'text', 'password visibility control failed')
    await $('[aria-label="Hide password"]').click()
    assert.equal(await $('#auth-password').getAttribute('type'), 'password')
    await $('#auth-identifier').clearValue()
    await $('#auth-password').clearValue()
    console.log('Real local authentication, sign-out, re-unlock, Settings and password visibility interactions passed in the disposable vault')
  })

  it('honors reduced motion exposed to the actual WebKitGTK WebView', async function () {
    if (process.env.SHINPO_EXPECT_REDUCED_MOTION !== '1') this.skip()
    assert.ok(process.env.SHINPO_TAURI_QA_PROFILE)
    await $('#auth-password').waitForDisplayed({ timeout: 120000 })
    await browser.setWindowSize(1400, 900)
    const reduced = await browser.execute(() => {
      document.activeElement?.blur()
      const beam = document.querySelector('.auth-warp__beam')
      const style = getComputedStyle(beam)
      return {
        media: matchMedia('(prefers-reduced-motion: reduce)').matches,
        animationName: style.animationName,
        opacity: style.opacity,
        planeCount: document.querySelectorAll('.auth-warp__plane').length,
        beamCount: document.querySelectorAll('.auth-warp__beam').length,
        card: (() => { const r = document.querySelector('.auth-card').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } })(),
      }
    })
    assert.equal(reduced.media, true, 'WebKitGTK did not receive the isolated reduce-motion preference')
    assert.equal(reduced.animationName, 'none', 'warp beam animation is not disabled under reduced motion')
    assert.equal(reduced.planeCount, 4)
    assert.equal(reduced.beamCount, 8)
    const evidence = evidenceDirectory()
    const first = path.join(evidence, 'auth-warp-reduced-motion-a.png')
    const second = path.join(evidence, 'auth-warp-reduced-motion-b.png')
    await browser.saveScreenshot(first)
    await browser.pause(1200)
    await browser.saveScreenshot(second)
    assert.deepEqual(readFileSync(first), readFileSync(second), 'reduced-motion WebView background changed between screenshots')
    console.log(`Reduced-motion Warp WebKitGTK: ${JSON.stringify(reduced)}`)
    console.log(`Static-state screenshots: ${first}, ${second}`)
  })
})
