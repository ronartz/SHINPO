import React, { lazy, Suspense, useEffect, useState } from 'react'
import { getPlatform, setPlatform, type Platform } from './platformResolution'

export type { Platform }

// Lazy load platform-specific bundles so only the active platform tree is loaded
const DesktopApp = lazy(() => import('../apps/desktop/DesktopApp'))
const MobileApp = lazy(() => import('../apps/mobile/MobileApp'))

export const PlatformRoot: React.FC = () => {
  const [platform, setPlatformState] = useState<Platform>(getPlatform)

  useEffect(() => {
    document.documentElement.setAttribute('data-platform', platform)
  }, [platform])

  return (
    <Suspense
      fallback={
        <div
          style={{
            display: 'flex',
            height: '100vh',
            width: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg, #0b0f19)',
            color: 'var(--text-secondary, #94a3b8)',
            fontFamily: 'Nunito, sans-serif',
          }}
        >
          <span>Loading SHINPO...</span>
        </div>
      }
    >
      {platform === 'mobile' ? (
        <MobileApp
          onSwitchToDesktop={() => {
            setPlatform('desktop')
            setPlatformState('desktop')
            if (typeof window !== 'undefined' && window.location) {
              const url = new URL(window.location.href)
              url.searchParams.set('platform', 'desktop')
              window.history.replaceState({}, '', url.toString())
            }
          }}
        />
      ) : (
        <DesktopApp />
      )}
    </Suspense>
  )
}

export default PlatformRoot
