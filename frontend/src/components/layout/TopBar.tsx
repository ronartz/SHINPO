import React from 'react'
import type { AppView } from '../../types/navigation'
import { getViewHeaderTitle } from '../../types/navigation'
import { Icon } from '../common/Icon'
import type { AuthUser } from '../../api/auth'
import type { ProgressResponse } from '../../api/progress'
import type { SettingsSection } from '../dialogs/SettingsModal'

export interface TopBarProps {
  activeTab: AppView
  topSearchQuery: string
  onSearchChange: (query: string) => void
  unreadAlertCount: number
  isAlertsDrawerOpen: boolean
  onToggleAlertsDrawer: () => void
  isDarkMode: boolean
  onToggleTheme: () => void
  onRefreshData: () => void
  isRefreshing?: boolean
  onOpenSettings?: (section?: SettingsSection) => void
  currentUser: AuthUser | null
  userProgress?: ProgressResponse | null
  onOpenAchievements?: () => void
  onLogout: () => void
  onToggleV2Preview?: () => void
  isV2Preview?: boolean
}

import { trackRender } from '../../utils/renderTracker'

export const TopBar: React.FC<TopBarProps> = React.memo(({
  activeTab,
  topSearchQuery,
  onSearchChange,
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
  onOpenAchievements,
  onLogout,
  onToggleV2Preview: _onToggleV2Preview,
  isV2Preview: _isV2Preview,
}) => {
  trackRender('TopBar')
  return (
    <header className="cockpit-top-bar" role="banner">
      <div className="page-header-info">
        <h1 className="top-brand-title">
          {getViewHeaderTitle(activeTab)}
        </h1>
      </div>

      {/* Centered Search Input */}
      <div className="top-search-command" role="search">
        <Icon name="search" size={15} />
        <input
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
        {onOpenSettings && (
          <button
            className="action-btn-circle"
            onClick={() => onOpenSettings('appearance')}
            title="Settings"
            aria-label="Settings"
            data-tutorial="topbar-settings-btn"
          >
            <Icon name="settings" size={17} />
          </button>
        )}
        {currentUser && (
          <div
            className="profile-badge-card"
            data-tutorial="profile-badge-card"
            onClick={() => onOpenSettings ? onOpenSettings('account') : undefined}
            style={{ cursor: onOpenSettings ? 'pointer' : 'default' }}
            title={`Signed in as ${currentUser.username} (${currentUser.email})${onOpenSettings ? ' • Click for Account Settings' : ''}`}
          >
            <div className="profile-avatar-circle">
              {currentUser.username.charAt(0).toUpperCase()}
            </div>
            <div className="profile-text-wrap">
              <span className="profile-username">{currentUser.username}</span>
              <span
                className="profile-role"
                onClick={(e) => {
                  if (onOpenAchievements) {
                    e.stopPropagation()
                    onOpenAchievements()
                  }
                }}
                style={{ cursor: onOpenAchievements ? 'pointer' : 'default' }}
                title={onOpenAchievements ? 'Click to view progression & achievements' : undefined}
              >
                {userProgress ? `Lvl ${userProgress.level} • ${userProgress.totalProgress} XP` : 'Personal Workspace'}
              </span>
            </div>
          </div>
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

