import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { classicMeshUniformColours } from './classicMeshPalette.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const style = (values: Record<string, string> = {}) => ({
  getPropertyValue: (name: string) => values[name] ?? '',
})

function rgbAt(values: Float32Array, offset: number): number[] {
  return Array.from(values.slice(offset * 3, offset * 3 + 3), (x) => Math.round(x * 255))
}

test('Classic dark mesh uses the existing navy, green and lime tokens', () => {
  const colours = classicMeshUniformColours('dark', style())
  assert.equal(colours.length, 24)
  assert.deepEqual(rgbAt(colours, 0), [2, 6, 23])
  assert.deepEqual(rgbAt(colours, 1), [15, 23, 42])
  assert.deepEqual(rgbAt(colours, 2), [20, 83, 45])
  assert.deepEqual(rgbAt(colours, 3), [175, 243, 62])
  assert.ok(Array.from(colours.slice(12)).every((value) => value === 0))
})

test('Classic light mesh switches to warm cream and readable olive-green colours', () => {
  const colours = classicMeshUniformColours('light', style())
  assert.deepEqual(rgbAt(colours, 0), [244, 237, 224])
  assert.deepEqual(rgbAt(colours, 1), [255, 249, 240])
  assert.deepEqual(rgbAt(colours, 2), [77, 124, 15])
  assert.deepEqual(rgbAt(colours, 3), [20, 83, 45])
})

test('Classic mesh honours current CSS tokens, using approved fallbacks for invalid values', () => {
  const colours = classicMeshUniformColours('dark', style({
    '--palette-dark-primary': '#3B82F6',
    '--palette-dark-accent': 'invalid',
  }))
  assert.deepEqual(rgbAt(colours, 3), [59, 130, 246])
  assert.deepEqual(rgbAt(colours, 2), [20, 83, 45])
})

test('the shader retains the supplied seven packed vectors, WebGL1 entry point and cursor off', () => {
  const shader = read('./meshDrift.frag')
  const renderer = read('./ClassicMeshDriftBackground.tsx')
  assert.match(shader, /uniform vec3 u_colors\[8\];/)
  for (const uniform of ['u_scene', 'u_shape', 'u_surface', 'u_finish', 'u_transform', 'u_space', 'u_cursor']) {
    assert.match(shader, new RegExp(`uniform vec4 ${uniform};`))
  }
  assert.match(renderer, /canvas\.getContext\('webgl'/)
  assert.match(renderer, /new Float32Array\(\[-1, -1, 3, -1, -1, 3\]\)/)
  assert.match(renderer, /Math\.min\(Math\.max\(window\.devicePixelRatio \|\| 1, 1\), 2\)/)
  assert.match(renderer, /packed\('u_cursor', 0\.00, 2\.0, 0\.65, 0\.46\)/)
  assert.match(renderer, /visibilitychange/)
  assert.match(renderer, /prefers-reduced-motion: reduce/)
})

test('mesh replaces Classic particles but leaves Aurora particles unchanged', () => {
  const app = read('../../apps/desktop/DesktopApp.tsx')
  const shell = read('../../styles/shell.css')
  assert.match(app, /isV2Preview \? <ShinpoParticles \/> : <ClassicMeshDriftBackground isDarkMode=\{isDarkMode\} \/>/)
  assert.match(shell, /\.app-shell:not\(\.theme-aurora\) > \.classic-mesh-drift/)
  assert.match(shell, /position: absolute;/)
})
