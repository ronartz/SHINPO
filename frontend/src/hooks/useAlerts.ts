import { useState, useCallback } from 'react'

export interface LiveAlertItem {
  id: string
  title: string
  description?: string
  type: 'sentinel' | 'focus' | 'quarantine' | 'info' | 'warning'
  timestamp: string
  actionLabel?: string
  onAction?: () => void
}

export function useAlerts() {
  const [liveAlerts, setLiveAlerts] = useState<LiveAlertItem[]>([])
  const [toastAlerts, setToastAlerts] = useState<LiveAlertItem[]>([])
  const [isAlertsDrawerOpen, setIsAlertsDrawerOpen] = useState(false)
  const [unreadAlertCount, setUnreadAlertCount] = useState(0)

  const pushToast = useCallback((alert: Omit<LiveAlertItem, 'id'> & { id?: string }) => {
    const item: LiveAlertItem = {
      ...alert,
      id: alert.id || `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: alert.timestamp || new Date().toISOString(),
    }
    setToastAlerts((prev) => [...prev.slice(-4), item])
    setLiveAlerts((prev) => [item, ...prev.slice(0, 49)])
    setUnreadAlertCount((prev) => prev + 1)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToastAlerts((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const toggleAlertsDrawer = useCallback(() => {
    setIsAlertsDrawerOpen((prev) => {
      const next = !prev
      if (next) setUnreadAlertCount(0)
      return next
    })
  }, [])

  const clearAlerts = useCallback(() => {
    setLiveAlerts([])
    setUnreadAlertCount(0)
  }, [])

  return {
    liveAlerts,
    setLiveAlerts,
    toastAlerts,
    setToastAlerts,
    isAlertsDrawerOpen,
    setIsAlertsDrawerOpen,
    unreadAlertCount,
    setUnreadAlertCount,
    pushToast,
    dismissToast,
    toggleAlertsDrawer,
    clearAlerts,
  }
}

