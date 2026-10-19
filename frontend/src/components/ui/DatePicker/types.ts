import React from 'react'

export interface ShinpoDatePickerProps {
  value: string // Format: YYYY-MM-DD
  onChange: (value: string) => void
  id?: string
  name?: string
  label?: string
  placeholder?: string
  helperText?: string
  errorMessage?: string
  disabled?: boolean
  required?: boolean
  minDate?: string // YYYY-MM-DD
  maxDate?: string // YYYY-MM-DD
  allowClear?: boolean
  className?: string
  style?: React.CSSProperties
  'data-tutorial'?: string
  'data-testid'?: string
}

