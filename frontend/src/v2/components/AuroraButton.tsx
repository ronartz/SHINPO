import React from 'react'
import { Button as MuiButton, type ButtonProps } from '@mui/material'

export interface AuroraButtonProps extends ButtonProps {
  variantStyle?: 'aurora-primary' | 'aurora-secondary' | 'aurora-ghost' | 'neumorphic'
  children: React.ReactNode
}

export const AuroraButton: React.FC<AuroraButtonProps> = ({
  variantStyle = 'aurora-primary',
  children,
  className = '',
  sx,
  ...props
}) => {
  if (variantStyle === 'aurora-primary') {
    return (
      <button
        data-interactive-btn="true"
        data-interactive-variant="primary"
        className={`aurora-btn-primary ${className}`.trim()}
        {...(props as unknown as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {children}
      </button>
    )
  }

  if (variantStyle === 'aurora-secondary') {
    return (
      <button
        data-interactive-btn="true"
        data-interactive-variant="secondary"
        className={`aurora-btn-secondary ${className}`.trim()}
        {...(props as unknown as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {children}
      </button>
    )
  }

  if (variantStyle === 'aurora-ghost') {
    return (
      <button
        data-interactive-btn="true"
        data-interactive-variant="ghost"
        className={`aurora-btn-ghost ${className}`.trim()}
        {...(props as unknown as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {children}
      </button>
    )
  }

  return (
    <MuiButton
      variant="contained"
      data-interactive-btn="true"
      className={className}
      sx={{
        borderRadius: 3,
        fontWeight: 600,
        textTransform: 'none',
        fontSize: 14.5,
        ...sx,
      }}
      {...props}
    >
      {children}
    </MuiButton>
  )
}
