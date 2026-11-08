import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/nunito/400.css'
import '@fontsource/nunito/500.css'
import '@fontsource/nunito/600.css'
import '@fontsource/nunito/700.css'
import '@fontsource/nunito/800.css'
import '../index.css'
import '../App.css'
import { EonpaiView, type ChatMessage } from '../views/EonpaiView'

const params = new URLSearchParams(window.location.search)
const isAurora = params.get('brand') !== 'classic'
const isLight = params.get('theme') === 'light'
document.documentElement.dataset.brand = isAurora ? 'aurora' : 'classic'
document.documentElement.dataset.theme = isLight ? 'light' : 'dark'

export function Preview() {
  const [dispatched, setDispatched] = useState('')
  const messages: ChatMessage[] = params.has('message')
    ? [{ id: 'fixture-message', role: 'user', text: 'Fixture message for copy-control verification.' }]
    : [{ role: 'assistant', text: 'Fixture greeting hidden by the task-oriented empty state.', suggestionType: 'GREETING' }]

  return (
    <div className={`app-shell shinpo-glass-ui${isAurora ? ' theme-aurora' : ''}${isLight ? ' theme-light' : ' theme-dark'}`} style={{ width: '100vw', height: '100vh' }}>
      <main className="app-main app-main-ai" style={{ margin: 0, width: '100%', maxWidth: '100%' }}>
        <div className="cockpit-top-bar" aria-label="SHINPO application header">SHINPO · EONPAI</div>
        <div className="app-content-stage app-content-stage-ai">
          <EonpaiView
            chatMessages={messages}
            aiLoading={false}
            isAurora={isAurora}
            goals={[]}
            missions={[]}
            sessions={[]}
            activeSession={null}
            focusStreak={0}
            handleTriggerPresetAction={(prompt) => setDispatched(`Preset callback: ${prompt}`)}
            handleClearChat={() => setDispatched('New conversation callback')}
            handleStartTutorial={() => undefined}
            handleArmMissionAsSession={() => undefined}
            handleCommitDailyPlan={() => undefined}
            handleCommitChatSuggestion={() => undefined}
            handleRecoveryActionClick={() => undefined}
            handleAiSend={(text) => setDispatched(`Message callback: ${text ?? ''}`)}
            onConversationChange={() => undefined}
          />
        </div>
        <div role="status" aria-label="Fixture callback result" className="eonpai-preview-output">{dispatched}</div>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Preview />)
