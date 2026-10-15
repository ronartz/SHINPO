import { useState, useCallback, useEffect } from 'react'

export function useTheme() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const param = new URLSearchParams(window.location.search).get('theme')
      if (param === 'light') return false
      if (param === 'dark') return true
      const stored = localStorage.getItem('shinpo_theme')
      if (stored === 'light') return false
      if (stored === 'dark') return true
    }
    return true
  })

  const [isV2Preview, setIsV2Preview] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const urlV2 = new URLSearchParams(window.location.search).get('v2')
      if (urlV2 === 'true') return true
      if (urlV2 === 'false') return false
      try {
        const stored = localStorage.getItem('shinpo_v2_preview')
        if (stored !== null) return stored === 'true'
      } catch {
        // ignore localStorage errors
      }
    }
    return false
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('shinpo_theme', isDarkMode ? 'dark' : 'light')
      document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light')
    }
  }, [isDarkMode])

  const handleToggleTheme = useCallback(() => {
    setIsDarkMode((prev) => !prev)
  }, [])

  const handleToggleV2Preview = useCallback(() => {
    setIsV2Preview((prev) => {
      const next = !prev
      try {
        localStorage.setItem('shinpo_v2_preview', String(next))
      } catch {
        // ignore localStorage errors
      }
      return next
    })
  }, [])

  return {
    isDarkMode,
    setIsDarkMode,
    isV2Preview,
    setIsV2Preview,
    handleToggleTheme,
    handleToggleV2Preview,
  }
}

