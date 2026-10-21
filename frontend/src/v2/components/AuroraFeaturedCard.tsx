import React from 'react'
import { Box, Typography } from '@mui/material'

export interface AuroraFeaturedCardProps {
  badge?: string
  badgeColor?: 'purple' | 'blue' | 'cyan' | 'emerald' | 'coral'
  title: string
  subtitle?: string
  description?: string
  metaItems?: Array<{ label: string; value: string }>
  actions?: React.ReactNode
  children?: React.ReactNode
}

export const AuroraFeaturedCard: React.FC<AuroraFeaturedCardProps> = ({
  badge = 'Priority task',
  badgeColor = 'purple',
  title,
  subtitle,
  description,
  metaItems,
  actions,
  children,
}) => {
  return (
    <div className="aurora-featured-card aurora-card-interactive aurora-tilt-lift" tabIndex={0}>
      <div className="aurora-featured-inner">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <span className={`aurora-badge ${badgeColor}`}>{badge}</span>
        </Box>

        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            fontSize: { xs: 19, md: 22 },
            letterSpacing: '-0.02em',
            color: 'text.primary',
            mb: 0.5,
          }}
        >

          {title}
        </Typography>

        {subtitle && (
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 600,
              fontSize: 14.5,
              color: 'primary.main',
              mb: 1.5,
            }}
          >
            {subtitle}
          </Typography>
        )}

        {description && (
          <Typography
            variant="body1"
            sx={{
              fontSize: 14.5,
              lineHeight: 1.6,
              color: 'text.secondary',
              mb: 2.5,
            }}
          >
            {description}
          </Typography>
        )}

        {metaItems && metaItems.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 3 }}>
            {metaItems.map((item, idx) => (
              <Box key={idx}>
                <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 12, fontWeight: 700 }}>
                  {item.label}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', fontSize: 14.5 }}>
                  {item.value}
                </Typography>
              </Box>
            ))}
          </Box>
        )}

        {children}

        {actions && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 3 }}>
            {actions}
          </Box>
        )}
      </div>
    </div>
  )
}

