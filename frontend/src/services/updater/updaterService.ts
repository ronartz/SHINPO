import { check, type Update, type DownloadEvent } from '@tauri-apps/plugin-updater'
import { isTauriEnvironment, invokeTauriCommand } from '../../api/tauri.ts'
import type {
  LocalPackageInfo,
  ReleaseChannel,
  UpdateInfo,
  UpdaterListener,
  UpdaterState,
} from './updaterTypes.ts'

const CHANNEL_STORAGE_KEY = 'shinpo_update_channel'
const DISMISSED_VERSION_KEY = 'shinpo_update_dismissed_version'

export class UpdaterService {
  private state: UpdaterState = {
    status: 'idle',
    channel: 'beta',
    currentVersion: '0.1.0-beta.1',
    availableUpdate: null,
    packageInfo: null,
    progress: null,
    error: null,
    lastCheckedAt: null,
    isDismissed: false,
  }

  private listeners = new Set<UpdaterListener>()
  private currentUpdateResource: Update | null = null
  private isChecking = false
  private isDownloading = false
  private periodicIntervalId: ReturnType<typeof setInterval> | null = null
  private initialized = false

  constructor() {
    const savedChannel = typeof localStorage !== 'undefined'
      ? (localStorage.getItem(CHANNEL_STORAGE_KEY) as ReleaseChannel | null)
      : null
    if (savedChannel === 'beta' || savedChannel === 'stable') {
      this.state.channel = savedChannel
    }
  }

  public getState(): UpdaterState {
    return { ...this.state }
  }

  public subscribe(listener: UpdaterListener): () => void {
    this.listeners.add(listener)
    listener(this.getState())
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(): void {
    const currentState = this.getState()
    for (const listener of this.listeners) {
      try {
        listener(currentState)
      } catch (err) {
        console.error('[UpdaterService] Listener error:', err)
      }
    }
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return
    this.initialized = true

    await this.fetchPackageInfo()

    // Dismissal status check against saved storage
    const dismissedVersion = typeof localStorage !== 'undefined'
      ? localStorage.getItem(DISMISSED_VERSION_KEY)
      : null
    if (dismissedVersion && this.state.availableUpdate && this.state.availableUpdate.version === dismissedVersion) {
      this.state.isDismissed = true
    }

    // Schedule delayed startup update check (3 seconds non-blocking delay)
    if (typeof setTimeout !== 'undefined') {
      setTimeout(() => {
        void this.checkForUpdates(false).catch((err) => {
          console.debug('[UpdaterService] Startup check skipped or offline:', err)
        })
      }, 3000)
    }

    // Periodic check every 12 hours while running
    if (typeof setInterval !== 'undefined') {
      this.periodicIntervalId = setInterval(() => {
        void this.checkForUpdates(false).catch((err) => {
          console.debug('[UpdaterService] Periodic check skipped or offline:', err)
        })
      }, 12 * 60 * 60 * 1000)
    }
  }

  public destroy(): void {
    if (this.periodicIntervalId) {
      clearInterval(this.periodicIntervalId)
      this.periodicIntervalId = null
    }
    this.listeners.clear()
    if (this.currentUpdateResource) {
      void this.currentUpdateResource.close().catch(() => {})
      this.currentUpdateResource = null
    }
  }

  public async fetchPackageInfo(): Promise<LocalPackageInfo | null> {
    if (!isTauriEnvironment()) {
      const devInfo: LocalPackageInfo = {
        os: 'linux',
        arch: 'x86_64',
        packageType: 'dev',
        supportsInAppUpdate: false,
        version: this.state.currentVersion,
        channel: this.state.channel,
      }
      this.state.packageInfo = devInfo
      this.notify()
      return devInfo
    }

    try {
      const info = await invokeTauriCommand<LocalPackageInfo>('local_get_package_info')
      this.state.packageInfo = info
      this.state.currentVersion = info.version
      // If user hasn't explicitly overridden channel, follow native channel
      if (!localStorage.getItem(CHANNEL_STORAGE_KEY)) {
        this.state.channel = info.channel
      }
      this.notify()
      return info
    } catch (err) {
      console.warn('[UpdaterService] Could not fetch native package info:', err)
      return null
    }
  }

  public async setChannel(channel: ReleaseChannel): Promise<void> {
    if (this.state.channel === channel) return
    this.state.channel = channel
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CHANNEL_STORAGE_KEY, channel)
    }
    this.state.availableUpdate = null
    this.state.status = 'idle'
    this.state.error = null
    this.notify()
    await this.checkForUpdates(true)
  }

  public dismissNotification(): void {
    this.state.isDismissed = true
    if (typeof localStorage !== 'undefined' && this.state.availableUpdate) {
      localStorage.setItem(DISMISSED_VERSION_KEY, this.state.availableUpdate.version)
    }
    this.notify()
  }

  public async checkForUpdates(manual = false): Promise<UpdateInfo | null> {
    if (this.isChecking) {
      return this.state.availableUpdate
    }

    if (this.isDownloading) {
      return this.state.availableUpdate
    }

    this.isChecking = true
    this.state.status = 'checking'
    this.state.error = null
    this.notify()

    try {
      if (!isTauriEnvironment()) {
        // Non-Tauri fallback for development/testing
        await new Promise((r) => setTimeout(r, 600))
        this.state.status = 'up-to-date'
        this.state.lastCheckedAt = new Date()
        this.isChecking = false
        this.notify()
        return null
      }

      // Check endpoints according to selected channel
      const update = await check({
        timeout: 10000,
      })

      this.state.lastCheckedAt = new Date()

      if (!update) {
        this.state.status = 'up-to-date'
        this.state.availableUpdate = null
        if (this.currentUpdateResource) {
          await this.currentUpdateResource.close().catch(() => {})
          this.currentUpdateResource = null
        }
        this.isChecking = false
        this.notify()
        return null
      }

      // We have an update
      if (this.currentUpdateResource && this.currentUpdateResource !== update) {
        await this.currentUpdateResource.close().catch(() => {})
      }
      this.currentUpdateResource = update

      const updateInfo: UpdateInfo = {
        version: update.version,
        currentVersion: update.currentVersion,
        date: update.date,
        body: update.body,
        rawJson: update.rawJson,
      }

      this.state.availableUpdate = updateInfo

      // Check if current platform supports in-app updates
      const pkgInfo = this.state.packageInfo || (await this.fetchPackageInfo())
      if (pkgInfo && !pkgInfo.supportsInAppUpdate) {
        // Platform requires external update (e.g. DEB/RPM/dev)
        this.state.status = 'unsupported-package'
      } else {
        this.state.status = 'update-available'
      }

      // Reset dismissed state if this is a newer version than previously dismissed
      const dismissedVersion = typeof localStorage !== 'undefined'
        ? localStorage.getItem(DISMISSED_VERSION_KEY)
        : null
      if (dismissedVersion !== update.version) {
        this.state.isDismissed = false
      }

      this.isChecking = false
      this.notify()
      return updateInfo
    } catch (err: unknown) {
      console.warn('[UpdaterService] Update check failed:', err)
      this.isChecking = false
      const message = err instanceof Error ? err.message : String(err)
      this.state.error = message
      this.state.status = manual ? 'error' : (this.state.availableUpdate ? 'update-available' : 'idle')
      this.notify()
      return null
    }
  }

  public async downloadAndInstall(): Promise<void> {
    if (this.isDownloading) return

    if (!this.currentUpdateResource) {
      throw new Error('No update is staged for download.')
    }

    const pkgInfo = this.state.packageInfo
    if (pkgInfo && !pkgInfo.supportsInAppUpdate) {
      throw new Error(`In-app update is not supported for ${pkgInfo.packageType} installations. Please use your package manager.`)
    }

    this.isDownloading = true
    this.state.status = 'downloading'
    this.state.error = null
    this.state.progress = {
      downloadedBytes: 0,
      percentage: 0,
      phase: 'downloading',
    }
    this.notify()

    try {
      let totalLength: number | undefined
      let downloaded = 0

      await this.currentUpdateResource.downloadAndInstall((event: DownloadEvent) => {
        if (event.event === 'Started') {
          totalLength = event.data.contentLength
          this.state.progress = {
            totalBytes: totalLength,
            downloadedBytes: 0,
            percentage: 0,
            phase: 'downloading',
          }
          this.notify()
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength
          const percentage = totalLength && totalLength > 0
            ? Math.min(100, Math.round((downloaded / totalLength) * 100))
            : 0
          this.state.progress = {
            totalBytes: totalLength,
            downloadedBytes: downloaded,
            percentage,
            phase: 'downloading',
          }
          this.notify()
        } else if (event.event === 'Finished') {
          this.state.status = 'installing'
          this.state.progress = {
            totalBytes: totalLength,
            downloadedBytes: downloaded,
            percentage: 100,
            phase: 'installing',
          }
          this.notify()
        }
      })

      // Update installation completed successfully
      this.isDownloading = false
      this.state.status = 'restart-required'
      this.state.progress = null
      this.notify()
    } catch (err: unknown) {
      this.isDownloading = false
      const message = err instanceof Error ? err.message : String(err)
      console.error('[UpdaterService] Download and install failed:', err)
      this.state.status = 'error'
      this.state.error = message
      this.state.progress = null
      this.notify()
      throw err
    }
  }

  public async hasActiveFocusSession(): Promise<boolean> {
    if (!isTauriEnvironment()) return false
    try {
      const active = await invokeTauriCommand<{ status?: string } | null>('local_get_active_focus_session')
      return Boolean(active && (active.status === 'ACTIVE' || active.status === 'PAUSED'))
    } catch {
      return false
    }
  }

  public async restartApp(force = false): Promise<void> {
    if (!force) {
      const inFocus = await this.hasActiveFocusSession()
      if (inFocus) {
        throw new Error('ACTIVE_FOCUS_IN_PROGRESS')
      }
    }

    if (isTauriEnvironment()) {
      await invokeTauriCommand('desktop_restart_app')
    } else {
      console.info('[UpdaterService] Desktop restart simulated in web environment.')
    }
  }
}

export const updaterService = new UpdaterService()
