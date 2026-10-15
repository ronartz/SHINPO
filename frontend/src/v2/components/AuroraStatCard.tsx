import React from 'react'
import { Box, Typography } from '@mui/material'
import { AuroraCard } from './AuroraCard'
import { Icon, type IconName } from '../../components/common/Icon'

export interface AuroraStatCardProps {
  title: string
  value: string | number
  unit?: string
  subtitle?: string
  trend?: string
  trendPositive?: boolean
  iconName: IconName
  accentColor?: 'purple' | 'blue' | 'cyan' | 'emerald' | 'coral'
  tiltVariant?: 'right' | 'left' | 'lift' | 'none'
}

export const AuroraStatCard: React.FC<AuroraStatCardProps> = ({
  title,
  value,
  unit,
  subtitle,
  trend,
  trendPositive = true,
  iconName,
  accentColor = 'purple',
  tiltVariant = 'lift',
}) => {
  const iconGradients = {
    purple: 'linear-gradient(135deg, rgba(151, 87, 250, 0.20) 0%, rgba(151, 87, 250, 0.06) 100%)',
    blue: 'linear-gradient(135deg, rgba(77, 119, 249, 0.20) 0%, rgba(77, 119, 249, 0.06) 100%)',
    cyan: 'linear-gradient(135deg, rgba(27, 201, 222, 0.20) 0%, rgba(27, 201, 222, 0.06) 100%)',
    emerald: 'linear-gradient(135deg, rgba(16, 185, 129, 0.20) 0%, rgba(16, 185, 129, 0.06) 100%)',
    coral: 'linear-gradient(135deg, rgba(255, 77, 94, 0.20) 0%, rgba(255, 77, 94, 0.06) 100%)',
  }

  const iconColors = {
    purple: '#A86EFB',
    blue: '#6E90FB',
    cyan: '#1BC9DE',
    emerald: '#10B981',
    coral: '#FF4D5E',
  }

  return (
    <AuroraCard
      tiltVariant={tiltVariant}
      glass
      sx={{
        height: '100%',
        minHeight: 140,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        p: 2.5,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5, mb: 1.5 }}>
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 600,
            fontSize: 14,
            letterSpacing: '-0.01em',
            color: 'text.secondary',
            lineHeight: 1.3,
          }}
        >
          {title}
        </Typography>
        <Box
          sx={{
            width: 36,
            height: 36,
            minWidth: 36,
            borderRadius: '10px',
            background: iconGradients[accentColor],
            color: iconColors[accentColor],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid ${iconColors[accentColor]}33`,
          }}
        >
          <Icon name={iconName} size={18} />
        </Box>
      </Box>

      <Box sx={{ mt: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 700,
              fontSize: '30px',
              letterSpacing: '-0.03em',
              fontVariantNumeric: 'tabular-nums',
              color: 'text.primary',
              lineHeight: 1.1,
            }}
          >
            {value}
          </Typography>
          {unit && (
            <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.secondary', fontSize: 13 }}>
              {unit}
            </Typography>
          )}
        </Box>

        {subtitle && (
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 12.5, fontWeight: 500, display: 'block', mt: 0.8 }}>
            {subtitle}
          </Typography>
        )}

        {trend && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mt: 0.8 }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                px: 0.8,
                py: 0.2,
                borderRadius: '6px',
                fontSize: 11.5,
                fontWeight: 600,
                background: trendPositive ? 'rgba(16, 185, 129, 0.14)' : 'rgba(255, 77, 94, 0.14)',
                color: trendPositive ? '#10B981' : '#FF4D5E',
              }}
            >
              {trendPositive ? '↑' : '↓'} {trend}
            </Box>
          </Box>
        )}
      </Box>
    </AuroraCard>
  )
}


