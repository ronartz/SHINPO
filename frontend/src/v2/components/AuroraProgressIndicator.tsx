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
          background: 'rgba(59, 130, 246, 0.12)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <Box
          sx={{
            width: '100%',
            height: '100%',
            borderRadius: 999,
            background: 'linear-gradient(90deg, #3156D8 0%, #3B82F6 50%, #19D3C5 100%)',
            boxShadow: '0 0 12px rgba(59, 130, 246, 0.45)',
            transformOrigin: 'left',
            transform: `scaleX(${clamped / 100})`,
            transition: 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </Box>
    </Box>
  )
}

