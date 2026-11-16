import assert from 'node:assert/strict'
import path from 'node:path'

describe('SHINPO authentication background warp', function () {
  it('captures the local authentication screen and checks its fixed card geometry', async function () {
    assert.ok(process.env.SHINPO_TAURI_QA_PROFILE)
    const evidence = process.env.SHINPO_TAURI_EVIDENCE_DIR
    await browser.setWindowSize(1400, 900)
    await $('#auth-password').waitForDisplayed({ timeout: 120000 })

    const measurements = await browser.execute(() => {
      const card = document.querySelector('.auth-card')
      const container = document.querySelector('.auth-fullscreen-container')
      const rect = card.getBoundingClientRect()
      const warp = document.querySelector('.auth-warp')
      return {
        viewport: { width: innerWidth, height: innerHeight },
        card: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        container: { width: container.clientWidth, height: container.clientHeight },
        documentWidth: document.documentElement.scrollWidth,
        warp: warp ? {
          pointerEvents: getComputedStyle(warp).pointerEvents,
          position: getComputedStyle(warp).position,
          zIndex: getComputedStyle(warp).zIndex,
          cardZIndex: getComputedStyle(card).zIndex,
          animationDuration: getComputedStyle(warp.querySelector('.auth-warp__beam')).animationDuration,
          animationName: getComputedStyle(warp.querySelector('.auth-warp__beam')).animationName,
          planeCount: warp.querySelectorAll('.auth-warp__plane').length,
          beamCount: warp.querySelectorAll('.auth-warp__beam').length,
        } : null,
      }
    })
    assert.equal(measurements.documentWidth, measurements.viewport.width, 'authentication view has horizontal overflow')

    if (process.env.SHINPO_EXPECT_AUTH_WARP === '1') {
      assert.deepEqual(measurements.card, { x: 470, y: 100.796875, width: 460, height: 698.390625 }, 'auth card geometry differs from the pre-ripple native capture')
      assert.deepEqual(measurements.warp, {
        pointerEvents: 'none', position: 'absolute', zIndex: '0', cardZIndex: '10', animationDuration: '10s',
        animationName: 'authWarpTravel', planeCount: 4, beamCount: 8,
      })
      assert.equal(await browser.execute(() => document.querySelector('.auth-ripple')), null)
      const beams = await browser.$$('.auth-warp__beam')
      assert.equal(beams.length, 8, 'expected two decorative beams for each perspective side')
      for (const beam of beams) {
        assert.equal(await beam.isDisplayed(), true)
      }
      const parent = await $('.auth-warp')
      assert.equal(await parent.getAttribute('aria-hidden'), 'true')
      await browser.saveScreenshot(path.join(evidence, 'auth-warp-after.png'))

      if (process.env.SHINPO_VERIFY_AUTH_INTERACTION === '1') {
        await $('#auth-identifier').setValue('warp-visual-check')
        await $('#auth-password').setValue('This-is-only-a-visual-check')
        const passwordToggle = await $('[aria-label="Show password"]')
        await passwordToggle.click()
        assert.equal(await $('#auth-password').getAttribute('type'), 'text', 'password visibility control stopped working')
        await $('[aria-label="Hide password"]').click()
        assert.equal(await $('#auth-password').getAttribute('type'), 'password')
      }
    }

    if (process.env.SHINPO_AUTH_STAGE === 'before') {
      await browser.saveScreenshot(path.join(evidence, 'auth-warp-before.png'))
    }
    console.log(`Authentication visual evidence: ${JSON.stringify(measurements)}`)
  })
})
