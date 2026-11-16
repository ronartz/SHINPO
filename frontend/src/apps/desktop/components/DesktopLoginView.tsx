import { useMemo } from 'react'
import { DesktopLoginBackground } from './DesktopLoginBackground'
import { AnimatedDesktopLoginCard } from './AnimatedDesktopLoginCard'
import { LegacyDesktopLoginCard } from './LegacyDesktopLoginCard'
import {
  type DesktopLoginCardProps,
  type LoginViewMode,
  DEFAULT_LOGIN_VIEW_MODE,
  LOGIN_VIEW_MODE_STORAGE_KEY,
} from './loginCardTypes'

export interface DesktopLoginViewProps extends DesktopLoginCardProps {
  initialViewMode?: LoginViewMode
}

export function DesktopLoginView(props: DesktopLoginViewProps) {
  const { isDarkMode, isAurora, initialViewMode, ...cardProps } = props

  const activeViewMode: LoginViewMode = useMemo(() => {
    if (initialViewMode) return initialViewMode
    try {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search)
        const qp = urlParams.get('loginCard')
        if (qp === 'legacy-login' || qp === 'animated-login') {
          return qp as LoginViewMode
        }
      }
      const stored = localStorage.getItem(LOGIN_VIEW_MODE_STORAGE_KEY)
      if (stored === 'legacy-login' || stored === 'animated-login') {
        return stored
      }
    } catch {
      // ignore storage access errors
    }
    return DEFAULT_LOGIN_VIEW_MODE
  }, [initialViewMode])

  const themeClass = isDarkMode ? 'theme-dark' : 'theme-light'
  const styleClass = isAurora ? 'theme-aurora' : 'theme-classic'

  return (
    <div
      className={`shinpo-desktop-app auth-fullscreen-container ${themeClass} ${styleClass}`}
      data-login-view-mode={activeViewMode}
    >
      {/* Background layer: Silk Mesh default or Warp legacy */}
      <DesktopLoginBackground isDarkMode={isDarkMode} isAurora={isAurora} />

      {/* Presentation layer: Animated reference-style login or preserved Legacy */}
      {activeViewMode === 'legacy-login' ? (
        <LegacyDesktopLoginCard
          {...cardProps}
          isDarkMode={isDarkMode}
          isAurora={isAurora}
        />
      ) : (
        <AnimatedDesktopLoginCard
          {...cardProps}
          isDarkMode={isDarkMode}
          isAurora={isAurora}
        />
      )}
    </div>
  )
}
