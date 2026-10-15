import React from 'react'
import { Box, Typography, IconButton } from '@mui/material'
import { Icon } from '../../components/common/Icon'
import type { AppView } from '../../types/navigation'
import { getViewHeaderTitle } from '../../types/navigation'
import type { AuthUser } from '../../api/auth'

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
  currentUser?: AuthUser | null
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
  onToggleTheme,
  onRefreshData,
  currentUser,
  onLogout,
  onToggleV2Preview,
  isV2Preview = true,
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
          background: isDarkMode ? 'rgba(25, 37, 65, 0.55)' : '#FFFFFF',
          border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(77, 119, 249, 0.16)'}`,
          borderRadius: '12px',
          px: 1.8,
          py: 0.6,
          width: { sm: 260, md: 380, lg: 440 },
          boxShadow: isDarkMode ? 'none' : '0 2px 6px rgba(77, 119, 249, 0.05)',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          '&:focus-within': {
            borderColor: '#4D77F9',
            boxShadow: '0 0 0 3px rgba(77, 119, 249, 0.18)',
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
            color: isDarkMode ? '#F5F7FF' : '#17213A',
            width: '100%',
            fontFamily: 'inherit',
          }}
          aria-label="Global search"
        />
        <Box
          component="button"
          type="button"
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
          title="Search Filter"
          aria-label="Search filter"
        >
          <Icon name="sparkle" size={13} />
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
              border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(77, 119, 249, 0.16)'}`,
              background: isDarkMode ? 'rgba(25, 37, 65, 0.5)' : '#FFFFFF',
              color: 'text.primary',
              width: 36,
              height: 36,
              position: 'relative',
              '&:hover': {
                background: isDarkMode ? 'rgba(30, 44, 77, 0.8)' : '#F5F7FD',
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
                  bgcolor: '#FF4D5E',
                  boxShadow: '0 0 6px #FF4D5E',
                }}
              />
            )}
          </IconButton>
        )}

        {/* View Switcher Button */}
        {onToggleV2Preview && (
          <button
            onClick={onToggleV2Preview}
            style={{
              padding: '6px 13px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              border: `1px solid ${isDarkMode ? 'rgba(151, 87, 250, 0.4)' : 'rgba(151, 87, 250, 0.3)'}`,
              background: 'linear-gradient(135deg, rgba(151, 87, 250, 0.14) 0%, rgba(77, 119, 249, 0.14) 100%)',
              color: isDarkMode ? '#F5F7FF' : '#17213A',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              height: '36px',
              transition: 'all 0.15s ease',
            }}
            title="Toggle between Classic UI and V2 Preview"
          >
            <span>⇄</span>
            <span>{isV2Preview ? 'Classic View' : 'V2 Preview'}</span>
          </button>
        )}

        {/* Theme Toggle Button */}
        <IconButton
          onClick={onToggleTheme}
          size="small"
          sx={{
            borderRadius: '10px',
            border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(77, 119, 249, 0.16)'}`,
            background: isDarkMode ? 'rgba(25, 37, 65, 0.5)' : '#FFFFFF',
            color: 'text.primary',
            width: 36,
            height: 36,
            '&:hover': {
              background: isDarkMode ? 'rgba(30, 44, 77, 0.8)' : '#F5F7FD',
            },
          }}
          title={isDarkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
        >
          <Icon name={isDarkMode ? 'sun' : 'moon'} size={15} />
        </IconButton>

        {/* Refresh Data Button */}
        {onRefreshData && (
          <IconButton
            onClick={onRefreshData}
            size="small"
            sx={{
              borderRadius: '10px',
              border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(77, 119, 249, 0.16)'}`,
              background: isDarkMode ? 'rgba(25, 37, 65, 0.5)' : '#FFFFFF',
              color: 'text.primary',
              width: 36,
              height: 36,
              '&:hover': {
                background: isDarkMode ? 'rgba(30, 44, 77, 0.8)' : '#F5F7FD',
              },
            }}
            title="Refresh Data"
          >
            <Icon name="settings" size={15} />
          </IconButton>
        )}

        {/* Profile Badge */}
        {currentUser && (
          <Box
            sx={{
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center',
              gap: 1.2,
              px: 1.4,
              py: 0.4,
              borderRadius: '10px',
              background: isDarkMode ? 'rgba(25, 37, 65, 0.5)' : '#FFFFFF',
              border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(77, 119, 249, 0.16)'}`,
              height: 36,
            }}
            title={`Signed in as ${currentUser.username} (${currentUser.email})`}
          >
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #9757FA 0%, #4D77F9 100%)',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {currentUser.username.charAt(0).toUpperCase()}
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 12.5, color: 'text.primary' }}>
                {currentUser.username}
              </Typography>
              <Typography sx={{ fontSize: 10.5, color: 'text.secondary', fontWeight: 500 }}>
                Personal Workspace
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
              border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(77, 119, 249, 0.16)'}`,
              background: isDarkMode ? 'rgba(25, 37, 65, 0.5)' : '#FFFFFF',
              color: 'text.secondary',
              width: 36,
              height: 36,
              '&:hover': {
                color: '#FF4D5E',
                background: isDarkMode ? 'rgba(255, 77, 94, 0.12)' : '#FEF2F2',
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
