export interface LiveAlertItem {
  id: string
  type: 'quarantine' | 'focus' | 'sentinel'
  title: string
  badge?: string
  description?: string
  timestamp: string
}

