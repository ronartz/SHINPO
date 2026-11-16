import { copyFile, mkdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const run = (command, args, cwd = root, options = {}) =>
  execFileSync(command, args, { cwd, stdio: 'inherit', ...options })

const hostManifest = resolve(root, 'crates/shinpo-browser-host/Cargo.toml')
const { target_directory: cargoTarget } = JSON.parse(
  execFileSync('cargo', ['metadata', '--no-deps', '--format-version', '1', '--manifest-path', hostManifest], {
    cwd: root,
    encoding: 'utf8',
  }),
)
if (!cargoTarget) throw new Error('Cargo did not report a target directory for the Browser Host')
run('cargo', ['build', '--locked', '--release', '--manifest-path', hostManifest])
const suffix = process.platform === 'win32' ? '.exe' : ''
const hostSource = resolve(cargoTarget, `release/shinpo-browser-host${suffix}`)
const bundleInput = resolve(root, 'frontend/src-tauri/target/bundle-input')
await mkdir(bundleInput, { recursive: true })
await copyFile(hostSource, resolve(bundleInput, `shinpo-browser-host${suffix}`))
run(process.execPath, ['scripts/build.mjs'], resolve(root, 'browser-extension'))
run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], resolve(root, 'frontend'), {
  shell: process.platform === 'win32',
})
