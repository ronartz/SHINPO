import React, { useState, useEffect } from 'react'
import './styles/mobile.css'
import { MobileNav, type MobileTab } from './components/MobileNav'
import { MobileHeader } from './components/MobileHeader'
import {
  MobileOverviewView,
  MobileFocusView,
  MobileGoalsView,
  MobileSettingsView,
} from './views'

interface MobileAppProps {
  onSwitchToDesktop?: () => void
}

export const MobileApp: React.FC<MobileAppProps> = ({ onSwitchToDesktop }) => {
  const [activeTab, setActiveTab] = useState<MobileTab>('overview')
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
  })
  const [brand, setBrand] = useState<'aurora' | 'classic'>(() => {
    return document.documentElement.getAttribute('data-brand') === 'classic' ? 'classic' : 'aurora'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-platform', 'mobile')
  }, [])

  const handleToggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem('shinpo_theme', next)
    } catch {
      // ignore
    }
  }

  const handleToggleBrand = () => {
    const next = brand === 'aurora' ? 'classic' : 'aurora'
    setBrand(next)
    document.documentElement.setAttribute('data-brand', next)
    try {
      localStorage.setItem('shinpo_v2_preview', next === 'aurora' ? 'true' : 'false')
    } catch {
      // ignore
    }
  }

  const getHeaderTitle = (tab: MobileTab): string => {
    switch (tab) {
      case 'overview':
        return 'Dashboard'
      case 'focus':
        return 'Focus'
      case 'goals':
        return 'Goals & Tasks'
      case 'settings':
        return 'Settings'
    }
  }

  return (
    <div className="shinpo-mobile-app">
      <MobileHeader
        title={getHeaderTitle(activeTab)}
        isDark={theme === 'dark'}
        onToggleTheme={handleToggleTheme}
      />

      <main className="shinpo-mobile-content">
        {activeTab === 'overview' && (
          <MobileOverviewView
            onStartFocus={() => setActiveTab('focus')}
            onNavigateToGoals={() => setActiveTab('goals')}
          />
        )}
        {activeTab === 'focus' && <MobileFocusView />}
        {activeTab === 'goals' && <MobileGoalsView />}
        {activeTab === 'settings' && (
          <MobileSettingsView
            brand={brand}
            theme={theme}
            onToggleBrand={handleToggleBrand}
            onToggleTheme={handleToggleTheme}
            onSwitchToDesktop={() => {
              if (onSwitchToDesktop) {
                onSwitchToDesktop()
              } else {
                localStorage.setItem('shinpo_platform', 'desktop')
                window.location.search = '?platform=desktop'
              }
            }}
          />
        )}
      </main>

      <MobileNav activeTab={activeTab} onSelectTab={setActiveTab} />
    </div>
  )
}

export default MobileApp
