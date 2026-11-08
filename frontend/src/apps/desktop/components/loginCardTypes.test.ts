import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_LOGIN_VIEW_MODE,
  LOGIN_VIEW_MODE_STORAGE_KEY,
} from './loginCardTypes.ts'
import {
  DEFAULT_LOGIN_BACKGROUND_MODE,
} from './silkShaderMath.ts'

describe('Desktop Login View & Card Mode Contracts', () => {
  it('defaults to animated reference-style login card', () => {
    assert.equal(DEFAULT_LOGIN_VIEW_MODE, 'animated-login')
    assert.equal(LOGIN_VIEW_MODE_STORAGE_KEY, 'shinpo_login_view_mode')
  })

  it('defaults to interactive silk mesh background', () => {
    assert.equal(DEFAULT_LOGIN_BACKGROUND_MODE, 'silk-mesh')
  })

  it('defines valid view mode identifiers for presentation switching', () => {
    const validModes = ['animated-login', 'legacy-login']
    assert.ok(validModes.includes(DEFAULT_LOGIN_VIEW_MODE))
  })
})
