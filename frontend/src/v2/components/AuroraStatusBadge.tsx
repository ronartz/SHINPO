import React from 'react'

export interface AuroraStatusBadgeProps {
  label: string
  color?: 'purple' | 'blue' | 'cyan' | 'emerald' | 'coral'
  dot?: boolean
  className?: string
}

export const AuroraStatusBadge: React.FC<AuroraStatusBadgeProps> = ({
  label,
  color = 'blue',
  dot = false,
  className = '',
}) => {
  return (
    <span className={`aurora-badge ${color} ${className}`.trim()}>
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: 'currentColor',
            display: 'inline-block',
          }}
        />
      )}
      {label}
    </span>
  )
}

