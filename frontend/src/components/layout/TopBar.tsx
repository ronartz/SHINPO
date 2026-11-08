import React, { useEffect, useRef, useState } from 'react'
import type { AppView } from '../../types/navigation'
import { getViewHeaderTitle, NAVIGATION_ITEMS } from '../../types/navigation'
import { Icon } from '../common/Icon'
import type { AuthUser } from '../../api/auth'
import type { ProgressResponse } from '../../api/progress'
import type { SettingsSection } from '../dialogs/SettingsModal'
import { AccountDropdown } from './AccountDropdown'
import { PowerDropdown } from './PowerDropdown'

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
  isFocusActive?: boolean
  onStartTutorial?: () => void
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
  onLogout,
  onToggleV2Preview: _onToggleV2Preview,
  isV2Preview: _isV2Preview,
  isFocusActive = false,
  onStartTutorial,
}) => {
  trackRender('TopBar')
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const [isPowerMenuOpen, setIsPowerMenuOpen] = useState(false)
  const mobileNavigationControlRef = useRef<HTMLDivElement>(null)
  const profileButtonRef = useRef<HTMLButtonElement>(null)
  const powerButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setMobileNavigationOpen(false)
    setIsAccountMenuOpen(false)
    setIsPowerMenuOpen(false)
  }, [activeTab])
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
          title={isRefreshing ? 'Refreshing data…' : 'Refresh data'}
          aria-label="Refresh Data"
        >
          <Icon name="refresh" size={16} />
        </button>
        {currentUser && (
          <div className="topbar-menu-anchor">
            <button
              ref={profileButtonRef}
              type="button"
              className={`profile-badge-card ${isAccountMenuOpen ? 'is-active' : ''}`}
              data-tutorial="profile-badge-card"
              onClick={() => {
                setIsAccountMenuOpen((open) => !open)
                setIsPowerMenuOpen(false)
              }}
              title={`Account menu for ${currentUser.username}`}
              aria-label={`Account menu for ${currentUser.username}`}
              aria-haspopup="menu"
              aria-expanded={isAccountMenuOpen}
              aria-controls="account-dropdown-menu"
            >
              <span className="profile-avatar-circle" aria-hidden="true">
                {currentUser.username.charAt(0).toUpperCase()}
              </span>
              <span className="profile-text-wrap">
                <span className="profile-username">{currentUser.username}</span>
                <span className="profile-role">
                  Personal workspace
                </span>
              </span>
            </button>
            <AccountDropdown
              isOpen={isAccountMenuOpen}
              onClose={() => setIsAccountMenuOpen(false)}
              currentUser={currentUser}
              onOpenSettings={onOpenSettings}
              onStartTutorial={onStartTutorial}
              onLogout={onLogout}
              anchorRef={profileButtonRef}
            />
          </div>
        )}
        <div className="topbar-menu-anchor">
          <button
            ref={powerButtonRef}
            type="button"
            className={`action-btn-circle ${isPowerMenuOpen ? 'is-active' : ''}`}
            onClick={() => {
              setIsPowerMenuOpen((open) => !open)
              setIsAccountMenuOpen(false)
            }}
            title="System controls and application power menu"
            aria-label="Power menu"
            aria-haspopup="menu"
            aria-expanded={isPowerMenuOpen}
            aria-controls="power-dropdown-menu"
          >
            <Icon name="power" size={15} />
          </button>
          <PowerDropdown
            isOpen={isPowerMenuOpen}
            onClose={() => setIsPowerMenuOpen(false)}
            isFocusActive={Boolean(isFocusActive)}
            onLogout={onLogout}
            anchorRef={powerButtonRef}
          />
        </div>
      </div>
    </header>
  )
})

