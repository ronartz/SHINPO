import React from 'react'
import type { AppView } from '../../types/navigation'
import { getViewHeaderTitle } from '../../types/navigation'
import { Icon } from '../common/Icon'
import type { AuthUser } from '../../api/auth'

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
  currentUser: AuthUser | null
  onLogout: () => void
}

import { trackRender } from '../../utils/renderTracker'

export const TopBar: React.FC<TopBarProps> = React.memo(({
  activeTab,
  topSearchQuery,
  onSearchChange,
  unreadAlertCount,
  isAlertsDrawerOpen,
  onToggleAlertsDrawer,
  isDarkMode,
  onToggleTheme,
  onRefreshData,
  currentUser,
  onLogout,
}) => {
  trackRender('TopBar')
  return (
    <div className="cockpit-top-bar">
      <div className="page-header-info">
        <h1 className="top-brand-title">
          {getViewHeaderTitle(activeTab)}
        </h1>
      </div>

      {/* Pill Search Input */}
      <div className="top-search-command">
        <Icon name="search" size={16} />
        <input
          type="text"
          className="top-search-input"
          placeholder="Search tasks, goals, or sessions..."
          value={topSearchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <button className="top-search-filter-btn" title="Filter & Focus">
          <Icon name="sparkle" size={14} />
        </button>
      </div>

      <div className="top-bar-actions">
        <button
          className={`action-btn-circle ${unreadAlertCount > 0 ? 'has-badge' : ''} ${isAlertsDrawerOpen ? 'active' : ''}`}
          title="Notifications & Activity"
          onClick={onToggleAlertsDrawer}
        >
          <Icon name="bell" size={16} />
          {unreadAlertCount > 0 && <span className="bell-red-dot" />}
        </button>
        <button
          className="action-btn-circle"
          onClick={onToggleTheme}
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          <Icon name={isDarkMode ? 'sun' : 'moon'} size={16} />
        </button>
        <button className="action-btn-circle" onClick={onRefreshData} title="Refresh Data">
          <Icon name="settings" size={16} />
        </button>
        {currentUser && (
          <div className="profile-badge-card" title={`Signed in as ${currentUser.username} (${currentUser.email})`}>
            <div className="profile-avatar-circle">
              {currentUser.username.charAt(0).toUpperCase()}
            </div>
            <div className="profile-text-wrap">
              <span className="profile-username">{currentUser.username}</span>
              <span className="profile-role">Personal Workspace</span>
            </div>
          </div>
        )}
        <button
          className="action-btn-circle"
          onClick={onLogout}
          title="Sign Out"
        >
          <Icon name="power" size={14} />
        </button>
      </div>
    </div>
  )
})

