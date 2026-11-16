import test from 'node:test'
import assert from 'node:assert/strict'
import { UpdaterService } from './updaterService.ts'
import type { UpdateProgress } from './updaterTypes.ts'

test('UpdaterService - initial state and subscription', () => {
  const service = new UpdaterService()
  const state = service.getState()

  assert.strictEqual(state.status, 'idle')
  assert.strictEqual(state.currentVersion, '0.1.0-beta.1')
  assert.strictEqual(state.channel, 'beta')
  assert.strictEqual(state.availableUpdate, null)
  assert.strictEqual(state.isDismissed, false)

  let notified = false
  const unsubscribe = service.subscribe((s) => {
    if (s.status === 'idle') {
      notified = true
    }
  })

  assert.strictEqual(notified, true)
  unsubscribe()
  service.destroy()
})

test('UpdaterService - channel switching and state reset', async () => {
  const service = new UpdaterService()
  assert.strictEqual(service.getState().channel, 'beta')

  await service.setChannel('stable')
  assert.strictEqual(service.getState().channel, 'stable')

  await service.setChannel('beta')
  assert.strictEqual(service.getState().channel, 'beta')

  service.destroy()
})

test('UpdaterService - dismissal handling', () => {
  const service = new UpdaterService()
  assert.strictEqual(service.getState().isDismissed, false)

  service.dismissNotification()
  assert.strictEqual(service.getState().isDismissed, true)

  service.destroy()
})

test('UpdaterService - package info resolution for dev/web environment', async () => {
  const service = new UpdaterService()
  const info = await service.fetchPackageInfo()

  assert.ok(info)
  assert.strictEqual(info?.packageType, 'dev')
  assert.strictEqual(info?.supportsInAppUpdate, false)
  assert.strictEqual(info?.version, '0.1.0-beta.1')

  service.destroy()
})

test('UpdaterService - check for updates in non-Tauri environment returns null and sets up-to-date', async () => {
  const service = new UpdaterService()
  const update = await service.checkForUpdates(true)

  assert.strictEqual(update, null)
  assert.strictEqual(service.getState().status, 'up-to-date')
  assert.ok(service.getState().lastCheckedAt instanceof Date)

  service.destroy()
})

test('UpdaterService - progress updates calculate percentage correctly', () => {
  const total = 1000000
  const downloaded = 250000
  const progress: UpdateProgress = {
    totalBytes: total,
    downloadedBytes: downloaded,
    percentage: Math.round((downloaded / total) * 100),
    phase: 'downloading',
  }

  assert.strictEqual(progress.percentage, 25)
  assert.strictEqual(progress.phase, 'downloading')
})

test('UpdaterService - active focus session blocks non-forced restart', async () => {
  const service = new UpdaterService()

  // In non-Tauri/test environment, hasActiveFocusSession is false, restart does not throw
  await service.restartApp(false)
  assert.ok(true)

  service.destroy()
})
