import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { wsClient } from './websocket.ts'
import { getBackendBaseUrl, getWsBaseUrl } from './config.ts'
import { apiClient } from './client.ts'

const frontendRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const sourceRoot = resolve(frontendRoot, 'src')
const configPath = resolve(frontendRoot, 'src-tauri/tauri.conf.json')

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'scripts' || entry.name === 'dev') return []
      return sourceFiles(path)
    }
    return /\.(ts|tsx|css)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name) ? [path] : []
  }))
  return files.flat()
}

describe('standalone WebView network boundary', () => {
  it('keeps production CSP network access limited to Tauri IPC', async () => {
    const config = JSON.parse(await readFile(configPath, 'utf8'))
    const production = config.app.security.csp as Record<string, string>
    const development = config.app.security.devCsp as Record<string, string>

    assert.equal(production['connect-src'], 'ipc: http://ipc.localhost')
    assert.equal(development['connect-src'], 'ipc: http://ipc.localhost ws://localhost:5173')
    for (const policy of [production, development]) {
      assert.ok(Object.values(policy).every((value) => !/(^|\s)\*(?=\s|$)/.test(value)))
    }
  })

  it('keeps frontend network primitives centralized and standalone sockets disabled', async () => {
    const files = await sourceFiles(sourceRoot)
    const violations: string[] = []
    const directNetwork = /\bfetch\s*\(|\bnew\s+(?:WebSocket|EventSource)\s*\(|\bXMLHttpRequest\b|\baxios\s*(?:\.|\()/
    const networkClientImport = /(?:from\s*|import\s*\()\s*['"](?:axios|ky|got|node-fetch|cross-fetch|eventsource|socket\.io-client|ws)['"]/
    const externalCssResource = /(?:url\(\s*['"]?https?:|@import\s+(?:url\()?['"]?https?:)/i

    for (const file of files) {
      const source = await readFile(file, 'utf8')
      const rel = relative(sourceRoot, file)
      for (const [pattern, label] of [[directNetwork, 'direct network API'], [networkClientImport, 'network client import'], [externalCssResource, 'external CSS resource']] as const) {
        if (pattern.test(source) && !(rel === 'api/config.ts' && label === 'direct network API')) {
          violations.push(`${rel}: ${label}`)
        }
      }
    }
    assert.deepEqual(violations, [])

    const websocket = await readFile(resolve(sourceRoot, 'api/websocket.ts'), 'utf8')
    const localGuard = websocket.indexOf('if (isTauriEnvironment() || isLocalVaultSession())')
    const stompClient = websocket.indexOf('this.client = new Client(')
    assert.ok(localGuard >= 0 && stompClient > localGuard, 'local-vault guard must precede STOMP client creation')
  })

  it('rejects the shared HTTP client and server URLs in Tauri before fetch', async () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    const originalFetch = globalThis.fetch
    let fetchCalled = false
    globalThis.fetch = async () => { fetchCalled = true; throw new Error('unexpected fetch') }
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { __TAURI_INTERNALS__: {} } })
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null, removeItem: () => undefined } })
    try {
      assert.equal(getBackendBaseUrl(), '')
      assert.equal(getWsBaseUrl(), '')
      await assert.rejects(apiClient.get('/goals'), /not yet connected to the local vault/)
      assert.equal(fetchCalled, false)
    } finally {
      globalThis.fetch = originalFetch
      if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
      else Reflect.deleteProperty(globalThis, 'window')
      if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
      else Reflect.deleteProperty(globalThis, 'localStorage')
    }
  })

  it('does not create a STOMP connection for a locked Tauri window', () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { __TAURI_INTERNALS__: {} } })
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: () => null },
    })
    try {
      wsClient.connect(7)
      assert.equal(wsClient.getCurrentUserId(), null)
      assert.equal(wsClient.isConnectingToBroker(), false)
      assert.equal(wsClient.isConnected(), false)
    } finally {
      wsClient.disconnect()
      if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
      else Reflect.deleteProperty(globalThis, 'window')
      if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
      else Reflect.deleteProperty(globalThis, 'localStorage')
    }
  })

  it('does not load remote fonts or other external HTML resources', async () => {
    const html = await readFile(resolve(frontendRoot, 'index.html'), 'utf8')
    assert.doesNotMatch(html, /https?:\/\//i)
    assert.doesNotMatch(html, /<link[^>]+(?:preconnect|stylesheet)[^>]+href=['"]https?:/i)
  })
})
