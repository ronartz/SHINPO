import type { FocusSession } from '../api/focusSessions'

/**
 * Calculates remaining seconds for a focus session using server-authoritative timing.
 *
 * Requirements:
 * 1. Countdown must exclude paused duration.
 * 2. PAUSED state must freeze at the correct remaining value.
 * 3. Resume must continue from that frozen value.
 * 4. Rerenders must not reset the countdown.
 * 5. Background-tab throttling must not introduce cumulative drift (anchored to wall-clock time).
 * 6. Refresh/reconnect must rehydrate from server-authoritative state.
 */
export function calculateRemainingSeconds(
  session: FocusSession | null | undefined,
  timerNowMs: number,
  fallbackDurationMinutes: number = 25,
): number {
  if (!session) {
    return Math.max(0, fallbackDurationMinutes * 60)
  }

  const totalBudgetSec = (session.durationMinutes ?? fallbackDurationMinutes) * 60

  // 1. Terminal states
  if (
    session.status === 'COMPLETED' ||
    session.status === 'CANCELLED' ||
    session.status === 'EXPIRED' ||
    session.status === 'FAILED'
  ) {
    return 0
  }

  // 2. PAUSED state: strictly freeze at the remaining seconds recorded at pause time
  if (session.status === 'PAUSED') {
    if (session.remainingSeconds !== undefined && session.remainingSeconds !== null) {
      return Math.max(0, session.remainingSeconds)
    }
    const activeSec = session.activeSeconds ?? 0
    return Math.max(0, totalBudgetSec - activeSec)
  }

  // 3. ACTIVE state:
  if (session.status === 'ACTIVE') {
    // Preferred server-authoritative path: anchor from serverTime + remainingSeconds
    if (
      session.serverTime &&
      session.remainingSeconds !== undefined &&
      session.remainingSeconds !== null
    ) {
      const serverAnchorMs = new Date(session.serverTime).getTime()
      if (!Number.isNaN(serverAnchorMs)) {
        const elapsedSinceServerMs = Math.max(0, timerNowMs - serverAnchorMs)
        const elapsedSinceSec = Math.max(0, Math.floor(elapsedSinceServerMs / 1000))
        return Math.max(0, session.remainingSeconds - elapsedSinceSec)
      }
    }

    // Secondary fallback: startedAt + accumulatedPausedSeconds
    if (session.startedAt) {
      const startedMs = new Date(session.startedAt).getTime()
      if (!Number.isNaN(startedMs)) {
        const totalElapsedSec = Math.max(0, Math.floor((timerNowMs - startedMs) / 1000))
        const pausedSec = session.accumulatedPausedSeconds ?? 0
        const activeSec = Math.max(0, totalElapsedSec - pausedSec)
        return Math.max(0, totalBudgetSec - activeSec)
      }
    }
  }

  // 4. SCHEDULED or standby state
  if (session.remainingSeconds !== undefined && session.remainingSeconds !== null) {
    return Math.max(0, session.remainingSeconds)
  }

  return totalBudgetSec
}

export function formatTimerDigits(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export interface PomodoroPlan {
  name: string
  totalMinutes: number
  schedule: string
}

export const durationPresets = [15, 30, 60, 90]

export const pomodoroPlans: PomodoroPlan[] = [
  {
    name: '55-Minute Focus',
    totalMinutes: 55,
    schedule: 'One continuous focus session',
  },
  {
    name: '60-Minute Focus',
    totalMinutes: 60,
    schedule: 'One continuous focus session',
  },
  {
    name: '90-Minute Focus',
    totalMinutes: 90,
    schedule: 'One continuous focus session',
  },
]
