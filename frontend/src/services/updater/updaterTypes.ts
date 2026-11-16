export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'update-available'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'restart-required'
  | 'error'
  | 'unsupported-package'

export type ReleaseChannel = 'beta' | 'stable'

export type PackageType = 'appimage' | 'deb' | 'rpm' | 'nsis' | 'dev' | 'app' | 'unknown'

export interface LocalPackageInfo {
  os: string
  arch: string
  packageType: PackageType
  supportsInAppUpdate: boolean
  version: string
  channel: ReleaseChannel
}

export interface UpdateInfo {
  version: string
  currentVersion: string
  date?: string
  body?: string
  rawJson?: Record<string, unknown>
  contentLength?: number
}

export interface UpdateProgress {
  totalBytes?: number
  downloadedBytes: number
  percentage: number
  phase: 'downloading' | 'installing'
}

export interface UpdaterState {
  status: UpdateStatus
  channel: ReleaseChannel
  currentVersion: string
  availableUpdate: UpdateInfo | null
  packageInfo: LocalPackageInfo | null
  progress: UpdateProgress | null
  error: string | null
  lastCheckedAt: Date | null
  isDismissed: boolean
}

export type UpdaterListener = (state: UpdaterState) => void
