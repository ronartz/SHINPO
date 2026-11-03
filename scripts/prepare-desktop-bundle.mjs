import { copyFile, mkdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const run = (command, args, cwd = root, options = {}) =>
  execFileSync(command, args, { cwd, stdio: 'inherit', ...options })

run('cargo', ['build', '--locked', '--release', '--manifest-path', 'crates/shinpo-browser-host/Cargo.toml'])
const suffix = process.platform === 'win32' ? '.exe' : ''
const hostSource = resolve(root, `crates/shinpo-browser-host/target/release/shinpo-browser-host${suffix}`)
const bundleInput = resolve(root, 'frontend/src-tauri/target/bundle-input')
await mkdir(bundleInput, { recursive: true })
await copyFile(hostSource, resolve(bundleInput, `shinpo-browser-host${suffix}`))
run(process.execPath, ['scripts/build.mjs'], resolve(root, 'browser-extension'))
run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], resolve(root, 'frontend'), {
  shell: process.platform === 'win32',
})
