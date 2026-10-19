import React from 'react'

export interface ShinpoTimePickerProps {
  value: string // Format: HH:mm (24h)
  onChange: (value: string) => void
  id?: string
  name?: string
  label?: string
  placeholder?: string
  helperText?: string
  errorMessage?: string
  disabled?: boolean
  required?: boolean
  stepMinutes?: number // Default: 5
  className?: string
  style?: React.CSSProperties
  'data-tutorial'?: string
  'data-testid'?: string
}

