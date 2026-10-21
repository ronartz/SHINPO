import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { focusAtmosphere } from './focusAtmosphere.ts'

describe('focusAtmosphere service contracts', () => {
  it('initializes in quiet mode with 50% default volume', () => {
    const config = focusAtmosphere.getConfig()
    assert.equal(config.sound, 'quiet')
    assert.equal(config.volume, 0.5)
    assert.equal(config.isPlaying, false)
  })

  it('clamps volume within 0 to 1 boundaries', () => {
    focusAtmosphere.setVolume(-0.5)
    assert.equal(focusAtmosphere.getConfig().volume, 0)

    focusAtmosphere.setVolume(1.8)
    assert.equal(focusAtmosphere.getConfig().volume, 1)

    focusAtmosphere.setVolume(0.75)
    assert.equal(focusAtmosphere.getConfig().volume, 0.75)
  })

  it('setting sound to quiet stops playback safely', async () => {
    await focusAtmosphere.setSound('quiet')
    const config = focusAtmosphere.getConfig()
    assert.equal(config.sound, 'quiet')
    assert.equal(config.isPlaying, false)
  })

  it('handles sound switching without throwing in headless environments', async () => {
    await focusAtmosphere.setSound('brown-noise', false)
    assert.equal(focusAtmosphere.getConfig().sound, 'brown-noise')

    await focusAtmosphere.setSound('gentle-rain', false)
    assert.equal(focusAtmosphere.getConfig().sound, 'gentle-rain')

    await focusAtmosphere.setSound('ambient-stream', false)
    assert.equal(focusAtmosphere.getConfig().sound, 'ambient-stream')

    await focusAtmosphere.setSound('pink-noise', false)
    assert.equal(focusAtmosphere.getConfig().sound, 'pink-noise')

    focusAtmosphere.stop()
    assert.equal(focusAtmosphere.getConfig().isPlaying, false)
  })
})
