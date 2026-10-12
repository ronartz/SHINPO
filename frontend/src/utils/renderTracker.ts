declare global {
  interface Window {
    __SHINPO_RENDER_COUNTS?: Record<string, number>
    __SHINPO_API_CALLS?: Record<string, number>
  }
}

export function trackRender(componentName: string): void {
  if (typeof window !== 'undefined') {
    window.__SHINPO_RENDER_COUNTS = window.__SHINPO_RENDER_COUNTS || {}
    window.__SHINPO_RENDER_COUNTS[componentName] =
      (window.__SHINPO_RENDER_COUNTS[componentName] || 0) + 1
  }
}

export function trackApiCall(endpoint: string): void {
  if (typeof window !== 'undefined') {
    window.__SHINPO_API_CALLS = window.__SHINPO_API_CALLS || {}
    window.__SHINPO_API_CALLS[endpoint] =
      (window.__SHINPO_API_CALLS[endpoint] || 0) + 1
  }
}

