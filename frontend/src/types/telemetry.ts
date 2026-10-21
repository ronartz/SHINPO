export interface LiveAlertItem {
  id: string
  type: 'quarantine' | 'focus' | 'sentinel' | 'reward'
  title: string
  badge?: string
  description?: string
  timestamp: string
}

