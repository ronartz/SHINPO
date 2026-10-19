(function youtubeAdapter() {
  'use strict'
  const api = globalThis.browser || globalThis.chrome
  let scheduled = null
  let lastSentUrl = ''

  document.addEventListener('yt-navigate-finish', scheduleNavigationCheck, true)
  globalThis.addEventListener('popstate', scheduleNavigationCheck, true)
  globalThis.addEventListener('pageshow', scheduleNavigationCheck, true)
  scheduleNavigationCheck()

  function scheduleNavigationCheck() {
    if (scheduled !== null) clearTimeout(scheduled)
    scheduled = setTimeout(() => {
      scheduled = null
      const currentUrl = location.href
      if (currentUrl !== lastSentUrl) {
        lastSentUrl = currentUrl
        void api.runtime.sendMessage({ type: 'PAGE_NAVIGATION', url: currentUrl }).catch(() => undefined)
      }
      void refreshPresentation()
    }, 200)
  }

  async function refreshPresentation() {
    try {
      const response = await api.runtime.sendMessage({ type: 'GET_PAGE_SETTINGS' })
      const settings = response?.ok ? response.payload : null
      document.documentElement.classList.toggle(
        'shinpo-hide-youtube-recommendations',
        Boolean(settings?.active && settings?.hideRecommendations),
      )
    } catch {
      document.documentElement.classList.remove('shinpo-hide-youtube-recommendations')
    }
  }
})()
