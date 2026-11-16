import type { FocusSession } from '../api/focusSessions'

export function getLiveFocusElapsedSeconds(session: FocusSession, remainingSeconds: number): number {
  const checkpoint = session.activeSeconds ?? session.focusActiveSeconds ?? 0
  if (session.status !== 'ACTIVE' || session.currentPhase !== 'FOCUS' || session.remainingSeconds == null) return checkpoint
  return checkpoint + Math.max(0, session.remainingSeconds - remainingSeconds)
}
