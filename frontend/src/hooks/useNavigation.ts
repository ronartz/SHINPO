import { useState, useCallback, useEffect } from 'react'
import type { AppView } from '../types/navigation'

const isAppView = (value: string): value is AppView =>
  value === 'Dashboard' ||
  value === 'Goals & Missions' ||
  value === 'Focus Engine' ||
  value === 'Schedule' ||
  value === 'Task Manager' ||
  value === 'Analytics' ||
  value === 'AI Assistant'

export function useNavigation(initialTab: AppView = 'Dashboard') {
  const [activeTab, setActiveTab] = useState<AppView>(() => {
    if (typeof window !== 'undefined') {
      const tab = new URLSearchParams(window.location.search).get('tab')
      if (tab && isAppView(tab)) return tab
    }
    return initialTab
  })

  const [sidebarExpanded, setSidebarExpanded] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth > 1000
    }
    return true
  })

  // Responsive sidebar auto-collapse
  useEffect(() => {
    let prevWidth = typeof window !== 'undefined' ? window.innerWidth : 1200
    const handleResize = () => {
      const currentWidth = window.innerWidth
      if (prevWidth > 1000 && currentWidth <= 1000) {
        setSidebarExpanded(false)
      } else if (prevWidth <= 1000 && currentWidth > 1000) {
        setSidebarExpanded(true)
      }
      prevWidth = currentWidth
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleSelectTab = useCallback((tab: AppView) => {
    setActiveTab(tab)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('tab', tab)
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  const handleToggleSidebar = useCallback(() => {
    setSidebarExpanded((prev) => !prev)
  }, [])

  return {
    activeTab,
    setActiveTab,
    sidebarExpanded,
    setSidebarExpanded,
    handleSelectTab,
    handleToggleSidebar,
  }
}

