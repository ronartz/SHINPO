import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const url = process.env.SHINPO_PERF_URL
assert(url && new URL(url).hostname === '127.0.0.1', 'Use a loopback-only production preview URL')
const origin = new URL(url).origin

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const samples = []

for (let sample = 0; sample < 3; sample++) {
  const port = 9441 + sample
  const profile = mkdtempSync(join(tmpdir(), 'shinpo-perf-profile-'))
  const chrome = spawn('google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, url,
  ], { stdio: 'ignore' })
  let socket

  try {
    let page
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json())
          .find((target) => target.type === 'page')
        if (page?.webSocketDebuggerUrl) break
      } catch {}
      await sleep(100)
    }
    assert(page?.webSocketDebuggerUrl, 'Chrome did not expose its page target')

    socket = new WebSocket(page.webSocketDebuggerUrl)
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true })
      socket.addEventListener('error', reject, { once: true })
    })
    let commandId = 0
    const pending = new Map()
    socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data)
      if (message.id && pending.has(message.id)) {
        pending.get(message.id)(message)
        pending.delete(message.id)
      }
    })
    const send = (method, params = {}) => new Promise((resolve) => {
      const id = ++commandId
      pending.set(id, resolve)
      socket.send(JSON.stringify({ id, method, params }))
    })
    await send('Runtime.enable')
    await send('Page.enable')
    await send('Page.navigate', { url })

    let metrics
    for (let attempt = 0; attempt < 200; attempt++) {
      const response = await send('Runtime.evaluate', {
        expression: `(() => {
          const navigation = performance.getEntriesByType('navigation')[0]
          if (!navigation || document.readyState !== 'complete') return ''
          return JSON.stringify({
            href: location.href,
            domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd),
            loadMs: Math.round(navigation.loadEventEnd),
            javascriptTransferBytes: performance.getEntriesByType('resource')
              .filter((entry) => entry.name.includes('/assets/') && entry.name.includes('.js'))
              .reduce((total, entry) => total + entry.transferSize, 0),
          })
        })()`,
        returnByValue: true,
      })
      const value = response.result?.result?.value
      if (value && JSON.parse(value).href.startsWith(origin)) {
        metrics = JSON.parse(value)
        break
      }
      await sleep(50)
    }
    assert(metrics?.javascriptTransferBytes > 0 && metrics.domContentLoadedMs > 0, `Production app did not render measurable JavaScript and DOM readiness: ${JSON.stringify(metrics)}`)
    samples.push(metrics)
  } finally {
    socket?.close()
    chrome.kill('SIGTERM')
    await new Promise((resolve) => chrome.once('exit', resolve))
    rmSync(profile, { recursive: true, force: true })
  }
}

console.log(JSON.stringify({ url, samples }, null, 2))
