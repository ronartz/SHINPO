import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/nunito/400.css'
import '@fontsource/nunito/500.css'
import '@fontsource/nunito/600.css'
import '@fontsource/nunito/700.css'
import '@fontsource/nunito/800.css'
import './index.css'
import { PlatformRoot } from './platform'
import { ErrorBoundary } from './components/common/ErrorBoundary'

const params = new URLSearchParams(window.location.search)
let savedBrand: string | null = null
let savedTheme: string | null = null
try {
  savedBrand = localStorage.getItem('shinpo_v2_preview')
  savedTheme = localStorage.getItem('shinpo_theme')
} catch {
  // Theme selection still works from URL parameters when storage is unavailable.
}
const isAurora = params.get('v2') === 'true' || (params.get('v2') !== 'false' && (savedBrand === null || savedBrand === 'true'))
const isLight = params.get('theme') === 'light' || (params.get('theme') !== 'dark' && savedTheme === 'light')
document.documentElement.setAttribute('data-brand', isAurora ? 'aurora' : 'classic')
document.documentElement.setAttribute('data-theme', isLight ? 'light' : 'dark')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <PlatformRoot />
    </ErrorBoundary>
  </StrictMode>,
)
