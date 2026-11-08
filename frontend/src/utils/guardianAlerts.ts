import type { GuardianObservation } from '../api/device'

const GUARDIAN_ALERT_FRESHNESS_MS = 30_000

export function takeRecentGuardianObservation(
  observations: GuardianObservation[],
  seenIds: Set<number>,
  now = Date.now(),
): GuardianObservation | undefined {
  let newestAlert: GuardianObservation | undefined
  for (const observation of observations) {
    if (seenIds.has(observation.id)) continue
    seenIds.add(observation.id)
    const age = now - Date.parse(observation.observedAt)
    if (
      !newestAlert && observation.outcome !== 'ALLOWED_BREAK' &&
      age >= 0 && age <= GUARDIAN_ALERT_FRESHNESS_MS
    ) newestAlert = observation
  }
  return newestAlert
}
