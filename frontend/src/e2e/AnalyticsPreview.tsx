import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import '../App.css'
import { AnalyticsView } from '../views/AnalyticsView'

const params = new URLSearchParams(window.location.search)
const isAurora = params.get('brand') !== 'classic'
const isLight = params.get('theme') === 'light'
document.documentElement.dataset.brand = isAurora ? 'aurora' : 'classic'
document.documentElement.dataset.theme = isLight ? 'light' : 'dark'

export function Preview() {
  const [retryCount, setRetryCount] = useState(0)
  return <div className={`app-shell shinpo-glass-ui${isAurora ? ' theme-aurora' : ''}${isLight ? ' theme-light' : ' theme-dark'}`} style={{ width: '100vw', minHeight: '100vh' }}>
    <div className="app-content-stage">
      <AnalyticsView
        analyticsData={null}
        analyticsLoading={false}
        analyticsError
        loadAnalytics={() => setRetryCount((count) => count + 1)}
        onNavigateFocus={() => undefined}
      />
    </div>
    <output aria-label="Retry callback count">{retryCount}</output>
  </div>
}

createRoot(document.getElementById('root')!).render(<Preview />)
