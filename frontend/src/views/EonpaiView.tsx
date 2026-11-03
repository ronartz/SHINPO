import React, { useState, useRef, useEffect, useCallback } from 'react'
import type {
  ProposedMission,
  TutorialStep,
  BugReportInfo,
  BugReportDraft,
  SessionDebriefAnalysis,
  SessionRecovery,
  DailyPlan,
  RecoveryOption,
  AiActionDto,
  AiProviderStatus,
  Conversation,
} from '../api/ai'
import {
  confirmAiAction,
  listLocalConversations,
  openLocalConversation,
  deleteLocalConversation,
  cancelNativeAiRequest,
  rejectAiAction,
  getPendingAiActions,
  getAiProviderStatus,
} from '../api/ai'
import { isLocalVaultSession } from '../api/auth'
import { Icon } from '../components/common/Icon'
import { MarkdownRenderer } from '../components/common'
import { trackRender } from '../utils/renderTracker'
import { trackMicrokitPointer } from '../components/microkit/pointerGlow'
import type { Goal, Mission } from '../api/goalsAndMissions'
import type { FocusSession } from '../api/focusSessions'

export interface ChatMessage {
  id?: string
  role: 'user' | 'assistant'
  text: string
  missions?: ProposedMission[]
  tutorial?: TutorialStep | null
  bugReport?: BugReportInfo | null
  bugReportDraft?: BugReportDraft | null
  structuredCard?: Record<string, unknown> | null
  suggestionType?: string
  suggestionId?: number
  committed?: boolean
  committing?: boolean
  debriefAnalysis?: SessionDebriefAnalysis | null
  sessionRecovery?: SessionRecovery | null
  dailyPlan?: DailyPlan | null
  actionProposal?: AiActionDto | null
}

export interface EonpaiViewProps {
  chatMessages: ChatMessage[]
  aiLoading: boolean
  isAurora?: boolean
  goals?: Goal[]
  missions?: Mission[]
  sessions?: FocusSession[]
  activeSession?: FocusSession | null
  focusStreak?: number
  handleTriggerPresetAction: (prompt: string) => void
  handleClearChat: () => void | Promise<void>
  handleStartTutorial: (initialStepIndex?: number) => void
  handleArmMissionAsSession: (title: string, duration?: number) => void
  handleCommitDailyPlan: (plan: DailyPlan, index: number, suggestionId?: number) => void | Promise<void>
  handleCommitChatSuggestion: (suggestionId: number, index: number, specificMission?: ProposedMission) => void | Promise<void>
  handleRecoveryActionClick: (opt: RecoveryOption) => void
  handleAiSend: (messageText?: string, contextualSessionId?: number) => void | Promise<void>
  requestConversationDelete?: (title: string, confirm: () => Promise<void>) => void
  onConversationChange?: () => void | Promise<void>
  onActionExecuted?: () => void
  onOpenAiSettings?: () => void
}

interface SpeechRecognitionResultLike extends ArrayLike<{ transcript: string }> {
  isFinal: boolean
}

interface SpeechRecognitionEventLike {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike>
}

interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike
type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

const BUG_FEATURE_OPTIONS = [
  { value: 'FOCUS_ENGINE', label: 'Focus Engine' },
  { value: 'GOALS_KANBAN', label: 'Goals & Tasks' },
  { value: 'CALENDAR_SCHEDULER', label: 'Calendar' },
  { value: 'SENTINEL_SHIELD', label: 'Focus Protection' },
  { value: 'EONPAI_AI', label: 'EONPAI Assistant' },
  { value: 'GENERAL', label: 'General / Other' },
]

function formatJson(raw?: string): string {
  if (!raw) return '{}'
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return JSON.stringify(parsed, null, 2)
  } catch {
    return raw
  }
}

interface BugReportDraftItemProps {
  draft: BugReportDraft
  onSubmit: (feature: string, description: string) => void
}

const BugReportDraftItem: React.FC<BugReportDraftItemProps> = ({ draft, onSubmit }) => {
  const [selectedFeature, setSelectedFeature] = useState(draft.feature || 'FOCUS_ENGINE')
  const [description, setDescription] = useState(draft.summary || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCancelled, setIsCancelled] = useState(false)

  if (isCancelled) {
    return (
      <div className="ai-bug-card cancelled">
        <span className="ai-bug-cancelled-text">Bug report draft dismissed.</span>
      </div>
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim() || isSubmitting) return
    setIsSubmitting(true)
    onSubmit(selectedFeature, description.trim())
  }

  return (
    <form className="ai-bug-draft-card" onSubmit={handleSubmit} role="region" aria-label="Bug Report Draft">
      <div className="ai-bug-header">
        <div className="ai-bug-title-group">
          <Icon name="shield" size={15} />
          <span className="ai-bug-title">VERIFIED BUG REPORT DRAFT</span>
        </div>
        <span className="ai-bug-badge draft">DRAFT</span>
      </div>

      <div className="ai-bug-form-section">
        <label className="ai-bug-field-label">Affected Feature Area</label>
        <div className="ai-bug-chips-row" role="radiogroup" aria-label="Feature Area">
          {BUG_FEATURE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`ai-bug-chip ${selectedFeature === opt.value ? 'selected' : ''}`}
              onClick={() => setSelectedFeature(opt.value)}
              role="radio"
              aria-checked={selectedFeature === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ai-bug-form-section">
        <label className="ai-bug-field-label" htmlFor="bug-description-input">
          Issue Description <span className="ai-bug-required">*</span>
        </label>
        <textarea
          id="bug-description-input"
          className="ai-bug-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what occurred, unexpected behavior, or steps to reproduce..."
          rows={3}
          required
        />
      </div>

      {draft.diagnosticSummary && (
        <div className="ai-bug-telemetry-section">
          <div className="ai-bug-field-label">Attached Runtime Diagnostics</div>
          <div className="ai-bug-telemetry-grid">
            <div className="ai-bug-telemetry-pill">
              <span className="pill-label">OS:</span>
              <span className="pill-val">{draft.diagnosticSummary.os || 'Linux / Windows'}</span>
            </div>
            <div className="ai-bug-telemetry-pill">
              <span className="pill-label">Runtime:</span>
              <span className="pill-val">{draft.diagnosticSummary.jvm || 'JVM 21'}</span>
            </div>
            <div className="ai-bug-telemetry-pill">
              <span className="pill-label">Memory:</span>
              <span className="pill-val">{draft.diagnosticSummary.memory || 'Healthy'}</span>
            </div>
            <div className="ai-bug-telemetry-pill">
              <span className="pill-label">Session:</span>
              <span className="pill-val">{draft.diagnosticSummary.session || 'None'}</span>
            </div>
          </div>
        </div>
      )}

      {draft.diagnosticsJson && draft.diagnosticsJson !== '{}' && (
        <details className="ai-bug-details">
          <summary className="ai-bug-details-summary">Inspect Sanitized Technical Telemetry</summary>
          <pre className="ai-bug-diagnostics-pre">{formatJson(draft.diagnosticsJson)}</pre>
        </details>
      )}

      <div className="ai-bug-actions-row">
        <button
          type="button"
          className="ai-bug-btn-cancel"
          onClick={() => setIsCancelled(true)}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="ai-bug-btn-submit"
          disabled={!description.trim() || isSubmitting}
        >
          {isSubmitting ? (
            <span>Filing Report...</span>
          ) : (
            <>
              <Icon name="check" size={13} />
              <span>Submit Verified Bug Report</span>
            </>
          )}
        </button>
      </div>
    </form>
  )
}

const BugReportReceiptItem: React.FC<{ report: BugReportInfo }> = ({ report }) => {
  return (
    <div className="ai-bug-receipt-card" role="region" aria-label="Bug Report Confirmation Receipt">
      <div className="ai-bug-header">
        <div className="ai-bug-title-group">
          <Icon name="check" size={15} />
          <span className="ai-bug-title">BUG REPORT FILED</span>
        </div>
        <div className="ai-bug-header-badges">
          <span className="ai-bug-id-badge">{report.bugId}</span>
          <span className="ai-bug-badge open">{report.status || 'OPEN'}</span>
        </div>
      </div>

      <div className="ai-bug-receipt-body">
        <div className="ai-bug-receipt-row">
          <span className="ai-bug-receipt-label">Feature Area:</span>
          <span className="ai-bug-feature-tag">{report.feature}</span>
        </div>
        <div className="ai-bug-receipt-row">
          <span className="ai-bug-receipt-label">Summary:</span>
          <span className="ai-bug-receipt-desc">{report.summary}</span>
        </div>
      </div>

      {report.diagnostics && report.diagnostics !== '{}' && (
        <details className="ai-bug-details">
          <summary className="ai-bug-details-summary">Inspect Attached Runtime Telemetry</summary>
          <pre className="ai-bug-diagnostics-pre">{formatJson(report.diagnostics)}</pre>
        </details>
      )}
    </div>
  )
}

export const EonpaiView: React.FC<EonpaiViewProps> = React.memo(({
  chatMessages,
  aiLoading,
  isAurora = false,
  goals = [],
  missions = [],
  sessions = [],
  activeSession = null,
  focusStreak = 0,
  handleTriggerPresetAction,
  handleClearChat,
  handleStartTutorial,
  handleArmMissionAsSession,
  handleCommitDailyPlan,
  handleCommitChatSuggestion,
  handleRecoveryActionClick,
  handleAiSend,
  requestConversationDelete,
  onConversationChange,
  onActionExecuted,
  onOpenAiSettings,
}) => {
  trackRender('EonpaiView')

  const [localInput, setLocalInput] = useState('')
  const [conversations, setConversations] = useState<Omit<Conversation, 'messages'>[]>([])
  const [historyError, setHistoryError] = useState('')
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false)
  const [showMoreActions, setShowMoreActions] = useState(false)
  const [pendingActions, setPendingActions] = useState<AiActionDto[]>([])
  const [aiProviderStatus, setAiProviderStatus] = useState<AiProviderStatus | null>(null)
  const [aiProviderStatusLoaded, setAiProviderStatusLoaded] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [actionFeedback, setActionFeedback] = useState<Record<string, { status: string; message: string }>>({})
  const [isListening, setIsListening] = useState(false)
  const [speechError, setSpeechError] = useState('')
  const [now, setNow] = useState<number | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const aiFeedRef = useRef<HTMLDivElement | null>(null)
  const aiContentRef = useRef<HTMLDivElement | null>(null)
  const autoFollowEnabledRef = useRef(true)
  const lastScrollTopRef = useRef(0)
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null)

  const speechRecognitionApi = typeof window === 'undefined'
    ? undefined
    : (window as SpeechRecognitionWindow).SpeechRecognition ?? (window as SpeechRecognitionWindow).webkitSpeechRecognition
  const todayKey = (() => {
    if (now === null) return ''
    const date = new Date(now)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  })()
  const activeGoals = goals.filter((goal) => !['COMPLETED', 'CANCELLED', 'ARCHIVED'].includes(goal.status.toUpperCase()))
  const todayTasks = missions.filter((mission) => mission.scheduledDate.slice(0, 10) === todayKey && !['COMPLETED', 'CANCELLED'].includes(mission.status.toUpperCase()))
  const upcomingSessions = sessions
    .filter((session) => now !== null && session.status === 'SCHEDULED' && session.scheduledAt && Date.parse(session.scheduledAt) >= now)
    .sort((a, b) => Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!))
    .slice(0, 2)

  useEffect(() => () => speechRecognitionRef.current?.abort(), [])

  useEffect(() => {
    const refreshClock = () => setNow(Date.now())
    refreshClock()
    const interval = window.setInterval(refreshClock, 60_000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    let isCurrent = true
    getAiProviderStatus()
      .then((status) => {
        if (isCurrent) setAiProviderStatus(status)
      })
      .catch(() => {
        if (isCurrent) setAiProviderStatus(null)
      })
      .finally(() => {
        if (isCurrent) setAiProviderStatusLoaded(true)
      })
    return () => { isCurrent = false }
  }, [])

  const loadPendingActions = useCallback(async () => {
    try {
      const list = await getPendingAiActions()
      setPendingActions(list)
    } catch {
      // Ignore background error
    }
  }, [])

  useEffect(() => {
    const task = window.setTimeout(() => void loadPendingActions(), 0)
    return () => window.clearTimeout(task)
  }, [chatMessages.length, loadPendingActions])

  useEffect(() => {
    let current = true
    listLocalConversations().then((items) => { if (current) setConversations(items) }).catch(() => {})
    return () => { current = false }
  }, [aiLoading])

  const changeConversation = async (id: string, remove = false) => {
    setHistoryError('')
    try {
      if (remove) await deleteLocalConversation(id)
      else await openLocalConversation(id)
      await onConversationChange?.()
      setConversations(await listLocalConversations())
    } catch (error) { setHistoryError(error instanceof Error ? error.message : 'Could not change conversation') }
  }

  const providerLabel = aiProviderStatus?.provider === 'gemini'
    ? 'Cloud'
    : aiProviderStatus?.provider === 'ollama'
      ? 'Local'
      : aiProviderStatus?.provider
  const providerStatusLabel = !aiProviderStatusLoaded
    ? 'Checking AI…'
    : !aiProviderStatus
      ? 'Status unavailable'
      : !aiProviderStatus.enabled
        ? aiProviderStatus.status === 'OFFLINE' ? 'Offline · local planning' : 'AI disabled'
        : aiProviderStatus.status === 'CONFIGURED'
          ? `${providerLabel || 'AI'} · configured`
        : aiProviderStatus.available
          ? `${providerLabel} · ${aiProviderStatus.model}`
          : `${providerLabel || 'AI'} unavailable`
  const providerStatusTone = aiProviderStatus?.enabled && aiProviderStatus.available
    ? 'connected'
    : aiProviderStatusLoaded && aiProviderStatus
      ? 'offline'
      : 'unknown'

  useEffect(() => {
    let isCancelled = false
    const refresh = () => {
      getPendingAiActions()
        .then((list) => {
          if (!isCancelled) {
            setPendingActions(list)
          }
        })
        .catch(() => {})
    }
    refresh()
    const interval = setInterval(refresh, 8000)
    return () => {
      isCancelled = true
      clearInterval(interval)
    }
  }, [])

  const handleConfirmAction = useCallback(async (actionId: string) => {
    setActionLoadingId(actionId)
    try {
      const res = await confirmAiAction(actionId, pendingActions.find((action) => action.actionId === actionId)?.confirmationToken)
      setActionFeedback((prev) => ({
        ...prev,
        [actionId]: { status: res.status, message: res.resultSummary || 'Action applied successfully' },
      }))
      await loadPendingActions()
      onActionExecuted?.()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Execution failed'
      setActionFeedback((prev) => ({
        ...prev,
        [actionId]: { status: 'FAILED', message: msg },
      }))
    } finally {
      setActionLoadingId(null)
    }
  }, [loadPendingActions, onActionExecuted, pendingActions])

  const handleRejectAction = useCallback(async (actionId: string) => {
    setActionLoadingId(actionId)
    try {
      await rejectAiAction(actionId)
      setActionFeedback((prev) => ({
        ...prev,
        [actionId]: { status: 'REJECTED', message: 'Action proposal rejected' },
      }))
      await loadPendingActions()
    } catch (err: unknown) {
      console.error('Failed to reject action', err)
    } finally {
      setActionLoadingId(null)
    }
  }, [loadPendingActions])

  const handleSend = useCallback(() => {
    if (!localInput.trim() || aiLoading) return
    handleAiSend(localInput.trim())
    setLocalInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [localInput, aiLoading, handleAiSend])

  const handleVoiceInput = useCallback(() => {
    if (isListening) {
      speechRecognitionRef.current?.stop()
      return
    }
    if (!speechRecognitionApi) {
      setSpeechError('Voice dictation is not supported by this webview. You can still type your message.')
      return
    }

    setSpeechError('')
    const recognition = new speechRecognitionApi()
    speechRecognitionRef.current = recognition
    recognition.lang = navigator.language || 'en-US'
    recognition.interimResults = false
    recognition.continuous = false
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .slice(event.resultIndex)
        .map((result) => result[0]?.transcript.trim() ?? '')
        .filter(Boolean)
        .join(' ')
      if (transcript) {
        setLocalInput((current) => current.trim() ? `${current.trimEnd()} ${transcript}` : transcript)
        requestAnimationFrame(() => textareaRef.current?.focus())
      }
    }
    recognition.onerror = (event) => {
      setSpeechError(event.error === 'not-allowed' || event.error === 'service-not-allowed'
        ? 'Microphone access was denied. Allow microphone access in your system settings and try again.'
        : event.error === 'no-speech'
          ? 'No speech was detected. Try speaking again.'
          : 'Voice dictation stopped. Try again or type your message.')
    }
    recognition.onend = () => {
      speechRecognitionRef.current = null
      setIsListening(false)
    }
    try {
      recognition.start()
      setIsListening(true)
    } catch {
      speechRecognitionRef.current = null
      setIsListening(false)
      setSpeechError('Voice dictation could not start. Check microphone access and try again.')
    }
  }, [isListening, speechRecognitionApi])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  const handleChatScroll = useCallback(() => {
    const feedEl = aiFeedRef.current
    if (!feedEl) return

    const { scrollTop, scrollHeight, clientHeight } = feedEl
    const distFromBottom = scrollHeight - scrollTop - clientHeight

    if (scrollTop < lastScrollTopRef.current - 12) {
      autoFollowEnabledRef.current = false
    }

    if (distFromBottom <= 30) {
      autoFollowEnabledRef.current = true
    }

    setShowScrollBottomBtn(distFromBottom > 60)
    lastScrollTopRef.current = scrollTop
  }, [])

  const handleScrollToBottom = useCallback(() => {
    autoFollowEnabledRef.current = true
    setShowScrollBottomBtn(false)
    if (aiFeedRef.current) {
      aiFeedRef.current.scrollTo({
        top: aiFeedRef.current.scrollHeight,
        behavior: 'smooth',
      })
      lastScrollTopRef.current = aiFeedRef.current.scrollHeight
    }
  }, [])

  // Auto-follow via ResizeObserver on the messages content wrapper
  useEffect(() => {
    const feedEl = aiFeedRef.current
    const contentEl = aiContentRef.current
    if (!feedEl || !contentEl) return

    const observer = new ResizeObserver(() => {
      if (autoFollowEnabledRef.current && feedEl) {
        feedEl.scrollTop = feedEl.scrollHeight
        lastScrollTopRef.current = feedEl.scrollTop
        setShowScrollBottomBtn(false)
      } else if (feedEl) {
        const dist = feedEl.scrollHeight - feedEl.scrollTop - feedEl.clientHeight
        setShowScrollBottomBtn(dist > 60)
      }
    })

    observer.observe(contentEl)
    return () => observer.disconnect()
  }, [])

  // Auto-follow when chat messages or loading state change
  useEffect(() => {
    if (autoFollowEnabledRef.current && aiFeedRef.current) {
      aiFeedRef.current.scrollTop = aiFeedRef.current.scrollHeight
      lastScrollTopRef.current = aiFeedRef.current.scrollTop
    }
  }, [chatMessages, aiLoading])

  return (
    <div className={`eonpai-workspace${isAurora ? ' eonpai-aurora-workspace' : ''}`}>
      {/* Supporting Utility Panel */}
      <aside className="eonpai-utility-panel" aria-label="EONPAI Supporting Tools">
        <div className="eonpai-utility-header">
          <span className="eonpai-utility-title">Quick Actions</span>
          <span className="eonpai-utility-count">6</span>
        </div>

        <nav className="eonpai-command-list" aria-label="Quick Actions">
          <button
            type="button"
            className="eonpai-command-row microkit-staggered-label"
            onClick={() => handleTriggerPresetAction('Plan my day based on scheduled tasks')}
            aria-label="Plan my day"
          >
            <div className="command-row-main">
              <Icon name="schedule" size={14} />
              <span aria-hidden="true">{'Plan my day'.split('').map((letter, index) => (
                <span className="microkit-letter" key={`${letter}-${index}`} style={{ '--letter-index': index } as React.CSSProperties}>{letter === ' ' ? '\u00a0' : letter}</span>
              ))}</span>
            </div>
            <Icon name="arrow-up-right" size={12} className="command-arrow" />
          </button>

          <button
            type="button"
            className="eonpai-command-row"
            onClick={() => handleTriggerPresetAction('What is my next priority task?')}
          >
            <div className="command-row-main">
              <Icon name="target" size={14} />
              <span>Next priority task</span>
            </div>
            <Icon name="arrow-up-right" size={12} className="command-arrow" />
          </button>

          <button
            type="button"
            className="eonpai-command-row microkit-pointer-glow"
            data-microkit-glow
            onPointerMove={trackMicrokitPointer}
            onClick={() => handleTriggerPresetAction('Break down my top priority goal into tasks')}
          >
            <div className="command-row-main">
              <Icon name="plus" size={14} />
              <span>Break down goal</span>
            </div>
            <Icon name="arrow-up-right" size={12} className="command-arrow" />
          </button>

          <button
            type="button"
            className="eonpai-command-row"
            onClick={() => handleTriggerPresetAction('Analyze my last focus session and provide structured feedback')}
          >
            <div className="command-row-main">
              <Icon name="clock" size={14} />
              <span>Summarize session</span>
            </div>
            <Icon name="arrow-up-right" size={12} className="command-arrow" />
          </button>

          <button
            type="button"
            className="eonpai-command-row"
            onClick={() => handleTriggerPresetAction('Check focus protection status and active application policies')}
          >
            <div className="command-row-main">
              <Icon name="shield" size={14} />
              <span>Focus protection</span>
            </div>
            <Icon name="arrow-up-right" size={12} className="command-arrow" />
          </button>

          <button
            type="button"
            className="eonpai-command-row"
            data-command="guided-tour"
            onClick={() => handleStartTutorial()}
          >
            <div className="command-row-main">
              <Icon name="sparkle" size={14} />
              <span>Guided tour</span>
            </div>
            <Icon name="arrow-up-right" size={12} className="command-arrow" />
          </button>

          {showMoreActions && (
            <div className="eonpai-command-more-group">
              <button
                type="button"
                className="eonpai-command-row"
                onClick={() => handleTriggerPresetAction('I need a short break. Guide me through a 5-minute recovery.')}
              >
                <div className="command-row-main">
                  <Icon name="pause" size={14} />
                  <span>Take a break</span>
                </div>
                <Icon name="arrow-up-right" size={12} className="command-arrow" />
              </button>

              <button
                type="button"
                className="eonpai-command-row"
                onClick={() => handleTriggerPresetAction('Report an issue or bug')}
              >
                <div className="command-row-main">
                  <Icon name="edit" size={14} />
                  <span>Report issue</span>
                </div>
                <Icon name="arrow-up-right" size={12} className="command-arrow" />
              </button>
            </div>
          )}

          <button
            type="button"
            className="eonpai-toggle-more-btn microkit-text-swap"
            onClick={() => setShowMoreActions((prev) => !prev)}
            aria-expanded={showMoreActions}
            aria-label={showMoreActions ? 'Show fewer EONPAI actions' : 'Show more EONPAI actions'}
          >
            <span className="microkit-text-swap-window" aria-hidden="true">
              <span className={`microkit-text-swap-track${showMoreActions ? ' is-expanded' : ''}`}>
                <span>More actions (2)</span>
                <span>Show less</span>
              </span>
            </span>
            <Icon className={showMoreActions ? 'is-expanded' : ''} name="chevron" size={12} />
          </button>
        </nav>

        <div className="eonpai-utility-footer">
          {isLocalVaultSession() && <details>
            <summary>Conversation history ({conversations.length})</summary>
            {conversations.map((conversation) => <div key={conversation.conversationId}>
              <button className="eonpai-command-row" type="button" disabled={aiLoading} onClick={() => void changeConversation(conversation.conversationId)}>{conversation.title}</button>
              <button type="button" disabled={aiLoading} aria-label={`Delete conversation: ${conversation.title}`} onClick={() => {
                requestConversationDelete?.(conversation.title, () => changeConversation(conversation.conversationId, true))
              }}>Delete</button>
            </div>)}
            {historyError && <p role="alert">{historyError}</p>}
          </details>}
          {aiLoading && isLocalVaultSession() && <button type="button" onClick={() => void cancelNativeAiRequest().catch((error: unknown) => setHistoryError(error instanceof Error ? error.message : 'Could not cancel request'))}>Stop response</button>}

          <div className="eonpai-tip-box">
            <span className="eonpai-tip-label">Quick Tip</span>
            <p className="eonpai-tip-text">
              Press <kbd>Enter</kbd> to send, <kbd>Shift+Enter</kbd> for a new line.
            </p>
          </div>
        </div>
      </aside>

      {/* Primary Conversation Panel */}
      <section className="eonpai-conversation-card" aria-label="EONPAI Conversation">
        {/* Restrained Single Workspace Header */}
        <header className="eonpai-chat-header">
          <div className="eonpai-identity-wrap">
            <div className={`eonpai-avatar-badge${aiLoading ? ' is-thinking' : ''}`} data-presence={aiLoading ? 'thinking' : 'idle'}>
              <Icon name="sparkle" size={15} />
            </div>
            <div className="eonpai-title-meta">
              <span className="eonpai-session-title">Executive Session</span>
              <span className="eonpai-subtitle">Personal execution assistant</span>
            </div>
            <div className="eonpai-status-badge" title={aiProviderStatus?.message || 'AI provider status has not been reported'}>
              <span className={`eonpai-status-dot ${providerStatusTone}`} aria-hidden="true" />
              <span className="eonpai-status-text" aria-live="polite">{providerStatusLabel}</span>
            </div>
          </div>
          <button
            type="button"
            className="eonpai-new-chat-btn"
            onClick={handleClearChat}
            title="Start fresh conversation"
          >
            <Icon name="refresh" size={13} />
            <span>New Chat</span>
          </button>
        </header>

        {/* Scrollable Message Feed */}
        <div
          className="eonpai-chat-feed"
          ref={aiFeedRef}
          onScroll={handleChatScroll}
          tabIndex={0}
          role="region"
          aria-label="Message Feed"
        >
          <div className={`eonpai-chat-content-wrap${chatMessages.length === 1 && chatMessages[0]?.role === 'assistant' && pendingActions.length === 0 ? ' is-welcome' : ''}`} ref={aiContentRef}>
            {/* Pending Controlled Actions Queue Banner */}
            {pendingActions.length > 0 && (
              <div className="eonpai-pending-banner">
                <div className="pending-banner-info">
                  <Icon name="shield" size={15} />
                  <span>
                    {pendingActions.length} Controlled Action{pendingActions.length > 1 ? 's' : ''} Awaiting Review
                  </span>
                </div>
              </div>
            )}

            {providerStatusTone === 'offline' && (
              <aside className="eonpai-offline-guidance" role="status">
                <div><strong>AI provider unavailable</strong><p>Quick Actions and SHINPO’s built-in planning tools are still available. Check the provider connection and setup in Settings → EONPAI.</p></div>
                {onOpenAiSettings && <button type="button" onClick={onOpenAiSettings}>Open AI settings</button>}
              </aside>
            )}

            {/* Pending Controlled Actions */}
            {pendingActions.map((act) => (
              <div key={act.actionId} className="ai-bubble assistant">
                <div className="ai-bubble-text">
                  <strong>Controlled Action Proposed:</strong> Awaiting your review and explicit approval.
                </div>
                <div className="ai-action-card">
                  <div className="ai-action-header">
                    <div className="ai-action-title-group">
                      <Icon name="shield" size={14} />
                      <span className="ai-action-type">{act.actionType}</span>
                    </div>
                    <span className={`ai-risk-tag ${(act.riskLevel || 'LOW').toLowerCase()}`}>
                      {act.riskLevel || 'LOW'} RISK
                    </span>
                  </div>
                  <div className="ai-action-desc">{act.description}</div>
                  {act.confirmationToken && <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12 }}>{act.payloadJson}</pre>}
                  {actionFeedback[act.actionId] ? (
                    <div className="ai-action-actions-row">
                      <span className={`ai-action-status-badge ${actionFeedback[act.actionId].status.toLowerCase()}`}>
                        {actionFeedback[act.actionId].status}: {actionFeedback[act.actionId].message}
                      </span>
                    </div>
                  ) : (
                    <div className="ai-action-actions-row">
                      <button
                        type="button"
                        className="ai-action-reject-btn"
                        disabled={actionLoadingId === act.actionId}
                        onClick={() => handleRejectAction(act.actionId)}
                      >
                        <span>Reject</span>
                      </button>
                      <button
                        type="button"
                        className="ai-action-apply-btn"
                        disabled={actionLoadingId === act.actionId}
                        onClick={() => handleConfirmAction(act.actionId)}
                      >
                        {actionLoadingId === act.actionId ? (
                          <span>Applying...</span>
                        ) : (
                          <>
                            <Icon name="check" size={13} />
                            <span>Confirm &amp; Apply</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Main Chat Stream */}
            {chatMessages.map((msg, index) => (
              <div
                key={msg.id ?? index}
                className={`ai-bubble ${msg.role === 'user' ? 'user' : 'assistant'}${isAurora && index === 0 && msg.role === 'assistant' && msg.suggestionType === 'GREETING' ? ' eonpai-greeting-bubble' : ''}`}
              >
                {isAurora && index === 0 && msg.role === 'assistant' && msg.suggestionType === 'GREETING' && (
                  <div className="eonpai-welcome-hero">
                    <div className="eonpai-welcome-orb" aria-hidden="true"><span /></div>
                    <div><span className="eonpai-welcome-label">EONPAI</span><h1>Your execution partner.</h1></div>
                  </div>
                )}
                <div className="ai-bubble-text">
                  <MarkdownRenderer content={msg.text} />
                </div>

                {/* Controlled Action Proposal Card */}
                {msg.actionProposal && (
                  <div className="ai-action-card">
                    <div className="ai-action-header">
                      <div className="ai-action-title-group">
                        <Icon name="shield" size={14} />
                        <span className="ai-action-type">{msg.actionProposal.actionType}</span>
                      </div>
                      <span className={`ai-risk-tag ${(msg.actionProposal.riskLevel || 'LOW').toLowerCase()}`}>
                        {msg.actionProposal.riskLevel || 'LOW'} RISK
                      </span>
                    </div>
                    <div className="ai-action-desc">{msg.actionProposal.description}</div>
                    {actionFeedback[msg.actionProposal.actionId] ? (
                      <div className="ai-action-actions-row">
                        <span className={`ai-action-status-badge ${actionFeedback[msg.actionProposal.actionId].status.toLowerCase()}`}>
                          {actionFeedback[msg.actionProposal.actionId].status}: {actionFeedback[msg.actionProposal.actionId].message}
                        </span>
                      </div>
                    ) : (
                      <div className="ai-action-actions-row">
                        <button
                          type="button"
                          className="ai-action-reject-btn"
                          disabled={actionLoadingId === msg.actionProposal.actionId}
                          onClick={() => handleRejectAction(msg.actionProposal!.actionId)}
                        >
                          <span>Reject</span>
                        </button>
                        <button
                          type="button"
                          className="ai-action-apply-btn"
                          disabled={actionLoadingId === msg.actionProposal.actionId}
                          onClick={() => handleConfirmAction(msg.actionProposal!.actionId)}
                        >
                          {actionLoadingId === msg.actionProposal.actionId ? (
                            <span>Applying...</span>
                          ) : (
                            <>
                              <Icon name="check" size={13} />
                              <span>Confirm &amp; Apply</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Interactive Guided Tour Card */}
                {msg.tutorial && (
                  <div className="ai-tutorial-card">
                    <div className="ai-tutorial-header">
                      <span className="tutorial-step-tag">
                        TUTORIAL • STEP {msg.tutorial.stepId}
                      </span>
                      <span className="tutorial-total-steps">
                        {msg.tutorial.tutorialId}
                      </span>
                    </div>
                    <div className="ai-tutorial-content">
                      {msg.tutorial.instruction}
                    </div>
                    <button
                      type="button"
                      className="ai-tutorial-btn"
                      onClick={() => handleStartTutorial()}
                    >
                      <span>Start interactive tour</span>
                      <Icon name="arrow-up-right" size={12} />
                    </button>
                  </div>
                )}

                {/* Verified Bug Report Draft Card */}
                {msg.bugReportDraft && (
                  <BugReportDraftItem
                    draft={msg.bugReportDraft}
                    onSubmit={(feat, desc) => {
                      void handleAiSend(`Submit bug report: [${feat}] ${desc}`)
                    }}
                  />
                )}

                {/* Bug Diagnostics Confirmation Receipt Card */}
                {msg.bugReport && (
                  <BugReportReceiptItem report={msg.bugReport} />
                )}

                {/* Suggested Daily Plan */}
                {msg.dailyPlan && (
                  <div className="ai-plan-card">
                    <div className="ai-plan-header">
                      <div className="ai-plan-title-group">
                        <Icon name="schedule" size={15} />
                        <span className="ai-plan-title">
                          {msg.dailyPlan.headline}
                        </span>
                      </div>
                      <span className="ai-plan-energy-badge">
                        {msg.dailyPlan.rationale}
                      </span>
                    </div>

                    <div className="ai-plan-timeline">
                      {msg.dailyPlan.planItems?.map((item, pIdx) => (
                        <div key={pIdx} className="ai-timeline-block">
                          <div className="timeline-block-time">
                            <span className="timeline-time-str">
                              {item.scheduledStartTime || `${item.durationMinutes}m`}
                            </span>
                            <span className="timeline-duration-badge">
                              {item.durationMinutes}m
                            </span>
                          </div>
                          <div className="timeline-block-content">
                            <div className="timeline-mission-title-row">
                              <span className="timeline-mission-title">{item.missionTitle}</span>
                              {item.energyWindow && (
                                <span className="timeline-window-tag">{item.energyWindow}</span>
                              )}
                            </div>
                            {item.goalTitle && (
                              <div className="timeline-intention">{item.goalTitle}</div>
                            )}
                          </div>
                          <button
                            type="button"
                            className="ai-arm-sprint-btn"
                            onClick={() =>
                              handleArmMissionAsSession(item.missionTitle, item.durationMinutes)
                            }
                            title="Start as focus session"
                          >
                            <span>Start Focus</span>
                            <Icon name="play" size={11} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="ai-plan-actions-row">
                      <button
                        type="button"
                        className="ai-commit-plan-btn"
                        disabled={msg.committing || msg.committed}
                        onClick={() =>
                          handleCommitDailyPlan(msg.dailyPlan!, index, msg.suggestionId)
                        }
                      >
                        <Icon name="check" size={13} />
                        <span>
                          {msg.committed
                            ? 'Agenda Scheduled'
                            : msg.committing
                              ? 'Scheduling Agenda...'
                              : 'Schedule Daily Agenda'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Structured Decomposition Cards - Refined per Section 16 */}
                {msg.missions && msg.missions.length > 0 && (
                  <div className="eonpai-tasks-block">
                    <div className="eonpai-tasks-header">
                      <div className="eonpai-tasks-title-group">
                        <Icon name="target" size={14} />
                        <span className="eonpai-tasks-title">Suggested Tasks</span>
                        <span className="eonpai-tasks-count">{msg.missions.length}</span>
                      </div>
                      <button
                        type="button"
                        className="eonpai-commit-all-btn"
                        disabled={msg.committing || msg.committed}
                        onClick={() =>
                          handleCommitChatSuggestion(msg.suggestionId ?? 0, index)
                        }
                      >
                        <Icon name="plus" size={12} />
                        <span>
                          {msg.committed
                            ? 'Tasks Added'
                            : msg.committing
                              ? 'Adding Tasks...'
                              : 'Add All Tasks'}
                        </span>
                      </button>
                    </div>

                    <div className="eonpai-tasks-list">
                      {msg.missions.map((m, mIdx) => (
                        <div key={mIdx} className="eonpai-task-row" role="group" aria-label={`Task: ${m.title}`}>
                          <div className="eonpai-task-idx">{mIdx + 1}</div>
                          <div className="eonpai-task-details">
                            <div className="eonpai-task-name">{m.title}</div>
                            {m.description && (
                              <div className="eonpai-task-sub">{m.description}</div>
                            )}
                          </div>
                          <div className="eonpai-task-meta">
                            <span className="eonpai-task-duration">{m.estimatedMinutes} min</span>
                            <button
                              type="button"
                              className="eonpai-task-add-btn"
                              disabled={msg.committing || msg.committed}
                              onClick={() =>
                                handleCommitChatSuggestion(msg.suggestionId ?? 0, index, m)
                              }
                              title="Add task to task list"
                            >
                              <Icon name="plus" size={12} />
                              <span>Add</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Session Feedback Debrief Card */}
                {msg.debriefAnalysis && (
                  <div className="ai-debrief-card">
                    <div className="ai-debrief-header">
                      <div className="ai-debrief-title-group">
                        <Icon name="sparkle" size={14} />
                        <span className="ai-debrief-title">
                          Session Feedback: {msg.debriefAnalysis.sessionName} ({msg.debriefAnalysis.actualMinutes}m)
                        </span>
                      </div>
                      <div className="ai-debrief-score-badge">
                        <span>Quality: {msg.debriefAnalysis.completionQuality || 'N/A'}</span>
                      </div>
                    </div>

                    <div className="ai-debrief-metrics-row">
                      <div className="debrief-stat-block">
                        <span className="stat-label">Planned Time</span>
                        <span className="stat-val">{msg.debriefAnalysis.plannedMinutes}m</span>
                      </div>
                      <div className="debrief-stat-block">
                        <span className="stat-label">Estimation Accuracy</span>
                        <span className="stat-val">{msg.debriefAnalysis.estimationAccuracyPct}%</span>
                      </div>
                    </div>

                    {msg.debriefAnalysis.tacticalCritique && (
                      <div className="ai-debrief-critique-box">
                        <div className="ai-debrief-critique-header">
                          <Icon name="target" size={12} />
                          <span>Pacing Review</span>
                        </div>
                        <p className="ai-debrief-text">{msg.debriefAnalysis.tacticalCritique}</p>
                      </div>
                    )}

                    {msg.debriefAnalysis.nextSprintRecommendation && (
                      <div className="ai-debrief-recommendation-box">
                        <div className="ai-debrief-recommendation-header">
                          <Icon name="zap" size={12} />
                          <span>Next Recommendation</span>
                        </div>
                        <p className="ai-debrief-text">{msg.debriefAnalysis.nextSprintRecommendation}</p>
                      </div>
                    )}

                    {msg.debriefAnalysis.suggestedNextSteps && msg.debriefAnalysis.suggestedNextSteps.length > 0 && (
                      <div className="ai-debrief-actions">
                        <span className="ai-debrief-actions-title">Recommended Next Steps:</span>
                        <div className="ai-recovery-options-row">
                          {msg.debriefAnalysis.suggestedNextSteps.map((opt, oIdx) => (
                            <div key={oIdx} className="ai-recovery-option-card">
                              <div className="recovery-option-info">
                                <span className="recovery-option-title">{opt.label}</span>
                                <span className="recovery-option-desc">{opt.suggestedAction}</span>
                              </div>
                              <button
                                type="button"
                                className="ai-arm-sprint-btn"
                                onClick={() => handleRecoveryActionClick(opt)}
                                title={`Activate ${opt.label}`}
                              >
                                <span>Activate</span>
                                <Icon name="arrow-up-right" size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Session Interruption Recovery */}
                {msg.sessionRecovery && (
                  <div className="ai-recovery-card">
                    <div className="ai-recovery-header">
                      <div className="ai-recovery-title-group">
                        <Icon name="zap" size={15} />
                        <span className="ai-recovery-title">Session Interrupted: {msg.sessionRecovery.sessionName}</span>
                      </div>
                      <span className="ai-recovery-trigger-badge">
                        {msg.sessionRecovery.actualMinutes}m / {msg.sessionRecovery.plannedMinutes}m
                      </span>
                    </div>

                    <p className="ai-recovery-diagnosis">
                      {msg.sessionRecovery.diagnosticMessage}
                    </p>

                    <div className="ai-recovery-options-row">
                      {msg.sessionRecovery.recoveryOptions?.map((opt, oIdx) => (
                        <div key={oIdx} className="ai-recovery-option-card">
                          <div className="recovery-option-info">
                            <span className="recovery-option-title">{opt.label}</span>
                            <span className="recovery-option-desc">{opt.suggestedAction}</span>
                          </div>
                          <button
                            type="button"
                            className="ai-arm-sprint-btn"
                            onClick={() => handleRecoveryActionClick(opt)}
                            title={`Activate ${opt.label}`}
                          >
                            <span>Activate</span>
                            <Icon name="arrow-up-right" size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {aiLoading && (
              <div className="ai-bubble assistant eonpai-thinking-bubble">
                <span className="thinking-dot-pulse" />
                <span>EONPAI is formulating a response...</span>
              </div>
            )}
          </div>
        </div>

        {/* Floating Scroll to Bottom Button */}
        {showScrollBottomBtn && (
          <button
            type="button"
            className="ai-scroll-bottom-btn"
            onClick={handleScrollToBottom}
            aria-label="Jump to latest messages"
            title="Jump to latest"
          >
            ↓
          </button>
        )}

        {/* Fixed Modern Composer at Bottom */}
        <footer className="eonpai-composer" data-tutorial="eonpai-composer">
          <div className="eonpai-composer-inner">
            <textarea
              ref={textareaRef}
              rows={1}
              className="eonpai-composer-input"
              placeholder="Ask EONPAI to plan your day, decompose a goal, or review focus..."
              value={localInput}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              disabled={aiLoading}
              aria-label="Message to EONPAI"
            />
            {isAurora && (
              <button
                type="button"
                className={`eonpai-voice-btn${isListening ? ' is-listening' : ''}`}
                onClick={handleVoiceInput}
                disabled={aiLoading}
                aria-label={isListening ? 'Stop voice dictation' : 'Start voice dictation'}
                aria-pressed={isListening}
                title={speechRecognitionApi ? (isListening ? 'Stop dictation' : 'Speak to dictate') : 'Voice dictation is not supported by this webview'}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2.5" width="6" height="12" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5M8.5 21.5h7" /></svg>
              </button>
            )}
            <button
              type="button"
              className="eonpai-composer-send-btn microkit-sliding-send"
              onClick={handleSend}
              disabled={aiLoading || !localInput.trim()}
              title="Send Message"
            >
              <span>Send</span>
              <span className="microkit-send-icon"><Icon name="arrow-up-right" size={13} /></span>
            </button>
          </div>
          {isAurora && speechError && <p className="eonpai-speech-status" role="status">{speechError}</p>}
        </footer>
      </section>

      {isAurora && (
        <aside className="eonpai-context-panel" aria-label="Today’s SHINPO context">
          <header className="eonpai-context-header">
            <div><h2>Today’s Context</h2><p>{now === null ? ' ' : new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(now))}</p></div>
          </header>
          <div className="eonpai-context-stats">
            <div className="eonpai-context-stat"><Icon name="clock" size={16} /><span>Focus</span><strong>{activeSession ? activeSession.status === 'PAUSED' ? 'Paused' : 'In progress' : 'Ready'}</strong><small>{activeSession?.name ?? 'No active session'}</small></div>
            <div className="eonpai-context-stat"><Icon name="goals" size={16} /><span>Active goals</span><strong>{activeGoals.length}</strong><small>On your plan</small></div>
            <div className="eonpai-context-stat"><Icon name="check" size={16} /><span>Tasks today</span><strong>{todayTasks.length}</strong><small>Still to complete</small></div>
            <div className="eonpai-context-stat"><Icon name="rewards" size={16} /><span>Focus streak</span><strong>{focusStreak} <small>days</small></strong><small>Keep your rhythm</small></div>
          </div>

          <section className="eonpai-context-section">
            <header><h3>Active Goals</h3><span>{activeGoals.length}</span></header>
            {activeGoals.length ? activeGoals.slice(0, 3).map((goal) => {
              const linked = missions.filter((mission) => mission.goalId === goal.id)
              const complete = linked.filter((mission) => mission.status.toUpperCase() === 'COMPLETED').length
              const progress = linked.length ? Math.round((complete / linked.length) * 100) : 0
              return <button type="button" className="eonpai-context-goal" key={goal.id} onClick={() => handleTriggerPresetAction(`Help me make progress on my goal: ${goal.title}`)}><span>{goal.title}</span><small>{progress}%</small><i><b style={{ width: `${progress}%` }} /></i></button>
            }) : <p className="eonpai-context-empty">No active goals yet.</p>}
          </section>

          <section className="eonpai-context-section">
            <header><h3>Today’s Tasks</h3><span>{todayTasks.length}</span></header>
            {todayTasks.length ? todayTasks.slice(0, 4).map((mission) => <button type="button" className="eonpai-context-task" key={mission.id} onClick={() => handleTriggerPresetAction(`Help me with this task: ${mission.title}`)}><span className="eonpai-context-task-dot" /><span>{mission.title}</span><small>{mission.estimatedMinutes ? `${mission.estimatedMinutes}m` : 'Task'}</small></button>) : <p className="eonpai-context-empty">Nothing scheduled for today.</p>}
          </section>

          <section className="eonpai-context-section eonpai-upcoming-section">
            <header><h3>Upcoming Focus</h3><span>{upcomingSessions.length}</span></header>
            {upcomingSessions.length ? upcomingSessions.map((session) => <div className="eonpai-upcoming-session" key={session.id}><span>{session.name}</span><small>{session.scheduledAt ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(session.scheduledAt)) : 'Scheduled'} · {session.durationMinutes}m</small></div>) : <p className="eonpai-context-empty">No upcoming focus blocks.</p>}
          </section>
        </aside>
      )}
    </div>
  )
})
