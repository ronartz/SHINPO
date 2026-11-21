import test from 'node:test'
import assert from 'node:assert/strict'
import { createClassicMeshDriftConfig } from './classicMeshDriftConfig.ts'

test('Classic Mesh Drift uses the requested palettes and packs all shader uniforms', () => {
  const dark = createClassicMeshDriftConfig(1280, 720, 2, true)
  const light = createClassicMeshDriftConfig(960, 640, 3, false)

  assert.deepEqual(dark.colors.slice(0, 12), [
    2 / 255, 6 / 255, 23 / 255,
    15 / 255, 23 / 255, 42 / 255,
    20 / 255, 83 / 255, 45 / 255,
    175 / 255, 243 / 255, 62 / 255,
  ])
  assert.deepEqual(light.colors.slice(0, 12), [
    244 / 255, 237 / 255, 224 / 255,
    255 / 255, 249 / 255, 240 / 255,
    77 / 255, 124 / 255, 15 / 255,
    20 / 255, 83 / 255, 45 / 255,
  ])
  assert.equal(dark.colors.length, 24)
  assert.deepEqual(dark.scene, [1280, 720, 2 * 0.73, 4])
  assert.deepEqual(dark.shape, [1.10, 0.34, 0.50, 0.00])
  assert.deepEqual(dark.surface, [2.40, 0.96, -0.10, 0.96])
  assert.deepEqual(dark.finish, [0.00, 0.36, 0.026, 0.07])
  assert.deepEqual(dark.transform, [1453.0, 0.00, 0.00, 0.0])
  assert.deepEqual(dark.space, [0.00, 0.00, 0.00, 0.00])
  assert.deepEqual(dark.cursor, [0.00, 2.0, 0.65, 0.46])
  assert.deepEqual(light.scene, [960, 640, 3 * 0.73, 4])
})
