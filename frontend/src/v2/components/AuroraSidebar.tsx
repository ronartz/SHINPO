import React from 'react'
import { Box, Typography, Tooltip } from '@mui/material'
import { ShinpoLogo } from '../../components/ShinpoLogo'
import { Icon } from '../../components/common/Icon'
import { NAVIGATION_ITEMS } from '../../types/navigation'
import type { AppView } from '../../types/navigation'
import type { ShinpoMessage } from '../../utils/shinpoMessages'
import type { SentinelStatus } from '../../api/device'

export interface AuroraSidebarProps {
  activeTab: AppView
  onSelectTab: (tab: AppView) => void
  isExpanded?: boolean
  onToggleExpanded?: () => void
  shinpoMessage?: ShinpoMessage
  onRefreshShinpoMessage?: () => void
  sentinelStatus?: SentinelStatus | null
  isDarkMode: boolean
}

export const AuroraSidebar: React.FC<AuroraSidebarProps> = ({
  activeTab,
  onSelectTab,
  isExpanded = true,
  onToggleExpanded,
  shinpoMessage,
  onRefreshShinpoMessage,
  sentinelStatus,
  isDarkMode,
}) => {
  const isShieldActive = sentinelStatus ? (sentinelStatus.status === 'ACTIVE' || sentinelStatus.status === 'ACTIVE_DEFENSE') : false
  const violationsToday = sentinelStatus?.totalInterceptedToday ?? 0


  return (
    <Box
      component="aside"
      className="aurora-glass"
      sx={{
        width: isExpanded ? 260 : 80,
        minWidth: isExpanded ? 260 : 80,
        height: 'calc(100vh - 32px)',
        position: 'sticky',
        top: 16,
        left: 16,
        borderRadius: '24px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        p: 2.5,
        zIndex: 20,
        userSelect: 'none',
      }}
    >
      {/* Top Branding Section */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isExpanded ? 'space-between' : 'center',
            px: 0.5,
          }}
        >
          <Box
            onClick={() => onSelectTab('Dashboard')}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            <ShinpoLogo size={32} variant={isExpanded ? 'lockup' : 'icon'} />
          </Box>

          {onToggleExpanded && isExpanded && (
            <Tooltip title="Collapse sidebar" placement="right">
              <Box
                component="button"
                onClick={onToggleExpanded}
                sx={{
                  background: 'transparent',
                  border: 'none',
                  color: 'text.secondary',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 0.8,
                  borderRadius: '10px',
                  '&:hover': {
                    color: 'text.primary',
                    background: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                  },
                }}
              >
                <Icon name="chevron-left" size={16} />
              </Box>
            </Tooltip>
          )}
        </Box>

        {/* Editorial Peach Perspective Quote Card in Aurora Sidebar */}
        {isExpanded && shinpoMessage && (
          <Box
            sx={{
              p: '14px 16px',
              borderRadius: '12px',
              background: isDarkMode
                ? 'rgba(45, 30, 26, 0.65)'
                : 'linear-gradient(145deg, #FFF7F2 0%, #FEEFE6 100%)',
              border: `1px solid ${isDarkMode ? 'rgba(255, 178, 140, 0.18)' : 'rgba(235, 130, 80, 0.22)'}`,
              boxShadow: isDarkMode
                ? '0 2px 8px rgba(0, 0, 0, 0.15)'
                : '0 2px 8px rgba(224, 109, 83, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              '&:hover': {
                borderColor: 'rgba(249, 115, 22, 0.35)',
              },
            }}
            role="region"
            aria-label="Perspective Quote"
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography
                sx={{
                  fontFamily: "'Nunito', sans-serif",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: isDarkMode ? '#F97316' : '#D9532F',
                }}
              >
                PERSPECTIVE
              </Typography>
              {onRefreshShinpoMessage && (
                <Box
                  component="button"
                  onClick={onRefreshShinpoMessage}
                  title="Next message"
                  aria-label="Cycle motivational quote"
                  sx={{
                    background: 'transparent',
                    border: 'none',
                    color: isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(45, 30, 26, 0.6)',
                    cursor: 'pointer',
                    p: 0.4,
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      color: isDarkMode ? '#FFFFFF' : '#2D1E18',
                      background: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                    },
                  }}
                >
                  <Icon name="refresh" size={13} />
                </Box>
              )}
            </Box>
            <Typography
              sx={{
                fontFamily: "'Playfair Display', Georgia, Cambria, 'Times New Roman', serif",
                fontSize: 15,
                fontWeight: 500,
                fontStyle: 'italic',
                lineHeight: 1.45,
                letterSpacing: '-0.01em',
                color: isDarkMode ? '#F8FAFC' : '#2D1E18',
              }}
            >
              “{shinpoMessage.text}”
            </Typography>
          </Box>
        )}

        {/* Navigation Item Stack */}
        <Box component="nav" sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
          {NAVIGATION_ITEMS.map((item) => {
            const isActive = activeTab === item.id
            return (
              <Tooltip
                key={item.id}
                title={!isExpanded ? item.label : ''}
                placement="right"
                arrow
              >
                <Box
                  component="button"
                  className={`aurora-nav-pill ${isActive ? 'active' : ''}`}
                  data-tab={item.id}
                  data-tutorial={item.tut}
                  data-active={isActive ? 'true' : 'false'}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => onSelectTab(item.id)}
                  sx={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.8,
                    px: isExpanded ? 2 : 1.2,
                    py: 1.25,
                    borderRadius: '14px',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    fontSize: 14.5,
                    fontWeight: isActive ? 700 : 500,
                    position: 'relative',
                    transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                    background: isActive
                      ? isDarkMode
                        ? 'linear-gradient(135deg, rgba(151, 87, 250, 0.22) 0%, rgba(77, 119, 249, 0.16) 100%)'
                        : 'linear-gradient(135deg, rgba(151, 87, 250, 0.12) 0%, rgba(77, 119, 249, 0.08) 100%)'
                      : 'transparent',
                    color: isActive
                      ? isDarkMode
                        ? '#FFFFFF'
                        : '#3563F6'
                      : 'text.secondary',
                    boxShadow: isActive
                      ? isDarkMode
                        ? 'inset 0 0 0 1px rgba(151, 87, 250, 0.35), 0 4px 16px rgba(77, 119, 249, 0.15)'
                        : 'inset 0 0 0 1px rgba(77, 119, 249, 0.25), 0 4px 12px rgba(77, 119, 249, 0.08)'
                      : 'none',
                    '&:hover': {
                      color: 'text.primary',
                      background: isActive
                        ? undefined
                        : isDarkMode
                          ? 'rgba(255, 255, 255, 0.05)'
                          : 'rgba(77, 119, 249, 0.04)',
                      transform: 'translateX(2px)',
                    },
                  }}
                >
                  {/* Left Active Glow Indicator */}
                  {isActive && (
                    <Box
                      sx={{
                        position: 'absolute',
                        left: 0,
                        top: '20%',
                        bottom: '20%',
                        width: 4,
                        borderRadius: '0 4px 4px 0',
                        background: 'linear-gradient(180deg, #9757FA 0%, #1BC9DE 100%)',
                        boxShadow: '0 0 10px #9757FA',
                      }}
                    />
                  )}

                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isActive
                        ? isDarkMode
                          ? '#A86EFB'
                          : '#4D77F9'
                        : 'inherit',
                      fontSize: 18,
                    }}
                  >
                    <Icon name={item.icon} size={20} />
                  </Box>

                  {isExpanded && (
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 'inherit',
                        fontSize: 14.5,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flex: 1,
                      }}
                    >
                      {item.label}
                    </Typography>
                  )}
                </Box>
              </Tooltip>
            )
          })}
        </Box>
      </Box>

      {/* Bottom Telemetry & Status Pill */}
      {isExpanded ? (
        <Box
          sx={{
            p: 2,
            borderRadius: '16px',
            background: isDarkMode
              ? 'rgba(25, 37, 65, 0.5)'
              : 'rgba(240, 244, 255, 0.8)',
            border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(77, 119, 249, 0.12)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                backgroundColor: isShieldActive ? '#10B981' : '#F59E0B',
                boxShadow: 'none',
              }}
            />
            <Box>
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  fontWeight: 700,
                  fontSize: 12,
                  color: isShieldActive ? '#10B981' : '#F59E0B',
                }}
              >
                Shield {isShieldActive ? 'Active' : 'Standby'}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: 12, color: 'text.secondary' }}>
                {violationsToday} events blocked today
              </Typography>
            </Box>
          </Box>
          <Icon name="shield" size={16} />

        </Box>
      ) : (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            py: 1,
          }}
        >
          <Tooltip title={`Shield ${isShieldActive ? 'Enforcing' : 'Standby'}`} placement="right">
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: isShieldActive ? '#10B981' : '#F59E0B',
                boxShadow: 'none',
              }}
            />
          </Tooltip>
        </Box>
      )}
    </Box>
  )
}

