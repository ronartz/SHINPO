import React from 'react'
import { Box, Typography } from '@mui/material'

export interface AuroraProgressIndicatorProps {
  value: number // 0 to 100
  label?: string
  height?: number
  showPercentage?: boolean
}

export const AuroraProgressIndicator: React.FC<AuroraProgressIndicatorProps> = ({
  value,
  label,
  height = 8,
  showPercentage = true,
}) => {
  const clamped = Math.max(0, Math.min(100, value))

  return (
    <Box sx={{ width: '100%' }}>
      {(label || showPercentage) && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.8 }}>
          {label && (
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: 13 }}>
              {label}
            </Typography>
          )}
          {showPercentage && (
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary', fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>
              {Math.round(clamped)}%
            </Typography>
          )}
        </Box>
      )}
      <Box
        sx={{
          width: '100%',
          height,
          borderRadius: 999,
          background: 'color-mix(in srgb, var(--brand-highlight) 12.0%, transparent)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <Box
          sx={{
            width: '100%',
            height: '100%',
            borderRadius: 999,
            background: 'linear-gradient(90deg, var(--brand-primary) 0%, var(--brand-primary) 50%, var(--brand-primary) 100%)',
            boxShadow: '0 0 12px color-mix(in srgb, var(--brand-highlight) 45.0%, transparent)',
            transformOrigin: 'left',
            transform: `scaleX(${clamped / 100})`,
            transition: 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </Box>
    </Box>
  )
}

