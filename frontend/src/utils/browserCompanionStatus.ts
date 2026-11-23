export interface BrowserCompanionConnectionState {
  paired?: boolean
  connected?: boolean
  state?: string | null
}

/** A saved native-host token proves pairing data exists, not that a browser is connected. */
export function isBrowserCompanionConnected(status: BrowserCompanionConnectionState | null | undefined): boolean {
  return status?.connected === true || status?.state === 'CONNECTED'
}

export function isBrowserCompanionPairingSaved(status: BrowserCompanionConnectionState | null | undefined): boolean {
  return Boolean(status?.paired) || status?.state === 'PAIRING_SAVED' || status?.state === 'PAIRED' || isBrowserCompanionConnected(status)
}

export function browserCompanionStatusLabel(status: BrowserCompanionConnectionState | null | undefined): string {
  if (isBrowserCompanionConnected(status)) return 'Connected'
  if (isBrowserCompanionPairingSaved(status)) return 'Pairing saved · connection unverified'
  return 'Not paired'
}
