import React, { useEffect } from 'react'

export interface CustomCursorProps {
  dotSize?: number
  ringSize?: number
  color?: string
  enableTextMorph?: boolean
}

/**
 * CustomCursor - Neutralized for native operating system cursor performance.
 * Ensures native mouse interaction, eliminates mousemove re-renders, and prevents click latency.
 */
export const CustomCursor: React.FC<CustomCursorProps> = () => {
  useEffect(() => {
    // Ensure any previously added custom-cursor class is stripped from root
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('custom-cursor-active')
    }
  }, [])

  return null
}

export default CustomCursor
