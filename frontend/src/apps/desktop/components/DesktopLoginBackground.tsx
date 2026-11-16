import { useState } from 'react'
import { AuthWarpBackground } from '../../../components/auth/AuthWarpBackground'
import { SilkLoginBackground } from './SilkLoginBackground'
import {
  type LoginBackgroundMode,
  DEFAULT_LOGIN_BACKGROUND_MODE,
} from './silkShaderMath.ts'

export type { LoginBackgroundMode }
export { DEFAULT_LOGIN_BACKGROUND_MODE }

export interface DesktopLoginBackgroundProps {
  isDarkMode?: boolean
  isAurora?: boolean
  mode?: LoginBackgroundMode
  className?: string
}

export function DesktopLoginBackground({
  isDarkMode = true,
  isAurora = true,
  mode: propMode,
  className = '',
}: DesktopLoginBackgroundProps) {
  const [initialOverride] = useState<LoginBackgroundMode | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search)
        const qp = urlParams.get('loginBg')
        if (qp === 'legacy-warp' || qp === 'silk-mesh') return qp as LoginBackgroundMode
        const stored = sessionStorage.getItem('shinpo_login_bg')
        if (stored === 'legacy-warp' || stored === 'silk-mesh') return stored as LoginBackgroundMode
      } catch {
        // Fall through to default
      }
    }
    return null
  })

  const activeMode: LoginBackgroundMode = propMode ?? initialOverride ?? DEFAULT_LOGIN_BACKGROUND_MODE

  if (activeMode === 'legacy-warp') {
    return <AuthWarpBackground />
  }

  return (
    <SilkLoginBackground
      isDarkMode={isDarkMode}
      isAurora={isAurora}
      className={className}
    />
  )
}
