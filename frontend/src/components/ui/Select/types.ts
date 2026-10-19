import React from 'react'

export interface SelectOption<T = string> {
  value: T
  label: string
  secondaryLabel?: string
  disabled?: boolean
  icon?: React.ReactNode
}

export interface ShinpoSelectProps<T = string> {
  value: T
  onChange: (value: T) => void
  options: SelectOption<T>[]
  id?: string
  name?: string
  label?: string
  placeholder?: string
  helperText?: string
  errorMessage?: string
  disabled?: boolean
  required?: boolean
  size?: 'sm' | 'md' | 'lg'
  searchable?: boolean
  className?: string
  style?: React.CSSProperties
  triggerClassName?: string
  minWidth?: number
  ariaLabel?: string
  'data-tutorial'?: string
  'data-testid'?: string
}

