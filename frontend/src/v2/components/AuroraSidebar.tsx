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
  const activeIndex = Math.max(0, NAVIGATION_ITEMS.findIndex((item) => item.id === activeTab))

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
                    background: isDarkMode ? 'rgba(255,255,255, 0.06)' : 'rgba(0,0,0, 0.04)',
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
                ? 'color-mix(in srgb, var(--brand-baltic-blue) 65.0%, transparent)'
                : 'linear-gradient(145deg, #f0f0f0 0%, #e2e2e2 100%)',
              border: `1px solid ${isDarkMode ? 'color-mix(in srgb, var(--brand-highlight) 18.0%, transparent)' : 'color-mix(in srgb, var(--brand-highlight) 22.0%, transparent)'}`,
              boxShadow: isDarkMode
                ? '0 2px 8px rgba(0,0,0, 0.15)'
                : '0 2px 8px color-mix(in srgb, var(--brand-highlight) 8.0%, transparent)',
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              '&:hover': {
                borderColor: 'color-mix(in srgb, var(--brand-highlight) 35.0%, transparent)',
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
                  color: isDarkMode ? 'var(--brand-primary)' : 'var(--brand-primary)',
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
                    color: isDarkMode ? 'rgba(255,255,255, 0.6)' : 'color-mix(in srgb, var(--brand-baltic-blue) 60.0%, transparent)',
                    cursor: 'pointer',
                    p: 0.4,
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      color: isDarkMode ? '#ffffff' : 'var(--brand-baltic-blue)',
                      background: isDarkMode ? 'rgba(255,255,255, 0.08)' : 'rgba(0,0,0, 0.05)',
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
                color: isDarkMode ? '#f3f3f3' : 'var(--brand-baltic-blue)',
              }}
            >
              “{shinpoMessage.text}”
            </Typography>
          </Box>
        )}

        {/* Navigation Item Stack */}
        <Box component="nav" className="aurora-nav-stack" sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
          <Box component="span" className="aurora-nav-spotlight" aria-hidden="true" sx={{ transform: `translateY(${activeIndex * 50.4}px)` }} />
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
                    zIndex: 1,
                    boxSizing: 'border-box',
                    minHeight: 44,
                    transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                    background: 'transparent',
                    color: isActive
                      ? isDarkMode
                        ? '#ffffff'
                        : 'var(--brand-primary)'
                      : 'text.secondary',
                    boxShadow: 'none',
                    '&:hover': {
                      color: 'text.primary',
                      background: isActive
                        ? undefined
                        : isDarkMode
                          ? 'rgba(255,255,255, 0.05)'
                          : 'color-mix(in srgb, var(--brand-highlight) 4.0%, transparent)',
                      transform: 'translateX(2px)',
                    },
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isActive
                        ? isDarkMode
                          ? 'var(--brand-primary)'
                          : 'var(--brand-primary)'
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
              ? 'color-mix(in srgb, var(--brand-baltic-blue) 50.0%, transparent)'
              : 'rgba(231,231,231, 0.8)',
            border: `1px solid ${isDarkMode ? 'rgba(255,255,255, 0.08)' : 'color-mix(in srgb, var(--brand-highlight) 12.0%, transparent)'}`,
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
                backgroundColor: isShieldActive ? 'var(--brand-primary)' : 'var(--brand-primary)',
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
                  color: isShieldActive ? 'var(--brand-primary)' : 'var(--brand-primary)',
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
                backgroundColor: isShieldActive ? 'var(--brand-primary)' : 'var(--brand-primary)',
                boxShadow: 'none',
              }}
            />
          </Tooltip>
        </Box>
      )}
    </Box>
  )
}

