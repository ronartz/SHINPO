import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const source = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')
const authCss = readFileSync(new URL('./views/auth.css', import.meta.url), 'utf8')
const classic = source.match(/^:root \{([\s\S]*?)^\}/m)?.[1] ?? ''

function token(name: string) {
  const value = classic.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]?.trim()
  assert.ok(value, `missing --${name}`)
  return value
}

function luminance(hex: string) {
  const rgb = hex.match(/[a-f\d]{2}/gi)?.map((channel) => Number.parseInt(channel, 16) / 255) ?? []
  assert.equal(rgb.length, 3, `invalid color ${hex}`)
  const linear = rgb.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

function contrast(foreground: string, background: string) {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (lighter + 0.05) / (darker + 0.05)
}

test('Classic dark uses the approved near-black and electric-lime palette', () => {
  assert.equal(token('palette-dark-background').toLowerCase(), '#020617')
  assert.equal(token('palette-dark-surface-1').toLowerCase(), '#0f172a')
  assert.equal(token('palette-dark-surface-2').toLowerCase(), '#1e293b')
  assert.equal(token('palette-dark-surface-3').toLowerCase(), '#1e293b')
  assert.equal(token('palette-dark-accent').toLowerCase(), '#14532d')
  assert.equal(token('palette-dark-primary').toLowerCase(), '#aff33e')
  assert.equal(token('palette-dark-on-primary').toLowerCase(), '#020617')
  assert.match(source, /--surface-card:\s*var\(--color-surface-1\)/)
  assert.equal(token('palette-dark-focus').toLowerCase(), '#aff33e')
  assert.equal(token('palette-dark-danger-surface').toLowerCase(), '#991b1b')
  for (const [name, expected] of Object.entries({
    'palette-dark-chart-1': '#aff33e',
    'palette-dark-chart-2': '#3b82f6',
    'palette-dark-chart-3': '#22c55e',
    'palette-dark-chart-4': '#a855f7',
    'palette-dark-chart-5': '#f59e0b',
  })) assert.equal(token(name).toLowerCase(), expected)
  assert.ok(contrast('#020617', '#AFF33E') >= 4.5)
  assert.ok(contrast('#F8FAFC', '#020617') >= 4.5)
  assert.ok(contrast(token('palette-dark-text-secondary'), token('palette-dark-surface-2')) >= 4.5)
  assert.ok(contrast(token('palette-dark-text-muted'), token('palette-dark-surface-1')) >= 4.5)
})

test('Classic light retains the warm canvas and uses an accessible lime-family action', () => {
  assert.equal(token('palette-light-background').toLowerCase(), '#f4ede0')
  assert.equal(token('palette-light-primary').toLowerCase(), '#4d7c0f')
  assert.equal(token('palette-light-accent').toLowerCase(), '#14532d')
  assert.ok(contrast('#FFFFFF', token('palette-light-primary')) >= 4.5)
  assert.ok(contrast('#14213D', token('palette-light-background')) >= 4.5)
  assert.ok(contrast(token('palette-light-text-secondary'), token('palette-light-surface-1')) >= 4.5)
  assert.ok(contrast(token('palette-light-text-muted'), token('palette-light-surface-1')) >= 4.5)
  assert.match(source, /html\[data-theme='light'\][\s\S]*?--color-danger:\s*#B91C1C/i)
})

test('Classic dashboard primary action uses accessible semantic foregrounds in both themes', () => {
  const dashboardCss = readFileSync(new URL('./views/overview-bento.css', import.meta.url), 'utf8')
  const primaryRule = dashboardCss.match(/\.btn-hero-action\.primary\s*\{([^}]+)\}/)?.[1] ?? ''
  const hoverRule = dashboardCss.match(/\.btn-hero-action\.primary:hover\s*\{([^}]+)\}/)?.[1] ?? ''
  assert.match(primaryRule, /background:\s*var\(--color-primary\)/)
  assert.match(primaryRule, /color:\s*var\(--color-on-primary\)/)
  assert.match(hoverRule, /background:\s*var\(--color-primary-hover\)/)
  assert.match(hoverRule, /color:\s*var\(--color-on-primary\)/)
  for (const [background, foreground] of [['#AFF33E', '#020617'], ['#4D7C0F', '#FFFFFF']]) {
    assert.ok(contrast(foreground, background) >= 4.5, `${foreground} on ${background} must meet WCAG AA`)
  }
})

test('Aurora keeps its independent identity tokens', () => {
  assert.match(source, /--aurora-dark-background:\s*#0B0F19/i)
  assert.match(source, /--aurora-dark-primary:\s*#9757FA/i)
  assert.match(source, /--aurora-light-primary:\s*#7C3AED/i)
  assert.match(source, /--palette-dark-chart-1:\s*var\(--aurora-dark-primary\)/i)
  assert.match(source, /--palette-light-chart-1:\s*var\(--aurora-light-primary\)/i)
})

test('authentication primary action uses semantic theme tokens instead of hard-coded blue', () => {
  assert.match(authCss, /\.auth-submit-btn\s*\{[^}]*background:\s*var\(--color-primary\)/s)
  assert.match(authCss, /\.auth-submit-btn\s*\{[^}]*color:\s*var\(--color-on-primary\)/s)
  assert.doesNotMatch(authCss, /\.auth-submit-btn\s*\{[^}]*#2563eb/i)
})
