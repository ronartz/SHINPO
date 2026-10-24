import assert from 'node:assert/strict'
import { createReadStream } from 'node:fs'
import { stat, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join, basename } from 'node:path'
import { spawn } from 'node:child_process'

const source = process.argv[2]
assert.ok(source, 'Usage: node scripts/capture_reference_video.mjs /path/to/reference.mp4')
const info = await stat(source)
const captures = await mkdtemp(join(tmpdir(), `shinpo-reference-${basename(source, '.mp4')}-`))
const profile = await mkdtemp(join(tmpdir(), 'shinpo-reference-chrome-'))
const frames = join(captures, 'frames')
await mkdir(frames)
const server = createServer((request, response) => {
  if (request.url === '/source.mp4') {
    response.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': info.size, 'Cache-Control': 'no-store' })
    createReadStream(source).pipe(response)
    return
  }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  response.end('<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#050609}video{display:block;width:100%;height:100%;object-fit:contain}</style><video autoplay muted playsinline src="/source.mp4"></video>')
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
const debugPort = 9421
const chrome = spawn('google-chrome', [
  '--headless=new', `--remote-debugging-port=${debugPort}`, '--no-sandbox', '--disable-extensions',
  '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required',
  `--user-data-dir=${profile}`, `http://127.0.0.1:${port}/`,
], { stdio: 'ignore', detached: true })
let socket
let nextId = 1
let frameIndex = 0
let pendingWrites = []
const timestamps = []

try {
  let page
  for (let i = 0; i < 60 && !page; i++) {
    await new Promise((resolve) => setTimeout(resolve, 250))
    try {
      page = (await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((r) => r.json())).find((item) => item.type === 'page')
    } catch { /* Chromium is starting. */ }
  }
  assert.ok(page?.webSocketDebuggerUrl, 'Chromium did not open the local reference page')
  socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  const pending = new Map()
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    if (message.method === 'Page.screencastFrame') {
      const index = frameIndex++
      timestamps.push(message.params.metadata.timestamp)
      pendingWrites.push(writeFile(join(frames, `frame-${String(index).padStart(4, '0')}.png`), Buffer.from(message.params.data, 'base64')))
      socket.send(JSON.stringify({ id: nextId++, method: 'Page.screencastFrameAck', params: { sessionId: message.params.sessionId } }))
    }
    if (message.id && pending.has(message.id)) {
      const item = pending.get(message.id)
      pending.delete(message.id)
      message.error ? item.reject(new Error(message.error.message)) : item.resolve(message)
    }
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    assert.ok(!result.result.exceptionDetails, result.result.exceptionDetails?.text)
    return result.result.result.value
  }
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 720, height: 1280, deviceScaleFactor: 1, mobile: false })
  for (let i = 0; i < 40; i++) {
    if (await evaluate("document.querySelector('video')?.readyState >= 2 && Number.isFinite(document.querySelector('video').duration)")) break
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  const duration = await evaluate("document.querySelector('video').duration")
  assert.ok(duration > 0, 'Chromium could not decode the supplied reference clip')
  await send('Page.startScreencast', { format: 'png', maxWidth: 720, maxHeight: 1280, everyNthFrame: 1 })
  await evaluate("document.querySelector('video').play()")
  await new Promise((resolve) => setTimeout(resolve, Math.ceil(duration * 1000) + 500))
  await send('Page.stopScreencast')
  await Promise.all(pendingWrites)
  const manifest = { source, dimensions: [720, 1280], duration, decodedBy: 'Chromium', frames: frameIndex, timestamps }
  await writeFile(join(captures, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(JSON.stringify({ source, dimensions: manifest.dimensions, duration, decodedBy: manifest.decodedBy, frames: frameIndex, captures }, null, 2))
} finally {
  if (socket?.readyState === WebSocket.OPEN) socket.close()
  chrome.kill('SIGTERM')
  await new Promise((resolve) => {
    if (chrome.exitCode !== null) return resolve()
    const timeout = setTimeout(resolve, 1500)
    chrome.once('exit', () => {
      clearTimeout(timeout)
      resolve()
    })
  })
  await new Promise((resolve) => setTimeout(resolve, 200))
  server.close()
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}
