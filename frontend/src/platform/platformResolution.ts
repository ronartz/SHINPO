export type Platform = 'desktop' | 'mobile'

/**
 * Deterministic platform resolution.
 * Resizing a desktop window NEVER changes the platform to mobile.
 * Resolution precedence:
 * 1. Build-time environment variable (VITE_SHINPO_PLATFORM)
 * 2. URL search parameter (?platform=mobile | ?platform=desktop)
 * 3. LocalStorage persistence (shinpo_platform)
 * 4. Default: 'desktop'
 */
export function getPlatform(): Platform {
  // 1. Build-time environment variable
  const envPlatform = typeof import.meta !== 'undefined' && import.meta.env ? (import.meta.env.VITE_SHINPO_PLATFORM as string | undefined) : undefined
  if (envPlatform === 'mobile' || envPlatform === 'desktop') {
    return envPlatform
  }

  // 2. Explicit URL query parameter
  if (typeof window !== 'undefined' && window.location) {
    try {
      const params = new URLSearchParams(window.location.search)
      const paramPlatform = params.get('platform')
      if (paramPlatform === 'mobile' || paramPlatform === 'desktop') {
        return paramPlatform
      }
    } catch {
      // ignore URL parsing issues
    }
  }

  // 3. LocalStorage override
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('shinpo_platform')
      if (stored === 'mobile' || stored === 'desktop') {
        return stored
      }
    }
  } catch {
    // ignore storage access errors
  }

  // 4. Default: desktop
  return 'desktop'
}

export function setPlatform(platform: Platform): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('shinpo_platform', platform)
    }
  } catch {
    // ignore
  }
}
