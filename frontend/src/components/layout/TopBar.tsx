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
  isDarkMode,
  onToggleTheme,
  onRefreshData,
  currentUser,
  onLogout,
  onToggleV2Preview,
  isV2Preview,
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
        <button type="button" className="top-search-filter-btn" title="Filter & Focus" aria-label="Search filter">
          <Icon name="sparkle" size={13} />
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
        {onToggleV2Preview && (
          <button
            type="button"
            className={`action-btn-pill v2-preview-btn ${isV2Preview ? 'active' : ''}`}
            onClick={onToggleV2Preview}
            style={{
              padding: '6px 12px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              border: '1px solid #9757FA',
              background: 'linear-gradient(135deg, rgba(151, 87, 250, 0.15) 0%, rgba(77, 119, 249, 0.15) 100%)',
              color: isDarkMode ? '#F5F7FF' : '#17213A',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title={isV2Preview ? 'Switch to Classic View' : 'Toggle V2 Cinematic Aurora Preview'}
          >
            <span>{isV2Preview ? '⇄' : '★'}</span>
            <span>{isV2Preview ? 'Classic View' : 'V2 AURORA'}</span>
          </button>
        )}
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
    </header>
  )
})

