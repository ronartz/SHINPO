export type TaskViewMode = 'list' | 'board'

const preferenceKey = (userId: number) => `shinpo_goals_task_view_v1_${userId}`

export function getTaskViewPreference(userId: number | null): TaskViewMode {
  if (userId === null) return 'list'
  try {
    const value = localStorage.getItem(preferenceKey(userId))
    return value === 'board' || value === 'list' ? value : 'list'
  } catch {
    return 'list'
  }
}

export function saveTaskViewPreference(userId: number | null, mode: TaskViewMode): void {
  if (userId === null) return
  try {
    localStorage.setItem(preferenceKey(userId), mode)
  } catch {
    // Keep the in-memory selection when browser storage is unavailable.
  }
}
