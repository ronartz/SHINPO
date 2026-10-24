import React, { useEffect, useRef, useState } from 'react'
import type { AppView } from '../../types/navigation'
import { getViewHeaderTitle, NAVIGATION_ITEMS } from '../../types/navigation'
import { Icon } from '../common/Icon'
import type { AuthUser } from '../../api/auth'
import type { ProgressResponse } from '../../api/progress'
import type { SettingsSection } from '../dialogs/SettingsModal'

export interface TopBarProps {
  activeTab: AppView
  onSelectTab: (tab: AppView) => void
  topSearchQuery: string
  onSearchChange: (query: string) => void
  searchInputRef?: React.RefObject<HTMLInputElement | null>
  unreadAlertCount: number
  isAlertsDrawerOpen: boolean
  onToggleAlertsDrawer: () => void
  isDarkMode: boolean
  onToggleTheme: () => void
  onRefreshData: () => void
  isRefreshing?: boolean
  onOpenSettings: (section?: SettingsSection) => void
  currentUser: AuthUser | null
  userProgress: ProgressResponse | null
  onLogout: () => void
  onToggleV2Preview?: () => void
  isV2Preview?: boolean
}

import { trackRender } from '../../utils/renderTracker'

export const TopBar: React.FC<TopBarProps> = React.memo(({
  activeTab,
  onSelectTab,
  topSearchQuery,
  onSearchChange,
  searchInputRef,
  unreadAlertCount,
  isAlertsDrawerOpen,
  onToggleAlertsDrawer,
  isDarkMode: _isDarkMode,
  onToggleTheme: _onToggleTheme,
  onRefreshData,
  isRefreshing = false,
  onOpenSettings,
  currentUser,
  userProgress,
  onLogout,
  onToggleV2Preview: _onToggleV2Preview,
  isV2Preview: _isV2Preview,
}) => {
  trackRender('TopBar')
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)
  const mobileNavigationControlRef = useRef<HTMLDivElement>(null)
  useEffect(() => setMobileNavigationOpen(false), [activeTab])
  useEffect(() => {
    if (!mobileNavigationOpen) return
    mobileNavigationControlRef.current?.querySelector<HTMLElement>(`[data-mobile-nav-tab="${activeTab}"]`)?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setMobileNavigationOpen(false)
      mobileNavigationControlRef.current?.querySelector<HTMLButtonElement>('.mobile-nav-toggle')?.focus()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [activeTab, mobileNavigationOpen])

  return (
    <header className="cockpit-top-bar" role="banner">
      <div className="page-header-info">
        <div className="mobile-nav-control" ref={mobileNavigationControlRef} onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setMobileNavigationOpen(false)
        }}>
          <button
            type="button"
            className="mobile-nav-toggle"
            aria-label={mobileNavigationOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileNavigationOpen}
            aria-controls="mobile-navigation-panel"
            onClick={() => setMobileNavigationOpen((open) => !open)}
          >
            <Icon name={mobileNavigationOpen ? 'close' : 'menu'} size={17} />
          </button>
          {mobileNavigationOpen && (
            <nav id="mobile-navigation-panel" className="mobile-navigation-panel" aria-label="Main navigation">
              {NAVIGATION_ITEMS.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`mobile-navigation-item${activeTab === item.id ? ' active' : ''}`}
                  data-mobile-nav-tab={item.id}
                  aria-current={activeTab === item.id ? 'page' : undefined}
                  onClick={() => onSelectTab(item.id)}
                >
                  <Icon name={item.icon} size={17} />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          )}
        </div>
        <h1 className="top-brand-title">
          {getViewHeaderTitle(activeTab)}
        </h1>
      </div>

      {/* Centered Search Input */}
      <div className="top-search-command" role="search">
        <Icon name="search" size={15} />
        <input
          ref={searchInputRef}
          type="text"
          className="top-search-input"
          placeholder="Search tasks, goals, or sessions..."
          value={topSearchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Global search"
        />
        <button
          type="button"
          className="top-search-filter-btn"
          title={topSearchQuery ? 'Clear search' : 'Search filter'}
          onClick={() => {
            if (topSearchQuery) onSearchChange('')
          }}
          aria-label={topSearchQuery ? 'Clear search' : 'Search filter'}
        >
          <Icon name={topSearchQuery ? 'close' : 'sparkle'} size={13} />
        </button>
      </div>

      <div className="top-bar-actions">
        <button
          className={`action-btn-circle ${unreadAlertCount > 0 ? 'has-badge' : ''} ${isAlertsDrawerOpen ? 'active' : ''}`}
          title="Notifications & Activity"
          onClick={onToggleAlertsDrawer}
          aria-label="Notifications"
        >
          <Icon name="bell" size={17} />
          {unreadAlertCount > 0 && <span className="bell-red-dot" />}
        </button>
        <button
          className={`action-btn-circle ${isRefreshing ? 'is-spinning' : ''}`}
          onClick={onRefreshData}
          disabled={isRefreshing}
          title={isRefreshing ? 'Synchronizing with cloud...' : 'Refresh Data'}
          aria-label="Refresh Data"
        >
          <Icon name="refresh" size={16} />
        </button>
        <button
          className="action-btn-circle"
          onClick={() => onOpenSettings('appearance')}
          title="Settings"
          aria-label="Settings"
          data-tutorial="topbar-settings-btn"
        >
          <Icon name="settings" size={17} />
        </button>
        {currentUser && (
          <button
            type="button"
            className="profile-badge-card"
            data-tutorial="profile-badge-card"
            onClick={() => onOpenSettings('account')}
            title={`Account settings for ${currentUser.username}`}
            aria-label={`Account settings for ${currentUser.username}`}
          >
            <span className="profile-avatar-circle" aria-hidden="true">
              {currentUser.username.charAt(0).toUpperCase()}
            </span>
            <span className="profile-text-wrap">
              <span className="profile-username">{currentUser.username}</span>
              <span className="profile-role">
                {userProgress ? `Lvl ${userProgress.level} • ${userProgress.totalProgress} XP` : 'Account settings'}
              </span>
            </span>
          </button>
        )}
        <button
          className="action-btn-circle"
          onClick={onLogout}
          title="Sign Out"
          aria-label="Sign Out"
        >
          <Icon name="power" size={15} />
        </button>
      </div>
    </header>
  )
})

