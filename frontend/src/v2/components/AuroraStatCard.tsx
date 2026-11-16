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
    purple: 'color-mix(in srgb, var(--ai-violet) 12%, var(--color-surface-1))',
    blue: 'color-mix(in srgb, var(--color-primary) 12%, var(--color-surface-1))',
    cyan: 'color-mix(in srgb, var(--focus-cyan) 12%, var(--color-surface-1))',
    emerald: 'color-mix(in srgb, var(--color-success) 12%, var(--color-surface-1))',
    coral: 'color-mix(in srgb, var(--color-danger) 12%, var(--color-surface-1))',
  }

  const iconColors = {
    purple: 'var(--ai-violet)',
    blue: 'var(--color-primary)',
    cyan: 'var(--focus-cyan)',
    emerald: 'var(--color-success)',
    coral: 'var(--color-danger)',
  }

  return (
    <AuroraCard
      tiltVariant={tiltVariant}
      glass
      noPadding
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
          noWrap
          variant="subtitle2"
          sx={{
            minWidth: 0,
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
            border: `1px solid color-mix(in srgb, ${iconColors[accentColor]} 35%, transparent)`,
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
                fontSize: 12,
                fontWeight: 600,
                background: trendPositive ? 'var(--status-success-subtle)' : 'var(--status-danger-subtle)',
                color: trendPositive ? 'var(--color-success)' : 'var(--color-danger)',
              }}
            >
              <Icon name={trendPositive ? 'arrow-up-right' : 'chevron-down'} size={12} />
              <Box component="span" sx={{ ml: 0.3 }}>{trend}</Box>
            </Box>
          </Box>
        )}
      </Box>
    </AuroraCard>
  )
}


