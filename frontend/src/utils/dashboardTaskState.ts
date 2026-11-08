import type { Mission } from '../api/goalsAndMissions'

export function getDashboardTaskState(missions: Mission[]) {
  const completed = missions.filter((mission) => mission.status === 'COMPLETED').length
  return {
    total: missions.length,
    completed,
    remaining: missions.length - completed,
    state: missions.length === 0 ? 'EMPTY' as const : completed === missions.length ? 'COMPLETE' as const : 'IN_PROGRESS' as const,
  }
}
