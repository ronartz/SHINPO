import React from 'react'
import { Card as MuiCard, CardContent, type CardProps } from '@mui/material'

export interface AuroraCardProps extends CardProps {
  tiltVariant?: 'right' | 'left' | 'lift' | 'none'
  glass?: boolean
  noPadding?: boolean
  children?: React.ReactNode
}

export const AuroraCard: React.FC<AuroraCardProps> = ({
  tiltVariant = 'lift',
  glass = false,
  noPadding = false,
  children,
  className = '',
  sx,
  ...props
}) => {
  const tiltClass =
    tiltVariant === 'right'
      ? 'aurora-card-interactive aurora-tilt-right'
      : tiltVariant === 'left'
      ? 'aurora-card-interactive aurora-tilt-left'
      : tiltVariant === 'lift'
      ? 'aurora-card-interactive aurora-tilt-lift'
      : ''

  const glassClass = glass ? 'aurora-glass' : ''

  return (
    <MuiCard
      className={`${tiltClass} ${glassClass} ${className}`.trim()}
      tabIndex={tiltVariant !== 'none' ? 0 : undefined}
      sx={{
        overflow: 'visible',
        ...sx,
      }}
      {...props}
    >
      {noPadding ? children : <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>{children}</CardContent>}
    </MuiCard>
  )
}

