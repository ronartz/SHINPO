import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const root = new URL('../', import.meta.url)
const chromium = JSON.parse(await readFile(new URL('manifests/chromium.json', root), 'utf8'))
const firefox = JSON.parse(await readFile(new URL('manifests/firefox.json', root), 'utf8'))
const tauri = JSON.parse(await readFile(new URL('../../frontend/src-tauri/tauri.conf.json', import.meta.url), 'utf8'))
const linuxRegistration = await readFile(new URL('../../scripts/register-browser-companion.sh', import.meta.url), 'utf8')
const windowsRegistration = await readFile(new URL('../../scripts/register-browser-companion.ps1', import.meta.url), 'utf8')

test('native host registrations use the extension IDs derived from packaged manifests', () => {
  const idBytes = createHash('sha256').update(Buffer.from(chromium.key, 'base64')).digest().subarray(0, 16)
  const chromiumId = [...idBytes].map((byte) =>
    String.fromCharCode(97 + (byte >> 4), 97 + (byte & 15)),
  ).join('')
  const firefoxId = firefox.browser_specific_settings.gecko.id

  assert.match(linuxRegistration, new RegExp(`chrome-extension://\\$\\{CHROMIUM_ID\\}/`))
  assert.match(windowsRegistration, new RegExp(`chrome-extension://${chromiumId}/`))
  assert.match(linuxRegistration, new RegExp(`\\$\\{FIREFOX_ID\\}`))
  assert.match(windowsRegistration, new RegExp(`allowed_extensions\\s*=\\s*@\\("${firefoxId.replaceAll('.', '\\.')}"\\)`))
  assert.doesNotMatch(linuxRegistration + windowsRegistration, /chrome-extension:\/\/\*/)
  for (const selector of ['--chrome', '--chromium', '--edge', '--brave', '--firefox', '--all']) {
    assert.ok(linuxRegistration.includes(selector), `missing Linux selector ${selector}`)
  }
  assert.match(linuxRegistration, /Choose a browser explicitly/)
  assert.match(linuxRegistration, /realpath/)
  assert.equal(chromiumId, 'ndknhgihhogcfkliohfjcllglpjdgjpj')
  assert.equal(firefoxId, 'browser-companion@shinpo.local')
})

test('Tauri bundles both browser builds and platform host-registration scripts', () => {
  const resources = tauri.bundle.resources
  assert.ok(Object.keys(resources).some((path) => path === 'target/bundle-input/*'))
  assert.ok(Object.keys(resources).some((path) => path.endsWith('browser-extension/dist/chromium/*')))
  assert.ok(Object.keys(resources).some((path) => path.endsWith('browser-extension/dist/firefox/*')))
  assert.ok(Object.keys(resources).some((path) => path.endsWith('register-browser-companion.sh')))
  assert.ok(Object.keys(resources).some((path) => path.endsWith('register-browser-companion.ps1')))
  assert.match(tauri.build.beforeBuildCommand, /prepare-desktop-bundle\.mjs/)
})
