import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, lstatSync, readdirSync, existsSync } from 'node:fs'
import net from 'node:net'
import { tmpdir, homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const frontendDir = path.resolve(__dirname, '..')

const profile = mkdtempSync(path.join(tmpdir(), 'shinpo-native-wdio-'))
if (lstatSync(profile).isSymbolicLink() || readdirSync(profile).length !== 0) {
  throw new Error('Refusing to use a non-empty or symlinked QA profile')
}

const data = path.join(profile, 'data')
const config = path.join(profile, 'config')
const cache = path.join(profile, 'cache')
const evidence = path.join(profile, 'evidence')
// Keep the clock fixture under XDG_DATA_HOME so the native runtime's isolated
// sandbox can read it alongside the disposable vault.
for (const dir of [data, config, cache, evidence]) mkdirSync(dir, { mode: 0o700 })

const isListening = (port) => new Promise((resolve, reject) => {
  const socket = net.connect({ host: '127.0.0.1', port })
  socket.setTimeout(500)
  socket.once('connect', () => { socket.destroy(); resolve(true) })
  socket.once('timeout', () => { socket.destroy(); resolve(false) })
  socket.once('error', (error) => error.code === 'ECONNREFUSED' ? resolve(false) : reject(error))
})

for (const port of [8080, 5432]) {
  if (await isListening(port)) throw new Error(`Refusing test: backend port ${port} is listening`)
}

const userDriver = path.join(homedir(), '.local/bin/WebKitWebDriver')
const webkitFallback = '/tmp/shinpo-warp-driver/root/usr/bin/WebKitWebDriver'
const webkitDriverPath = process.env.WEBKIT_WEBDRIVER_PATH || (existsSync(userDriver) ? userDriver : (existsSync(webkitFallback) ? webkitFallback : 'WebKitWebDriver'))

const env = {
  ...process.env,
  WEBKIT_WEBDRIVER_PATH: webkitDriverPath,
  XDG_DATA_HOME: data,
  XDG_CONFIG_HOME: config,
  XDG_CACHE_HOME: cache,
  SHINPO_TAURI_QA_PROFILE: profile,
  SHINPO_TAURI_EVIDENCE_DIR: evidence,
}

console.log(`Disposable Tauri profile: ${profile}`)
console.log(`Expected vault directory: ${path.join(data, 'com.shinpo.app', 'vaults')}`)
console.log(`Evidence directory: ${evidence}`)
console.log(`WebKitWebDriver path: ${webkitDriverPath}`)
console.log('Spring Boot/PostgreSQL preflight: ports 8080 and 5432 are not listening')

const child = spawn('npx', ['wdio', 'run', 'wdio.tauri.conf.js', ...process.argv.slice(2)], {
  cwd: frontendDir,
  env,
  stdio: 'inherit',
})
child.on('error', (error) => {
  console.error(`Could not start WebdriverIO: ${error.message}`)
  process.exitCode = 1
})
child.on('exit', (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1)
})
