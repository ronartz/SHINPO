import React from 'react'
import { Box, ThemeProvider, CssBaseline } from '@mui/material'
import { getAuroraTheme } from '../theme/auroraTheme'
import { AuroraSidebar } from './AuroraSidebar'
import { AuroraTopbar } from './AuroraTopbar'
import type { AppView } from '../../types/navigation'
import type { ShinpoMessage } from '../../utils/shinpoMessages'
import type { SentinelStatus } from '../../api/device'
import type { AuthUser } from '../../api/auth'
import '../theme/aurora.css'

export interface AuroraAppShellProps {
  children: React.ReactNode
  isDarkMode: boolean
  onToggleTheme: () => void
  activeTab: AppView
  onSelectTab: (tab: AppView) => void
  sidebarExpanded?: boolean
  onToggleSidebar?: () => void
  shinpoMessage?: ShinpoMessage
  onRefreshShinpoMessage?: () => void
  sentinelStatus?: SentinelStatus | null
  greeting?: string
  subGreeting?: string
  isWsConnected?: boolean
  shieldStatus?: string
  onToggleV2Preview?: () => void
  isV2Preview?: boolean
  // Topbar props
  topSearchQuery?: string
  onSearchChange?: (query: string) => void
  unreadAlertCount?: number
  isAlertsDrawerOpen?: boolean
  onToggleAlertsDrawer?: () => void
  onRefreshData?: () => void
  currentUser?: AuthUser | null
  onLogout?: () => void
}

export const AuroraAppShell: React.FC<AuroraAppShellProps> = ({
  children,
  isDarkMode,
  onToggleTheme,
  activeTab,
  onSelectTab,
  sidebarExpanded = true,
  onToggleSidebar,
  shinpoMessage,
  onRefreshShinpoMessage,
  sentinelStatus,
  onToggleV2Preview,
  isV2Preview = true,
  topSearchQuery = '',
  onSearchChange,
  unreadAlertCount = 0,
  isAlertsDrawerOpen = false,
  onToggleAlertsDrawer,
  onRefreshData,
  currentUser = null,
  onLogout,
}) => {
  const muiTheme = React.useMemo(() => getAuroraTheme(isDarkMode ? 'dark' : 'light'), [isDarkMode])

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <Box
        className={`aurora-viewport theme-${isDarkMode ? 'dark' : 'light'}`}
        sx={{
          height: '100vh',
          maxHeight: '100vh',
          width: '100%',
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        {/* Background Atmospheric Aurora Glow */}
        <Box className="aurora-ambient-glow" aria-hidden="true" />

        {/* Floating Aurora Sidebar */}
        <AuroraSidebar
          activeTab={activeTab}
          onSelectTab={onSelectTab}
          isExpanded={sidebarExpanded}
          onToggleExpanded={onToggleSidebar}
          shinpoMessage={shinpoMessage}
          onRefreshShinpoMessage={onRefreshShinpoMessage}
          sentinelStatus={sentinelStatus}
          isDarkMode={isDarkMode}
        />

        {/* Main Content Viewport */}
        <Box
          component="main"
          sx={{
            flex: 1,
            minWidth: 0,
            height: '100vh',
            maxHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            zIndex: 1,
            overflow: 'hidden',
            p: { xs: 1.5, md: 2 },
          }}
        >
          {/* Topbar: Sleek 56px utility bar with title, search, switcher, theme, profile */}
          <AuroraTopbar
            activeTab={activeTab}
            topSearchQuery={topSearchQuery}
            onSearchChange={onSearchChange}
            unreadAlertCount={unreadAlertCount}
            isAlertsDrawerOpen={isAlertsDrawerOpen}
            onToggleAlertsDrawer={onToggleAlertsDrawer}
            isDarkMode={isDarkMode}
            onToggleTheme={onToggleTheme}
            onRefreshData={onRefreshData}
            currentUser={currentUser}
            onLogout={onLogout}
            onToggleV2Preview={onToggleV2Preview}
            isV2Preview={isV2Preview}
          />

          {/* Main Dashboard / Screen Content Scroll Container */}
          <Box sx={{ flex: 1, minHeight: 0, width: '100%', overflowY: 'auto', overflowX: 'hidden', pb: 4 }}>
            {children}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  )
}
