import React from 'react'
import { Box, Typography } from '@mui/material'

export interface AuroraSectionHeaderProps {
  title: string
  subtitle?: string
  badge?: string
  action?: React.ReactNode
}

export const AuroraSectionHeader: React.FC<AuroraSectionHeaderProps> = ({
  title,
  subtitle,
  badge,
  action,
}) => {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              fontSize: { xs: 18, md: 20 },
              letterSpacing: '-0.02em',
              color: 'text.primary',
            }}
          >
            {title}
          </Typography>
          {badge && (
            <span className="aurora-badge blue" style={{ fontSize: 11 }}>
              {badge}
            </span>
          )}
        </Box>
        {subtitle && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.3, fontSize: 13.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {action && <Box>{action}</Box>}
    </Box>
  )
}

