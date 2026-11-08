import React from 'react'
import { Box, Typography, IconButton } from '@mui/material'
import { Icon } from '../../components/common/Icon'
import type { AppView } from '../../types/navigation'
import { getViewHeaderTitle } from '../../types/navigation'
import type { AuthUser } from '../../api/auth'
import type { ProgressResponse } from '../../api/progress'
import type { SettingsSection } from '../../components/dialogs/SettingsModal'

export interface AuroraTopbarProps {
  activeTab?: AppView
  topSearchQuery?: string
  onSearchChange?: (query: string) => void
  unreadAlertCount?: number
  isAlertsDrawerOpen?: boolean
  onToggleAlertsDrawer?: () => void
  isDarkMode: boolean
  onToggleTheme: () => void
  onRefreshData?: () => void
  isRefreshing?: boolean
  onOpenSettings?: (section?: SettingsSection) => void
  currentUser?: AuthUser | null
  userProgress?: ProgressResponse | null
  onOpenAchievements?: () => void
  onLogout?: () => void
  onToggleV2Preview?: () => void
  isV2Preview?: boolean
}

export const AuroraTopbar: React.FC<AuroraTopbarProps> = ({
  activeTab = 'Dashboard',
  topSearchQuery = '',
  onSearchChange,
  unreadAlertCount = 0,
  onToggleAlertsDrawer,
  isDarkMode,
  onToggleTheme: _onToggleTheme,
  onRefreshData,
  isRefreshing = false,
  onOpenSettings,
  currentUser,
  onLogout,
  onToggleV2Preview: _onToggleV2Preview,
  isV2Preview: _isV2Preview = true,
}) => {
  return (
    <Box
      className="aurora-glass"
      sx={{
        height: 56,
        minHeight: 56,
        maxHeight: 56,
        px: { xs: 2, md: 2.5 },
        borderRadius: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        mb: 2.5,
      }}
      role="banner"
    >
      {/* Left: View title */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 800,
            fontSize: 18,
            letterSpacing: '-0.02em',
            color: 'text.primary',
            lineHeight: 1.2,
          }}
        >
          {getViewHeaderTitle(activeTab)}
        </Typography>
      </Box>

      {/* Center: Global Search Input */}
      <Box
        sx={{
          display: { xs: 'none', sm: 'flex' },
          alignItems: 'center',
          gap: 1.2,
          background: isDarkMode ? 'color-mix(in srgb, var(--brand-baltic-blue) 55.0%, transparent)' : '#ffffff',
          border: `1px solid ${isDarkMode ? 'rgba(255,255,255, 0.1)' : 'color-mix(in srgb, var(--brand-highlight) 16.0%, transparent)'}`,
          borderRadius: '12px',
          px: 1.8,
          py: 0.6,
          width: { sm: 260, md: 380, lg: 440 },
          boxShadow: isDarkMode ? 'none' : '0 2px 6px color-mix(in srgb, var(--brand-highlight) 5.0%, transparent)',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          '&:focus-within': {
            borderColor: 'var(--brand-primary)',
            boxShadow: '0 0 0 3px color-mix(in srgb, var(--brand-highlight) 18.0%, transparent)',
          },
        }}
        role="search"
      >
        <Icon name="search" size={15} />
        <input
          type="text"
          placeholder="Search tasks, goals, or sessions..."
          value={topSearchQuery}
          onChange={(e) => onSearchChange?.(e.target.value)}
          style={{
            border: 'none',
            background: 'transparent',
            outline: 'none',
            fontSize: '13.5px',
            color: isDarkMode ? '#eeeeee' : 'var(--brand-baltic-blue)',
            width: '100%',
            fontFamily: 'inherit',
          }}
          aria-label="Global search"
        />
        <Box
          component="button"
          type="button"
          onClick={() => {
            if (topSearchQuery) onSearchChange?.('')
          }}
          sx={{
            background: 'transparent',
            border: 'none',
            color: 'text.secondary',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            p: 0.4,
            borderRadius: '6px',
            '&:hover': { color: 'primary.main' },
          }}
          title={topSearchQuery ? 'Clear search' : 'Search filter'}
          aria-label={topSearchQuery ? 'Clear search' : 'Search filter'}
        >
          <Icon name={topSearchQuery ? 'close' : 'sparkle'} size={13} />
        </Box>
      </Box>

      {/* Right: Actions */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexShrink: 0 }}>
        {/* Notifications Bell */}
        {onToggleAlertsDrawer && (
          <IconButton
            onClick={onToggleAlertsDrawer}
            size="small"
            sx={{
              borderRadius: '10px',
              border: `1px solid ${isDarkMode ? 'rgba(255,255,255, 0.1)' : 'color-mix(in srgb, var(--brand-highlight) 16.0%, transparent)'}`,
              background: isDarkMode ? 'color-mix(in srgb, var(--brand-baltic-blue) 50.0%, transparent)' : '#ffffff',
              color: 'text.primary',
              width: 36,
              height: 36,
              position: 'relative',
              '&:hover': {
                background: isDarkMode ? 'color-mix(in srgb, var(--brand-baltic-blue) 80.0%, transparent)' : '#ededed',
              },
            }}
            title="Notifications & Activity"
          >
            <Icon name="bell" size={15} />
            {unreadAlertCount > 0 && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 7,
                  right: 7,
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  bgcolor: 'var(--brand-primary)',
                  boxShadow: '0 0 6px var(--brand-primary)',
                }}
              />
            )}
          </IconButton>
        )}

        {/* Refresh Data Button */}
        {onRefreshData && (
          <IconButton
            onClick={onRefreshData}
            disabled={isRefreshing}
            size="small"
            sx={{
              borderRadius: '10px',
              border: `1px solid ${isDarkMode ? 'rgba(255,255,255, 0.1)' : 'color-mix(in srgb, var(--brand-highlight) 16.0%, transparent)'}`,
              background: isDarkMode ? 'color-mix(in srgb, var(--brand-baltic-blue) 50.0%, transparent)' : '#ffffff',
              color: 'text.primary',
              width: 36,
              height: 36,
              opacity: isRefreshing ? 0.7 : 1,
              '&:hover': {
                background: isDarkMode ? 'color-mix(in srgb, var(--brand-baltic-blue) 80.0%, transparent)' : '#ededed',
              },
              '& svg': {
                animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
              },
            }}
            title={isRefreshing ? 'Refreshing data…' : 'Refresh data'}
            aria-label="Refresh Data"
          >
            <Icon name="refresh" size={15} />
          </IconButton>
        )}

        {/* Settings Button */}
        {onOpenSettings && (
          <IconButton
            onClick={() => onOpenSettings('appearance')}
            size="small"
            sx={{
              borderRadius: '10px',
              border: `1px solid ${isDarkMode ? 'rgba(255,255,255, 0.1)' : 'color-mix(in srgb, var(--brand-highlight) 16.0%, transparent)'}`,
              background: isDarkMode ? 'color-mix(in srgb, var(--brand-baltic-blue) 50.0%, transparent)' : '#ffffff',
              color: 'text.primary',
              width: 36,
              height: 36,
              '&:hover': {
                background: isDarkMode ? 'color-mix(in srgb, var(--brand-baltic-blue) 80.0%, transparent)' : '#ededed',
              },
            }}
            title="Settings"
            aria-label="Settings"
          >
            <Icon name="settings" size={15} />
          </IconButton>
        )}

        {/* Profile Badge */}
        {currentUser && (
          <Box
            onClick={() => onOpenSettings?.('account')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onOpenSettings?.('account')
              }
            }}
            sx={{
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center',
              gap: 1.2,
              px: 1.4,
              py: 0.4,
              borderRadius: '10px',
              background: isDarkMode ? 'color-mix(in srgb, var(--brand-baltic-blue) 50.0%, transparent)' : '#ffffff',
              border: `1px solid ${isDarkMode ? 'rgba(255,255,255, 0.1)' : 'color-mix(in srgb, var(--brand-highlight) 16.0%, transparent)'}`,
              height: 36,
              cursor: onOpenSettings ? 'pointer' : 'default',
              transition: 'all 0.15s ease',
              '&:hover': onOpenSettings ? {
                borderColor: 'var(--brand-primary)',
                background: isDarkMode ? 'color-mix(in srgb, var(--brand-baltic-blue) 80.0%, transparent)' : '#ededed',
              } : undefined,
            }}
            title={`Signed in as ${currentUser.username} (${currentUser.email})${onOpenSettings ? ' • Click for Account Settings' : ''}`}
          >
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary) 100%)',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {currentUser.username.charAt(0).toUpperCase()}
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 13.5, color: 'text.primary' }}>
                  {currentUser.username}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 600 }}>
                Personal workspace
              </Typography>
            </Box>
          </Box>
        )}

        {/* Sign Out Button */}
        {onLogout && (
          <IconButton
            onClick={onLogout}
            size="small"
            sx={{
              borderRadius: '10px',
              border: `1px solid ${isDarkMode ? 'rgba(255,255,255, 0.1)' : 'color-mix(in srgb, var(--brand-highlight) 16.0%, transparent)'}`,
              background: isDarkMode ? 'color-mix(in srgb, var(--brand-baltic-blue) 50.0%, transparent)' : '#ffffff',
              color: 'text.secondary',
              width: 36,
              height: 36,
              '&:hover': {
                color: 'var(--brand-primary)',
                background: isDarkMode ? 'color-mix(in srgb, var(--brand-highlight) 12.0%, transparent)' : '#e8e8e8',
              },
            }}
            title="Sign Out"
          >
            <Icon name="power" size={14} />
          </IconButton>
        )}
      </Box>
    </Box>
  )
}
