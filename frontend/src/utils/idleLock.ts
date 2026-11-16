export const LOCAL_VAULT_IDLE_LOCK_MS = 15 * 60 * 1000

export function isLocalVaultIdleLockDue(lastActivityAt: number, now: number): boolean {
  return Number.isFinite(lastActivityAt) && Number.isFinite(now) &&
    now - lastActivityAt >= LOCAL_VAULT_IDLE_LOCK_MS
}
