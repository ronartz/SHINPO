import { TaskManagerView } from './views/TaskManagerView'
import { AnalyticsView } from './views/AnalyticsView'
import { ScheduleView } from './views/ScheduleView'
import { GoalsView } from './views/GoalsView'
import { OverviewView } from './views/OverviewView'
import { EonpaiView } from './views/EonpaiView'
import { FocusView } from './views/FocusView'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import {
  cancelFocusSession,
  completeFocusSession,
  createFocusSession,
  deleteFocusSession,
  getFocusSessions,
  pauseFocusSession,
  resumeFocusSession,
  startFocusSession,
} from './api/focusSessions'

import type { FocusSession } from './api/focusSessions'
import {
  clearActiveConversation,
  commitDailyPlan,
  commitSuggestion,
  decomposeGoal,
  getActiveConversation,
  getExecutiveBriefing,
  sendAiChat,
} from './api/ai'
import type {
  BugReportInfo,
  DailyPlan,
  ExecutiveBriefing,
  GoalDecomposition,
  NextActionCard,
  ProposedMission,
  RecoveryOption,
  SessionDebriefAnalysis,
  SessionRecovery,
  StructuredCard,
  TutorialStep,
} from './api/ai'
import {
  completeMission,
  createGoal,
  createMission,
  deleteAllGoals,
  deleteAllMissions,
  deleteGoal,
  deleteMission,
  getGoals,
  getMissions,
  updateGoal,
  updateMission,
} from './api/goalsAndMissions'
import type { Goal, Mission } from './api/goalsAndMissions'
import {
  authHeaders,
  clearAuthSession,
  fetchCurrentUser,
  getAuthenticatedUserId,
  getStoredUser,
  login,
  logout,
  register,
} from './api/auth'
import type { AuthUser } from './api/auth'
import {
  fetchDeviceSnapshot,
  terminateProcess,
  fetchSentinelStatus,
  fetchSentinelRules,
  fetchSentinelTamperEvents,
  fetchActiveWarnings,
  respondToWarning,
} from './api/device'
import type {
  ProcessInfo,
  ProcessSnapshot,
  SentinelStatus,
  PolicyRule,
  SentinelTamperEventItem,
  SentinelQuarantineItem,
  SentinelWarningItem,
} from './api/device'
import { fetchAnalyticsDashboard } from './api/analytics'
import type { AnalyticsDashboardResponse } from './api/analytics'
import { ShinpoLogo } from './components/ShinpoLogo'
import { TutorialOverlay } from './components/TutorialOverlay'
import { ConfirmationDialog } from './components/ConfirmationDialog'
import { DistractionWarningModal } from './components/dialogs/DistractionWarningModal'
import { SessionSummaryModal } from './components/dialogs/SessionSummaryModal'
import { CreateGoalModal } from './components/dialogs/CreateGoalModal'
import { EditGoalModal } from './components/dialogs/EditGoalModal'
import { EditTaskModal } from './components/dialogs/EditTaskModal'
import { ScheduleSessionModal } from './components/dialogs/ScheduleSessionModal'
import { TelemetryDrawer } from './components/dialogs/TelemetryDrawer'
import { FloatingToasts } from './components/dialogs/FloatingToasts'
import type { LiveAlertItem } from './types/telemetry'
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { SHINPO_ONBOARDING_STEPS } from './tutorial/tutorialSteps'
import { wsClient } from './api/websocket'
import type {
  SentinelQuarantineEvent,
  SentinelStatusEvent,
  FocusSessionEvent,
} from './api/websocket'

import { getInitialShinpoMessage, getNextShinpoMessage } from './utils/shinpoMessages'
import type { ShinpoMessage } from './utils/shinpoMessages'
import {
  calculateRemainingSeconds,
  pomodoroPlans,
} from './utils/focusTimer'
import type { AppView } from './types/navigation'
import { trackRender } from './utils/renderTracker'

import './App.css'

const formatLocalCalendarDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const localCalendarDate = (date = new Date()): string => formatLocalCalendarDate(date)

const addLocalCalendarDays = (days: number): string => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return localCalendarDate(date)
}

export type { LiveAlertItem }

type Dashboard = {
  user: {
    id: number
    username: string
  }
  progress: {
    total: number
  }
  missions: {
    total: number
    completed: number
    pending: number
  }
  goals: {
    id: number
    title: string
    status: string
  }[]
}

function mapStructuredCard(card: StructuredCard | null | undefined, suggestionType?: string): ProposedMission[] {
  if (!card) return []
  if (Array.isArray(card)) return card
  if ('proposedMissions' in card) return card.proposedMissions
  if ('planItems' in card) {
    return card.planItems.map((item) => ({
      title: item.missionTitle,
      description: `${item.goalTitle} • Priority: ${item.priority}`,
      estimatedMinutes: item.durationMinutes,
    }))
  }
  if (suggestionType === 'NEXT_ACTION' && 'missionTitle' in card) {
    const actionCard = card as NextActionCard
    return [{
      title: actionCard.missionTitle,
      description: actionCard.recommendedAction ?? actionCard.rationale ?? '',
      estimatedMinutes: actionCard.estimatedMinutes ?? 25,
    }]
  }
  return []
}

function hasHttpStatus(error: unknown, status: number): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === status
}

export function App() {
  trackRender('App')
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(getStoredUser())
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN')
  const [authIdentifier, setAuthIdentifier] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)

  const [_dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [sessions, setSessions] = useState<FocusSession[]>([])
  const scheduledCount = sessions.filter((s) => s.status === 'SCHEDULED' || Boolean(s.scheduledAt && s.status !== 'COMPLETED')).length
  const [selectedDuration, setSelectedDuration] = useState(30)
  const [isCustomDuration, setIsCustomDuration] = useState(false)
  const [sessionIntention, setSessionIntention] = useState('')
  const [activeTab, setActiveTab] = useState(() => {
    return new URLSearchParams(window.location.search).get('tab') || 'Dashboard'
  })
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return new URLSearchParams(window.location.search).get('theme') === 'light' ? false : true
  })
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth > 1000
    }
    return true
  })

  useEffect(() => {
    let prevWidth = typeof window !== 'undefined' ? window.innerWidth : 1200
    const handleResize = () => {
      const currentWidth = window.innerWidth
      if (prevWidth > 1000 && currentWidth <= 1000) {
        setSidebarExpanded(false)
      } else if (prevWidth <= 1000 && currentWidth > 1000) {
        setSidebarExpanded(true)
      }
      prevWidth = currentWidth
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  const [selectedPomodoroPlan, setSelectedPomodoroPlan] = useState<string | null>(null)
  const [liveAlerts, setLiveAlerts] = useState<LiveAlertItem[]>([])
  const [toastAlerts, setToastAlerts] = useState<LiveAlertItem[]>([])
  const [isAlertsDrawerOpen, setIsAlertsDrawerOpen] = useState(false)
  const [isWsConnected, setIsWsConnected] = useState(false)
  const [unreadAlertCount, setUnreadAlertCount] = useState(0)
  const [shinpoMessage, setShinpoMessage] = useState<ShinpoMessage>(() => getInitialShinpoMessage())

  const handleRefreshShinpoMessage = useCallback(() => {
    setShinpoMessage((prev) => getNextShinpoMessage(prev.id))
  }, [])

  // In-app Accessible Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: React.ReactNode
    confirmLabel?: string
    cancelLabel?: string
    isDestructive?: boolean
    isLoading?: boolean
    errorMessage?: string | null
    onConfirm: () => Promise<void> | void
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  })

  const requestConfirmation = useCallback(
    ({
      title,
      message,
      confirmLabel = 'Confirm',
      cancelLabel = 'Cancel',
      isDestructive = false,
      onConfirm,
    }: {
      title: string
      message: React.ReactNode
      confirmLabel?: string
      cancelLabel?: string
      isDestructive?: boolean
      onConfirm: () => Promise<void> | void
    }) => {
      setConfirmDialog({
        isOpen: true,
        title,
        message,
        confirmLabel,
        cancelLabel,
        isDestructive,
        isLoading: false,
        errorMessage: null,
        onConfirm: async () => {
          try {
            setConfirmDialog((prev) => ({ ...prev, isLoading: true, errorMessage: null }))
            await onConfirm()
            setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }))
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Operation failed. Please try again.'
            setConfirmDialog((prev) => ({ ...prev, isLoading: false, errorMessage: msg }))
          }
        },
      })
    },
    [],
  )

  const closeConfirmation = useCallback(() => {
    setConfirmDialog((prev) => ({ ...prev, isOpen: false, errorMessage: null }))
  }, [])



  // Session Reflection Modal
  const [completingSessionId, setCompletingSessionId] = useState<number | null>(null)
  const [completionQuality, setCompletionQuality] = useState(5)
  const [accomplishment, setAccomplishment] = useState('')
  const [reflectionNotes, setReflectionNotes] = useState('')

  // AI Assistant Chat State
  const [chatMessages, setChatMessages] = useState<
    {
      id?: string
      role: 'user' | 'assistant'
      text: string
      missions?: ProposedMission[]
      tutorial?: TutorialStep | null
      bugReport?: BugReportInfo | null
      suggestionType?: string
      suggestionId?: number
      committed?: boolean
      committing?: boolean
      debriefAnalysis?: SessionDebriefAnalysis | null
      sessionRecovery?: SessionRecovery | null
      dailyPlan?: DailyPlan | null
    }[]
  >([
    {
      role: 'assistant',
      text: 'Good day. I am EONPAI, your personal execution companion native to SHINPO.\n\nI can plan your day, break down goals, guide you through interactive tutorials, explain Sentinel blocks, and file sanitized bug reports. What would you like to work on?',
      suggestionType: 'GREETING',
    },
  ])
  const [aiLoading, setAiLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)

  const handleClearChat = async () => {
    try {
      const fresh = await clearActiveConversation()
      setConversationId(fresh.conversationId)
      setChatMessages([
        {
          role: 'assistant',
          text: 'Conversation archived. I am ready for your next focus session or operational directive.',
          suggestionType: 'GREETING',
        },
      ])
    } catch (err) {
      console.error('Failed to clear conversation:', err)
    }
  }


  // Interactive Guided Tour State
  const [isTutorialActive, setIsTutorialActive] = useState(false)
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0)

  const handleStartTutorial = (initialStepIndex = 0) => {
    setIsTutorialActive(true)
    setTutorialStepIndex(initialStepIndex)
    const step = SHINPO_ONBOARDING_STEPS[initialStepIndex]
    if (step && step.targetTab) {
      setActiveTab(step.targetTab)
    }
  }

  const handleNextTutorialStep = () => {
    if (tutorialStepIndex < SHINPO_ONBOARDING_STEPS.length - 1) {
      const nextIndex = tutorialStepIndex + 1
      setTutorialStepIndex(nextIndex)
      const nextStep = SHINPO_ONBOARDING_STEPS[nextIndex]
      if (nextStep && nextStep.targetTab) {
        setActiveTab(nextStep.targetTab)
      }
    } else {
      handleCompleteTutorial()
    }
  }

  const handlePrevTutorialStep = () => {
    if (tutorialStepIndex > 0) {
      const prevIndex = tutorialStepIndex - 1
      setTutorialStepIndex(prevIndex)
      const prevStep = SHINPO_ONBOARDING_STEPS[prevIndex]
      if (prevStep && prevStep.targetTab) {
        setActiveTab(prevStep.targetTab)
      }
    }
  }

  const handleExitTutorial = () => {
    setIsTutorialActive(false)
    setChatMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        text: 'No problem. You can restart the walkthrough whenever you need it by asking "How do I use SHINPO?" or clicking "Start Guided Walkthrough".',
        suggestionType: 'COACH',
      },
    ])
  }

  const handleCompleteTutorial = () => {
    setIsTutorialActive(false)
    try {
      localStorage.setItem('shinpo_tutorial_completed', 'true')
    } catch {
      // ignore storage failure
    }
    setChatMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        text: "You're all set. You now know the complete core SHINPO loop: Goal -> Task -> Schedule -> Focus Session -> Focus Protection -> Session Summary -> Analytics.",
        suggestionType: 'COACH',
      },
    ])
  }

  // Goals & Missions Deck State
  const [goals, setGoals] = useState<Goal[]>([])
  const [missions, setMissions] = useState<Mission[]>([])
  const [isCreatingGoal, setIsCreatingGoal] = useState(false)
  const [newGoalTitle, setNewGoalTitle] = useState('')
  const [newGoalDesc, setNewGoalDesc] = useState('')
  const [newGoalDate, setNewGoalDate] = useState(() => addLocalCalendarDays(30))
  const [decomposingGoalId, setDecomposingGoalId] = useState<number | null>(null)
  const [aiDecompResult, setAiDecompResult] = useState<GoalDecomposition | null>(null)
  const [topSearchQuery, setTopSearchQuery] = useState('')

  // Edit Goal & Mission State
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [editGoalTitle, setEditGoalTitle] = useState('')
  const [editGoalDesc, setEditGoalDesc] = useState('')
  const [editGoalTargetDate, setEditGoalTargetDate] = useState('')
  const [editGoalStatus, setEditGoalStatus] = useState('ACTIVE')

  const [editingMission, setEditingMission] = useState<Mission | null>(null)
  const [editMissionTitle, setEditMissionTitle] = useState('')
  const [editMissionDesc, setEditMissionDesc] = useState('')
  const [editMissionGoalId, setEditMissionGoalId] = useState<number | null>(null)
  const [editMissionDate, setEditMissionDate] = useState('')
  const [editMissionMinutes, setEditMissionMinutes] = useState(25)
  const [editMissionStatus, setEditMissionStatus] = useState('PENDING')

  // Schedule Deck State (C-002)
  const [selectedScheduleDate, setSelectedScheduleDate] = useState<string>(() => {
    return new URLSearchParams(window.location.search).get('date') || localCalendarDate()
  })
  const [isBookingSession, setIsBookingSession] = useState(() => new URLSearchParams(window.location.search).get('book') === 'true')
  const [bookMissionId, setBookMissionId] = useState<number | null>(null)
  const [bookName, setBookName] = useState('')
  const [bookIntention, setBookIntention] = useState('')
  const [bookDate, setBookDate] = useState(() => localCalendarDate())
  const [bookTime, setBookTime] = useState('09:00')
  const [bookDuration, setBookDuration] = useState(25)
  const [bookPlanName, setBookPlanName] = useState<string | null>('Classic Pomodoro')

  // Device Task Manager Deck State (C-027)
  const [deviceSnapshot, setDeviceSnapshot] = useState<ProcessSnapshot | null>(null)
  const [tmLoading, setTmLoading] = useState(false)
  const [tmSearch, setTmSearch] = useState('')
  const [tmPolicy, setTmPolicy] = useState('ALL')
  const [tmRefreshKey, setTmRefreshKey] = useState(0)
  const tmPolicyRef = useRef(tmPolicy)
  const [tmToast, setTmToast] = useState<string | null>(null)

  // Sentinel Enforcement & Telemetry State (Phase 3.1 & 3.2)
  const [sentinelStatus, setSentinelStatus] = useState<SentinelStatus | null>(null)
  const [sentinelRules, setSentinelRules] = useState<PolicyRule[]>([])
  const [tamperEvents, setTamperEvents] = useState<SentinelTamperEventItem[]>([])
  const [tamperEventsExpanded, setTamperEventsExpanded] = useState(false)
  const [tamperEventsLoading, setTamperEventsLoading] = useState(false)

  // Sentinel Discipline Warning & Grace Period State (Item 3 & 4)
  const [activeWarnings, setActiveWarnings] = useState<SentinelWarningItem[]>([])
  const [selectedGraceMinutes, setSelectedGraceMinutes] = useState(5)
  const [warningSubmitting, setWarningSubmitting] = useState(false)
  const [warningError, setWarningError] = useState<string | null>(null)

  // Operational Velocity & Telemetry State (C-003)
  const [analyticsData, setAnalyticsData] = useState<AnalyticsDashboardResponse | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  // Executive Briefing (AI.9) State
  const [executiveBriefing, setExecutiveBriefing] = useState<ExecutiveBriefing | null>(null)
  const [isBriefingExpanded, setIsBriefingExpanded] = useState<boolean>(true)
  const [briefingLoading, setBriefingLoading] = useState<boolean>(false)

  // Interactive Dashboard / Flight Deck States
  const [inspectingMission, setInspectingMission] = useState<Mission | null>(null)
  const [activeTaskMenu, setActiveTaskMenu] = useState<{
    task: Mission
    rect: DOMRect
  } | null>(null)
  const [deletingMissionId, setDeletingMissionId] = useState<number | null>(null)
  const [isCreatingQuickMission, setIsCreatingQuickMission] = useState(false)
  const [quickMissionTitle, setQuickMissionTitle] = useState('')
  const [quickMissionGoalId, setQuickMissionGoalId] = useState<number | null>(null)
  const [quickMissionDuration, setQuickMissionDuration] = useState(25)
  const [isSubmittingQuickMission, setIsSubmittingQuickMission] = useState(false)
  const [quickMissionError, setQuickMissionError] = useState<string | null>(null)

  const handleQuickCreateMission = async (e: FormEvent) => {
    e.preventDefault()
    if (!quickMissionTitle.trim() || !quickMissionGoalId) return
    setQuickMissionError(null)
    setIsSubmittingQuickMission(true)
    try {
      const today = localCalendarDate()
      await createMission({
        goalId: quickMissionGoalId,
        title: quickMissionTitle.trim(),
        description: 'Focus session execution',
        scheduledDate: today,
        estimatedMinutes: quickMissionDuration,
      })
      setQuickMissionTitle('')
      setIsCreatingQuickMission(false)
      await loadData()
    } catch (err) {
      console.error('Failed to create quick mission', err)
      setQuickMissionError('Could not create mission. Please try again.')
      if (hasHttpStatus(err, 401)) {
        clearAuthSession()
        setCurrentUser(null)
        setIsCreatingQuickMission(false)
        setQuickMissionTitle('')
        setQuickMissionError(null)
      }
    } finally {
      setIsSubmittingQuickMission(false)
    }
  }

  const nextActionMission = useMemo(() => {
    return missions.find((m) => m.status !== 'COMPLETED') || null
  }, [missions])




  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light')
    if (isDarkMode) {
      document.body.classList.remove('theme-light')
      document.body.classList.add('theme-dark')
    } else {
      document.body.classList.remove('theme-dark')
      document.body.classList.add('theme-light')
    }
  }, [isDarkMode])
 
  useEffect(() => {
    if (!activeTaskMenu) return
    const handleClickOutside = () => setActiveTaskMenu(null)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveTaskMenu(null)
    }
    const handleScroll = () => setActiveTaskMenu(null)
    window.addEventListener('click', handleClickOutside)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      window.removeEventListener('click', handleClickOutside)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [activeTaskMenu])

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard', { headers: authHeaders() })
      if (res.ok) {
        const d = await res.json()
        setDashboard(d)
      } else if (res.status === 401) {
        clearAuthSession()
        setCurrentUser(null)
        return
      }
    } catch {
      // Keep offline
    }

    try {
      const [g, m, s, analytics, sentStatus, briefing, warnings] = await Promise.all([
        getGoals(),
        getMissions(),
        getFocusSessions(),
        fetchAnalyticsDashboard().catch(() => null),
        fetchSentinelStatus().catch(() => null),
        getExecutiveBriefing().catch(() => null),
        fetchActiveWarnings().catch(() => []),
      ])
      setGoals(g)
      setMissions(m)
      setSessions(s)
      if (analytics) setAnalyticsData(analytics)
      if (sentStatus) setSentinelStatus(sentStatus)
      if (briefing) setExecutiveBriefing(briefing)
      if (warnings) setActiveWarnings(warnings)
    } catch {
      // Keep empty if backend offline
    }

  }, [setSentinelStatus])

  const refreshBriefing = async () => {
    setBriefingLoading(true)
    try {
      const b = await getExecutiveBriefing()
      setExecutiveBriefing(b)
    } catch (err) {
      console.error('Failed to refresh executive briefing', err)
    } finally {
      setBriefingLoading(false)
    }
  }

  const loadActiveConversation = useCallback(async () => {
    try {
      const conv = await getActiveConversation()
      if (!conv) return
      setConversationId(conv.conversationId)
      if (conv.messages?.length) {
        setChatMessages(
          conv.messages
            .filter((message) => message.role === 'USER' || message.role === 'ASSISTANT')
            .map((message) => ({
              role: message.role === 'USER' ? 'user' as const : 'assistant' as const,
              text: message.content,
              suggestionType: message.suggestionType,
              suggestionId: message.structuredCard && typeof message.structuredCard === 'object' && 'suggestionId' in message.structuredCard
                ? (message.structuredCard as { suggestionId?: number }).suggestionId
                : undefined,
              missions: mapStructuredCard(message.structuredCard, message.suggestionType),
              tutorial: message.tutorial,
              bugReport: message.bugReport,
              debriefAnalysis:
                message.suggestionType === 'DEBRIEF_ANALYSIS' && message.structuredCard
                  ? (message.structuredCard as SessionDebriefAnalysis)
                  : null,
              sessionRecovery:
                message.suggestionType === 'SESSION_RECOVERY' && message.structuredCard
                  ? (message.structuredCard as SessionRecovery)
                  : null,
              dailyPlan:
                (message.suggestionType === 'PLANNER' || message.suggestionType === 'DAILY_PLAN') && message.structuredCard && 'planItems' in message.structuredCard
                  ? (message.structuredCard as DailyPlan)
                  : null,
            })),
        )
      }
    } catch {
      // Keep initial chat
    }
  }, [])

  useEffect(() => {
    fetchCurrentUser().then((user) => {
      if (user) setCurrentUser(user)
    })
  }, [])

  useEffect(() => {
    if (!currentUser) return
    const timer = setTimeout(() => {
      void loadData()
      void loadActiveConversation()
    }, 0)
    return () => clearTimeout(timer)
  }, [currentUser, loadData, loadActiveConversation])

  const addLiveAlert = useCallback((alert: LiveAlertItem) => {
    setLiveAlerts((prev) => [alert, ...prev].slice(0, 50))
    setToastAlerts((prev) => [alert, ...prev].slice(0, 4))
    setUnreadAlertCount((prev) => prev + 1)
    setTimeout(() => {
      setToastAlerts((prev) => prev.filter((item) => item.id !== alert.id))
    }, 6500)
  }, [])

  useEffect(() => {
    return wsClient.onConnectionChange((connected) => {
      setIsWsConnected(connected)
    })
  }, [])

  useEffect(() => {
    if (!currentUser) {
      wsClient.disconnect()
      return
    }

    wsClient.connect(currentUser.id)

    const unsubQuarantine = wsClient.onQuarantine((event: SentinelQuarantineEvent) => {
      addLiveAlert({
        id: `quarantine-${event.id}-${Date.now()}`,
        type: 'quarantine',
        title: `Focus Protection: Closed ${event.processName}`,
        badge: `PID ${event.pid} • ${event.enforcementAction || 'TERMINATED'}`,
        description: event.reason,
        timestamp: event.timestamp || new Date().toISOString(),
      })

      setSentinelStatus((prev) => {
        if (!prev) return prev
        const newItem: SentinelQuarantineItem = {
          id: event.id,
          focusSessionId: event.focusSessionId,
          pid: event.pid,
          processName: event.processName,
          commandLine: null,
          policyAction: event.enforcementAction,
          enforcementMode: event.enforcementAction,
          reason: event.reason,
          detectedAt: event.timestamp || new Date().toISOString(),
        }
        return {
          ...prev,
          totalInterceptedToday: (prev.totalInterceptedToday || 0) + 1,
          lastSweepAt: event.timestamp || new Date().toISOString(),
          recentQuarantines: [newItem, ...prev.recentQuarantines.filter((q) => q.id !== event.id)].slice(0, 50),
        }
      })
    })

    const unsubStatus = wsClient.onSentinelStatus((event: SentinelStatusEvent) => {
      setSentinelStatus((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          enforcementMode: event.mode,
          isPolicyLocked: event.isLocked,
          activePolicyRulesCount: event.blockedCount + event.allowedCount,
        }
      })
      addLiveAlert({
        id: `status-${Date.now()}`,
        type: 'sentinel',
        title: `Protection Policy: ${event.mode}`,
        badge: event.isLocked ? 'STRICT LOCKED' : 'PERMISSIVE',
        description: `${event.blockedCount} blocked rules actively guarded.`,
        timestamp: event.timestamp || new Date().toISOString(),
      })
    })

    const unsubSession = wsClient.onFocusSession((event: FocusSessionEvent) => {
      void getFocusSessions().then((updatedSessions) => {
        setSessions(updatedSessions)
      }).catch(() => {})

      const statusLabel =
        event.status === 'ACTIVE'
          ? 'Started'
          : event.status === 'PAUSED'
            ? 'Paused'
            : event.status === 'COMPLETED'
              ? 'Completed'
              : event.status === 'CANCELLED'
                ? 'Cancelled'
                : event.status

      addLiveAlert({
        id: `session-${event.id}-${Date.now()}`,
        type: 'focus',
        title: `Focus Session ${statusLabel}`,
        badge: `Session #${event.id} • ${event.plannedDurationMinutes}m`,
        description:
          event.status === 'ACTIVE'
            ? 'Focus protection active.'
            : event.debriefNotes || `Focus session transitioned to ${event.status}.`,
        timestamp: event.timestamp || new Date().toISOString(),
      })
    })

    return () => {
      unsubQuarantine()
      unsubStatus()
      unsubSession()
    }
  }, [currentUser, addLiveAlert])

  const loadSentinelTamperEvents = useCallback(async () => {
    setTamperEventsLoading(true)
    try {
      const events = await fetchSentinelTamperEvents()
      setTamperEvents(events)
    } catch (err) {
      console.error('Failed to load Sentinel tamper events', err)
    } finally {
      setTamperEventsLoading(false)
    }
  }, [setTamperEvents])

  const loadDeviceProcesses = useCallback(async (search = tmSearch, policy = tmPolicy) => {
    setTmLoading(true)
    try {
      const [snap, sentStatus, rules, tEvents] = await Promise.all([
        fetchDeviceSnapshot(search, policy),
        fetchSentinelStatus().catch(() => null),
        fetchSentinelRules().catch(() => []),
        fetchSentinelTamperEvents().catch(() => []),
      ])
      setDeviceSnapshot(snap)
      if (sentStatus) setSentinelStatus(sentStatus)
      if (rules) setSentinelRules(rules)
      if (tEvents) setTamperEvents(tEvents)
    } catch (err) {
      console.error('Failed to load device snapshot', err)
    } finally {
      setTmLoading(false)
    }
  }, [tmSearch, tmPolicy, setSentinelStatus, setSentinelRules, setTamperEvents])

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true)
    try {
      const data = await fetchAnalyticsDashboard()
      setAnalyticsData(data)
    } catch (err) {
      console.error('Failed to load analytics dashboard', err)
    } finally {
      setAnalyticsLoading(false)
    }
  }, [])

  const handleTerminateProcess = (proc: ProcessInfo) => {
    requestConfirmation({
      title: 'Terminate Process',
      message: (
        <div>
          <p style={{ margin: '0 0 8px 0' }}>
            Are you sure you want to terminate <strong>{proc.name}</strong> (PID {proc.pid})?
          </p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
            Unsaved work in that application may be lost.
          </p>
        </div>
      ),
      confirmLabel: 'Terminate',
      cancelLabel: 'Cancel',
      isDestructive: true,
      onConfirm: async () => {
        const res = await terminateProcess(proc.pid, true)
        if (res.status === 'SUCCESS' || res.status === 'FORCE_KILL') {
          setTmToast(`Process ${proc.name} (PID ${proc.pid}) terminated`)
          setTmRefreshKey((key) => key + 1)
        } else {
          setTmToast(`Notice: ${res.message}`)
        }
        setTimeout(() => setTmToast(null), 4000)
      },
    })
  }

  useEffect(() => {
    if (!currentUser) return
    if (activeTab === 'Task Manager') {
      const policyChanged = tmPolicyRef.current !== tmPolicy
      tmPolicyRef.current = tmPolicy
      const timer = setTimeout(() => {
        void loadDeviceProcesses(tmSearch, tmPolicy)
      }, policyChanged ? 0 : 300)
      return () => clearTimeout(timer)
    } else if (activeTab === 'Analytics') {
      const timer = setTimeout(() => {
        void loadAnalytics()
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [activeTab, currentUser, loadDeviceProcesses, loadAnalytics, tmSearch, tmPolicy, tmRefreshKey])

  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setAuthError(null)
    setAuthLoading(true)
    try {
      if (authMode === 'LOGIN') {
        const res = await login(authIdentifier.trim(), authPassword)
        setCurrentUser(res.user)
      } else {
        const res = await register(authIdentifier.trim(), authEmail.trim(), authPassword)
        setCurrentUser(res.user)
      }
      setAuthIdentifier('')
      setAuthEmail('')
      setAuthPassword('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed'
      setAuthError(msg)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = useCallback(async () => {
    await logout()
    wsClient.disconnect()
    setIsWsConnected(false)
    setLiveAlerts([])
    setToastAlerts([])
    setUnreadAlertCount(0)
    setCurrentUser(null)
    setDashboard(null)
    setSessions([])
    setGoals([])
    setMissions([])
  }, [])

  const handleToggleSidebar = useCallback(() => {
    setSidebarExpanded((prev) => !prev)
  }, [])

  const handleSelectTab = useCallback((tab: AppView) => {
    setActiveTab(tab)
  }, [])

  const handleToggleAlertsDrawer = useCallback(() => {
    setIsAlertsDrawerOpen((prev) => !prev)
    setUnreadAlertCount(0)
  }, [])

  const handleToggleTheme = useCallback(() => {
    setIsDarkMode((prev) => !prev)
  }, [])

  const handleQuickDemoFill = () => {
    setAuthMode('LOGIN')
    setAuthIdentifier('EONX')
    setAuthPassword('shinpo_dev')
  }

  const handleCreateGoal = async (e: FormEvent) => {
    e.preventDefault()
    if (!currentUser || !newGoalTitle.trim()) return
    try {
      const created = await createGoal({
        userId: currentUser.id,
        title: newGoalTitle.trim(),
        description: newGoalDesc.trim() || undefined,
        startDate: localCalendarDate(),
        targetDate: newGoalDate || undefined,
      })
      setGoals((prev) => [created, ...prev])
      setIsCreatingGoal(false)
      setNewGoalTitle('')
      setNewGoalDesc('')
      loadData()
      if (isTutorialActive && SHINPO_ONBOARDING_STEPS[tutorialStepIndex]?.id === 'CREATE_GOAL') {
        handleNextTutorialStep()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const openEditGoalModal = (g: Goal) => {
    setEditingGoal(g)
    setEditGoalTitle(g.title)
    setEditGoalDesc(g.description || '')
    setEditGoalTargetDate(g.targetDate || '')
    setEditGoalStatus(g.status || 'ACTIVE')
  }

  const handleUpdateGoalSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingGoal || !editGoalTitle.trim()) return
    try {
      const updated = await updateGoal(editingGoal.id, {
        title: editGoalTitle.trim(),
        description: editGoalDesc.trim() || null,
        startDate: editingGoal.startDate,
        targetDate: editGoalTargetDate || null,
        status: editGoalStatus,
      })
      setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)))
      setEditingGoal(null)
      loadData()
    } catch (err) {
      console.error('Failed to update goal', err)
      setToastAlerts((prev) => [
        ...prev,
        {
          id: 'toast-err-' + Date.now(),
          title: 'Goal Update Failed',
          description: 'Could not update goal. Please try again.',
          type: 'focus',
          timestamp: new Date().toISOString(),
        },
      ])
    }
  }

  const openEditMissionModal = (m: Mission) => {
    setEditingMission(m)
    setEditMissionTitle(m.title)
    setEditMissionDesc(m.description || '')
    setEditMissionGoalId(m.goalId)
    setEditMissionDate(m.scheduledDate)
    setEditMissionMinutes(m.estimatedMinutes || 25)
    setEditMissionStatus(m.status || 'PENDING')
  }

  const handleUpdateMissionSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingMission || !editMissionTitle.trim()) return
    try {
      const updated = await updateMission(editingMission.id, {
        goalId: editMissionGoalId ?? editingMission.goalId,
        title: editMissionTitle.trim(),
        description: editMissionDesc.trim() || null,
        scheduledDate: editMissionDate,
        estimatedMinutes: editMissionMinutes,
        status: editMissionStatus,
      })
      setMissions((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
      setEditingMission(null)
      loadData()
    } catch (err) {
      console.error('Failed to update task', err)
      setToastAlerts((prev) => [
        ...prev,
        {
          id: 'toast-err-' + Date.now(),
          title: 'Task Update Failed',
          description: 'Could not update task. Please try again.',
          type: 'focus',
          timestamp: new Date().toISOString(),
        },
      ])
    }
  }

  const handleDeconstructGoal = async (goalId: number) => {
    if (!currentUser) return
    setDecomposingGoalId(goalId)
    try {
      const result = await decomposeGoal(goalId, currentUser.id)
      setAiDecompResult(result)
      if (isTutorialActive && SHINPO_ONBOARDING_STEPS[tutorialStepIndex]?.id === 'DECONSTRUCT_GOAL') {
        handleNextTutorialStep()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setDecomposingGoalId(null)
    }
  }

  const handleCommitAiMissions = async () => {
    if (!aiDecompResult) return
    try {
      if (aiDecompResult.suggestionId) {
        await commitSuggestion(aiDecompResult.suggestionId, { targetGoalId: aiDecompResult.goalId })
      } else {
        const today = localCalendarDate()
        const created = await Promise.all(
          aiDecompResult.proposedMissions.map((pm) =>
            createMission({
              goalId: aiDecompResult.goalId,
              title: pm.title,
              description: pm.description,
              scheduledDate: today,
              estimatedMinutes: pm.estimatedMinutes,
            }),
          ),
        )
        setMissions((prev) => [...created, ...prev])
      }
      setAiDecompResult(null)
      loadData()
    } catch (err) {
      console.error('Failed to commit AI decomposition missions', err)
    }
  }

  const handleCommitChatSuggestion = async (
    suggestionId: number,
    msgIndex: number,
    specificMission?: ProposedMission,
  ) => {
    setChatMessages((prev) =>
      prev.map((msg, idx) =>
        idx === msgIndex ? { ...msg, committing: true } : msg,
      ),
    )
    try {
      const activeGoalId = goals.length > 0 ? goals[0].id : undefined
      await commitSuggestion(suggestionId, {
        targetGoalId: activeGoalId,
        selectedMissions: specificMission ? [specificMission] : undefined,
      })
      await loadData()
      setChatMessages((prev) =>
        prev.map((msg, idx) =>
          idx === msgIndex
            ? { ...msg, committing: false, committed: specificMission ? msg.committed : true }
            : msg,
        ),
      )
    } catch (err) {
      console.error('Failed to commit suggestion', err)
      setChatMessages((prev) =>
        prev.map((msg, idx) =>
          idx === msgIndex ? { ...msg, committing: false } : msg,
        ),
      )
    }
  }

  const handleCommitDailyPlan = async (
    plan: DailyPlan,
    msgIndex: number,
    suggestionId?: number,
  ) => {
    setChatMessages((prev) =>
      prev.map((msg, idx) =>
        idx === msgIndex ? { ...msg, committing: true } : msg,
      ),
    )
    try {
      await commitDailyPlan({
        suggestionId: suggestionId || plan.suggestionId || undefined,
        selectedItems: plan.planItems,
      })
      await loadData()
      setChatMessages((prev) =>
        prev.map((msg, idx) =>
          idx === msgIndex
            ? { ...msg, committing: false, committed: true }
            : msg,
        ),
      )
    } catch (err) {
      console.error('Failed to commit daily plan to schedule:', err)
      setChatMessages((prev) =>
        prev.map((msg, idx) =>
          idx === msgIndex ? { ...msg, committing: false } : msg,
        ),
      )
    }
  }

  const handleToggleMissionComplete = async (missionId: number) => {
    try {
      await completeMission(missionId)
      setMissions((prev) =>
        prev.map((m) => (m.id === missionId ? { ...m, status: 'COMPLETED' } : m)),
      )
      loadData()
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteGoal = (goalId: number, goalTitle: string) => {
    requestConfirmation({
      title: 'Delete Goal',
      message: (
        <div>
          <p style={{ margin: '0 0 8px 0' }}>
            Are you sure you want to delete <strong>"{goalTitle}"</strong>?
          </p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
            All linked tasks will also be permanently removed. This action cannot be undone.
          </p>
        </div>
      ),
      confirmLabel: 'Delete Goal',
      cancelLabel: 'Cancel',
      isDestructive: true,
      onConfirm: async () => {
        await deleteGoal(goalId)
        setGoals((prev) => prev.filter((g) => g.id !== goalId))
        setMissions((prev) => prev.filter((m) => m.goalId !== goalId))
        await loadData()
      },
    })
  }

  const handleDeleteAllGoals = () => {
    if (goals.length === 0) return
    const totalMissions = missions.filter((mission) => goals.some((goal) => goal.id === mission.goalId)).length
    requestConfirmation({
      title: 'Delete All Goals',
      message: (
        <div>
          <p style={{ margin: '0 0 8px 0' }}>
            Delete all <strong>{goals.length} goal(s)</strong> and <strong>{totalMissions} linked task(s)</strong>?
          </p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
            This action is permanent and cannot be undone.
          </p>
        </div>
      ),
      confirmLabel: 'Delete All Goals',
      cancelLabel: 'Cancel',
      isDestructive: true,
      onConfirm: async () => {
        await deleteAllGoals()
        setGoals([])
        setMissions((prev) => prev.filter((mission) => !goals.some((goal) => goal.id === mission.goalId)))
        await loadData()
      },
    })
  }

  const handleDeleteMission = (missionId: number, missionTitle: string) => {
    if (deletingMissionId === missionId) return
    requestConfirmation({
      title: 'Delete Task',
      message: (
        <div>
          <p style={{ margin: '0 0 8px 0' }}>
            Delete task <strong>"{missionTitle}"</strong>?
          </p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
            This will permanently remove the task from your workspace.
          </p>
        </div>
      ),
      confirmLabel: 'Delete Task',
      cancelLabel: 'Cancel',
      isDestructive: true,
      onConfirm: async () => {
        setDeletingMissionId(missionId)
        try {
          await deleteMission(missionId)
          setMissions((prev) => prev.filter((m) => m.id !== missionId))
          if (inspectingMission?.id === missionId) {
            setInspectingMission(null)
          }
          setActiveTaskMenu(null)
          await loadData()
        } catch (err: unknown) {
          if (hasHttpStatus(err, 404)) {
            // Concurrency / already deleted on server: safely synchronize state
            setMissions((prev) => prev.filter((m) => m.id !== missionId))
            if (inspectingMission?.id === missionId) {
              setInspectingMission(null)
            }
            setActiveTaskMenu(null)
            await loadData()
          } else {
            throw err
          }
        } finally {
          setDeletingMissionId(null)
        }
      },
    })
  }

  const handleDeleteMissionBulk = () => {
    if (missions.length === 0) return
    requestConfirmation({
      title: 'Clear All Tasks',
      message: (
        <div>
          <p style={{ margin: '0 0 8px 0' }}>
            Clear all <strong>{missions.length} task(s)</strong>?
          </p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
            This removes every task in your workspace while keeping your goals intact. This action cannot be undone.
          </p>
        </div>
      ),
      confirmLabel: 'Clear All Tasks',
      cancelLabel: 'Cancel',
      isDestructive: true,
      onConfirm: async () => {
        await deleteAllMissions()
        setMissions([])
        await loadData()
      },
    })
  }

  const handleDeleteSession = (sessionId: number) => {
    if (!currentUser) return
    requestConfirmation({
      title: 'Delete Focus Session',
      message: (
        <div>
          <p style={{ margin: '0 0 8px 0' }}>
            Delete focus session <strong>#{sessionId}</strong>?
          </p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
            This session record and its summary data will be removed.
          </p>
        </div>
      ),
      confirmLabel: 'Delete Session',
      cancelLabel: 'Cancel',
      isDestructive: true,
      onConfirm: async () => {
        await deleteFocusSession(sessionId, currentUser.id)
        setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      },
    })
  }

  const activeSession = useMemo(() => {
    return sessions.find(
      (s) => s.status === 'ACTIVE' || s.status === 'PAUSED',
    )
  }, [sessions])

  // Sentinel Warning & Grace Computations (Item 3 & 4)
  const pendingWarning = activeWarnings.find((w) => w.status === 'ISSUED') ?? null
  const activeGraceWarning = activeWarnings.find((w) => w.status === 'GRACE_ACTIVE') ?? null

  // Timer ticker with background-tab throttling resilience
  // Only ticks when an active countdown or warning is visible/live
  const [timerNow, setTimerNow] = useState(() => Date.now())
  useEffect(() => {
    const isLiveDisplay = activeTab === 'Focus Engine' || activeTab === 'Dashboard'
    const isWarningLive = Boolean(pendingWarning?.decisionDeadline) || Boolean(activeGraceWarning?.graceExpiresAt)
    const isTickingNeeded = (activeSession?.status === 'ACTIVE' && isLiveDisplay) || isWarningLive

    if (!isTickingNeeded) return

    const update = () => setTimerNow(Date.now())
    update() // immediately sync on entering live display
    const interval = setInterval(update, 1000)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') update()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', update)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', update)
    }
  }, [activeSession?.status, activeTab, pendingWarning?.decisionDeadline, activeGraceWarning?.graceExpiresAt])

  // Poll for Sentinel warnings during active focus session or while warnings/grace windows exist
  useEffect(() => {
    if (!currentUser) return
    const pollWarnings = async () => {
      try {
        const w = await fetchActiveWarnings()
        setActiveWarnings(w)
      } catch {
        // Ignore background polling errors
      }
    }
    if (activeSession || activeWarnings.length > 0) {
      const interval = setInterval(pollWarnings, 4000)
      return () => clearInterval(interval)
    }
  }, [currentUser, activeSession, activeWarnings.length])

  const timerSeconds = useMemo(() => {
    return calculateRemainingSeconds(activeSession, timerNow, selectedDuration)
  }, [activeSession, timerNow, selectedDuration])

  const warningSecondsLeft = useMemo(() => {
    if (!pendingWarning || !pendingWarning.decisionDeadline) return 0
    const deadlineMs = new Date(pendingWarning.decisionDeadline).getTime()
    return Math.max(0, Math.floor((deadlineMs - timerNow) / 1000))
  }, [pendingWarning, timerNow])

  const graceSecondsLeft = useMemo(() => {
    if (!activeGraceWarning || !activeGraceWarning.graceExpiresAt) return 0
    const expiresMs = new Date(activeGraceWarning.graceExpiresAt).getTime()
    return Math.max(0, Math.floor((expiresMs - timerNow) / 1000))
  }, [activeGraceWarning, timerNow])

  const handleRespondToWarning = async (action: 'GRANT_GRACE' | 'TERMINATE_NOW') => {
    if (!pendingWarning) return
    setWarningSubmitting(true)
    setWarningError(null)
    try {
      // Server is authoritative: cap graceMinutes between 1 and 20
      const graceMin = action === 'GRANT_GRACE' ? Math.min(20, Math.max(1, selectedGraceMinutes)) : undefined
      const updated = await respondToWarning(pendingWarning.warningId, action, graceMin)
      setActiveWarnings((prev) =>
        prev.map((w) => (w.warningId === updated.warningId ? updated : w)).filter((w) => w.status === 'ISSUED' || w.status === 'GRACE_ACTIVE'),
      )
      // Refresh Sentinel status
      const st = await fetchSentinelStatus().catch(() => null)
      if (st) setSentinelStatus(st)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit response to Sentinel warning'
      setWarningError(msg)
    } finally {
      setWarningSubmitting(false)
    }
  }


  const handleStartSession = async () => {
    if (!currentUser) return
    const userId = currentUser.id
    try {
      const created = await createFocusSession({
        userId,
        name: selectedPomodoroPlan ?? `${selectedDuration}m Focus Session`,
        intention: sessionIntention.trim() || undefined,
        durationMinutes: selectedDuration,
      })
      const started = await startFocusSession(created.id, userId)
      setSessions((prev) => [started, ...prev.filter((s) => s.id !== started.id)])
      setSessionIntention('')
    } catch (e) {
      console.error(e)
    }
  }

  const handleEngageNextAction = async () => {
    if (!currentUser || !nextActionMission) return
    const userId = currentUser.id
    const mins = nextActionMission.estimatedMinutes || 25
    try {
      const created = await createFocusSession({
        userId,
        name: nextActionMission.title,
        intention: nextActionMission.title,
        durationMinutes: mins,
      })
      const started = await startFocusSession(created.id, userId)
      setSessions((prev) => [started, ...prev.filter((s) => s.id !== started.id)])
      setSelectedDuration(mins)
      setSessionIntention(nextActionMission.title)
    } catch (e) {
      console.error(e)
    }
  }
   
  const handleArmMissionAsSession = async (missionTitle: string, estimatedMinutes?: number) => {
    if (!currentUser) return
    if (sessions.some((session) => session.status === 'ACTIVE' || session.status === 'PAUSED')) {
      setActiveTab('Focus Engine')
      return
    }
    const userId = currentUser.id
    const mins = estimatedMinutes || 25
    try {
      const created = await createFocusSession({
        userId,
        name: missionTitle,
        intention: missionTitle,
        durationMinutes: mins,
      })
      const started = await startFocusSession(created.id, userId)
      setSessions((prev) => [started, ...prev.filter((s) => s.id !== started.id)])
      setSelectedDuration(mins)
      setSessionIntention(missionTitle)
      setActiveTab('Focus Engine')
    } catch (e) {
      console.error('Failed to arm focus sprint:', e)
    }
  }

  const handlePause = async (id: number) => {
    if (!currentUser) return
    const userId = currentUser.id
    try {
      const p = await pauseFocusSession(id, userId)
      setSessions((prev) => prev.map((s) => (s.id === id ? p : s)))
    } catch (e) {
      console.error(e)
    }
  }

  const handleResume = async (id: number) => {
    if (!currentUser) return
    const userId = currentUser.id
    try {
      const r = await resumeFocusSession(id, userId)
      setSessions((prev) => prev.map((s) => (s.id === id ? r : s)))
    } catch (e) {
      console.error(e)
    }
  }

  const handleCompleteSubmit = async (e: FormEvent, debriefWithAi: boolean = false) => {
    e.preventDefault()
    if (!currentUser || !completingSessionId) return
    const targetSessionId = completingSessionId
    const userId = currentUser.id
    try {
      const res = await completeFocusSession(
        targetSessionId,
        userId,
        {
          quality: completionQuality,
          accomplishment,
          reflectionNote: reflectionNotes,
        },
      )
      setSessions((prev) => prev.map((s) => (s.id === targetSessionId ? res : s)))
      setCompletingSessionId(null)
      setAccomplishment('')
      setReflectionNotes('')
      if (debriefWithAi) {
        setActiveTab('AI Assistant')
        handleAiSend(`Analyze session debrief for session #${targetSessionId}`, targetSessionId)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleRecoveryActionClick = (opt: RecoveryOption) => {
    if (opt.code === 'MICRO_SPRINT_15M') {
      const activeRunning = sessions.find((s) => s.status === 'ACTIVE')
      const sprintTitle = '15m Micro-Session: ' + (activeRunning?.name || 'Momentum Recovery')
      handleArmMissionAsSession(sprintTitle, 15)
      return
    }
    if (opt.code === 'NON_SCREEN_RECESS_10M') {
      setActiveTab('Focus Engine')
      handleAiSend('Starting 10-minute non-screen recovery recess. Give me a structured cooldown protocol.')
      return
    }
    if (opt.code === 'DECONSTRUCT_TASK') {
      handleAiSend('Deconstruct my current mission into atomic 15-minute milestones')
      return
    }
    if (opt.code === 'REST_AND_RECENTER') {
      handleAiSend('Guide me through a 5-minute somatic and breathwork recentering exercise')
      return
    }
    handleAiSend(opt.suggestedAction || opt.label)
  }

  const handleAiSend = async (messageText?: string, contextualSessionId?: number) => {
    const prompt = messageText || ''
    if (!prompt.trim()) return

    setChatMessages((prev) => [...prev, { role: 'user', text: prompt }])
    setAiLoading(true)

    try {
      const userId = currentUser?.id ?? getAuthenticatedUserId() ?? undefined
      const res = await sendAiChat(userId, prompt, undefined, undefined, contextualSessionId, conversationId || undefined)
      if (res.conversationId) {
        setConversationId(res.conversationId)
      }
      let missions: ProposedMission[] = []
      missions = mapStructuredCard(res.structuredCard, res.suggestionType)
      const suggestionId = res.structuredCard && typeof res.structuredCard === 'object' && 'suggestionId' in res.structuredCard
        ? (res.structuredCard as { suggestionId?: number }).suggestionId
        : undefined
      const debriefAnalysis: SessionDebriefAnalysis | null =
        res.suggestionType === 'DEBRIEF_ANALYSIS' && res.structuredCard
          ? (res.structuredCard as SessionDebriefAnalysis)
          : null
      const sessionRecovery: SessionRecovery | null =
        res.suggestionType === 'SESSION_RECOVERY' && res.structuredCard
          ? (res.structuredCard as SessionRecovery)
          : null
      const dailyPlan: DailyPlan | null =
        (res.suggestionType === 'PLANNER' || res.suggestionType === 'DAILY_PLAN') && res.structuredCard && 'planItems' in (res.structuredCard as object)
          ? (res.structuredCard as DailyPlan)
          : null

      setAiLoading(false)

      const fullReply = res.reply || ''

      // Progressive streaming simulation if reply is lengthy
      if (fullReply.length < 50) {
        setChatMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: fullReply,
            missions,
            tutorial: res.tutorial,
            bugReport: res.bugReport,
            suggestionType: res.suggestionType,
            suggestionId,
            debriefAnalysis,
            sessionRecovery,
            dailyPlan,
          },
        ])
      } else {
        // Create initial placeholder assistant bubble
        const assistantMessageId = crypto.randomUUID()
        setChatMessages((prev) => [
          ...prev,
          {
            id: assistantMessageId,
            role: 'assistant',
            text: '',
            missions: [],
            tutorial: null,
            bugReport: null,
            suggestionType: res.suggestionType,
            debriefAnalysis,
            sessionRecovery,
          },
        ])

        const tokens = fullReply.split(/(\s+)/)
        let tokenIdx = 0
        let currentText = ''

        await new Promise<void>((resolve) => {
          const streamInterval = setInterval(() => {
            if (tokenIdx < tokens.length) {
              const chunk = tokens.slice(tokenIdx, tokenIdx + 2).join('')
              tokenIdx += 2
              currentText += chunk

              setChatMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantMessageId
                    ? {
                    ...message,
                    text: currentText,
                  }
                    : message,
                ),
              )
            } else {
              clearInterval(streamInterval)
              // Finalize message with cards/attachments
              setChatMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantMessageId
                    ? {
                    ...message,
                    text: fullReply,
                    missions,
                    tutorial: res.tutorial,
                    bugReport: res.bugReport,
                    suggestionId,
                    debriefAnalysis,
                    sessionRecovery,
                    dailyPlan,
                  }
                    : message,
                ),
              )
              resolve()
            }
          }, 24)
        })
      }

      if (res.tutorial) {
        handleStartTutorial(0)
      }
    } catch (err: unknown) {
      console.error('EONPAI chat error:', err)
      setAiLoading(false)
      if (hasHttpStatus(err, 401)) {
        clearAuthSession()
        setCurrentUser(null)
        return
      }
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'I am here with you. Local AI is initializing, but our core execution engine is online. What would you like to focus on right now?',
          suggestionType: 'COACH',
        },
      ])
    }
  }

  const handleTriggerPresetAction = (promptText: string) => {
    setActiveTab('AI Assistant')
    handleAiSend(promptText)
  }

  const handleOpenBookingModal = (defaultDate?: string, presetDuration?: number, presetPlan?: string) => {
    setBookDate(defaultDate || selectedScheduleDate)
    setBookDuration(presetDuration || 25)
    setBookPlanName(presetPlan || 'Classic Pomodoro')
    setBookMissionId(null)
    setBookName('')
    setBookIntention('')
    setBookTime('09:00')
    setIsBookingSession(true)
  }

  const handleConfirmBookSession = async (e: FormEvent) => {
    e.preventDefault()
    if (!currentUser) return
    const userId = currentUser.id
    const mission = missions.find((m) => m.id === bookMissionId)
    const sessionTitle = bookName.trim() || mission?.title || `${bookDuration}m Focus Session`
    const intention = bookIntention.trim() || mission?.title || 'Execution block'

    let scheduledAt: string | undefined = undefined
    if (bookDate) {
      const timePart = bookTime ? (bookTime.length === 5 ? `${bookTime}:00` : bookTime) : '09:00:00'
      scheduledAt = new Date(`${bookDate}T${timePart}`).toISOString()
    }

    try {
      const created = await createFocusSession({
        userId,
        goalId: mission?.goalId,
        missionId: mission?.id,
        name: sessionTitle,
        intention,
        durationMinutes: bookDuration,
        scheduledAt,
      })
      setSessions((prev) => [created, ...prev])
      setIsBookingSession(false)
      loadData()
    } catch (err) {
      console.error('Failed to book session:', err)
      setToastAlerts((prev) => [
        ...prev,
        {
          id: 'toast-err-' + Date.now(),
          title: 'Schedule Failed',
          description: 'Could not schedule focus session. Check server logs.',
          type: 'focus',
          timestamp: new Date().toISOString(),
        },
      ])
    }
  }

  const handleStartFromSchedule = async (sessionId: number) => {
    if (!currentUser) return
    const userId = currentUser.id
    try {
      const started = await startFocusSession(sessionId, userId)
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? started : s)))
      setActiveTab('Focus Engine')
    } catch (err) {
      console.error('Failed to start session from schedule:', err)
    }
  }

  const handleCancelSession = async (sessionId: number) => {
    if (!currentUser) return
    const userId = currentUser.id
    try {
      const cancelled = await cancelFocusSession(sessionId, userId)
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? cancelled : s)))
      loadData()
    } catch (err) {
      console.error('Failed to cancel session:', err)
    }
  }

  const handleCancelFromSchedule = handleCancelSession

  if (!currentUser) {
    return (
      <div className={`auth-fullscreen-container ${isDarkMode ? 'theme-dark' : 'theme-light'}`}>
        <div className="auth-card">
          <div className="auth-brand-row">
            <ShinpoLogo size={36} variant="full" />
            <div className="auth-system-badge">
              <span>SYSTEM: ARISE • KERNEL ACCESS</span>
            </div>
          </div>

          <div className="auth-nav-tabs">
            <button
              type="button"
              className={`auth-tab-btn ${authMode === 'LOGIN' ? 'active' : ''}`}
              onClick={() => {
                setAuthMode('LOGIN')
                setAuthError(null)
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-tab-btn ${authMode === 'REGISTER' ? 'active' : ''}`}
              onClick={() => {
                setAuthMode('REGISTER')
                setAuthError(null)
              }}
            >
              Create Account
            </button>
          </div>

          <form className="auth-form" onSubmit={handleAuthSubmit}>
            {authError && <div className="auth-error-banner">{authError}</div>}

            <div className="auth-field-group">
              <label className="auth-label">
                {authMode === 'LOGIN' ? 'Username or Email' : 'Username'}
              </label>
              <input
                className="auth-input"
                type="text"
                placeholder={authMode === 'LOGIN' ? 'eonx / user@shinpo.local' : 'e.g. Alex'}
                value={authIdentifier}
                onChange={(e) => setAuthIdentifier(e.target.value)}
                required
                autoFocus
              />
            </div>

            {authMode === 'REGISTER' && (
              <div className="auth-field-group">
                <label className="auth-label">Email Address</label>
                <input
                  className="auth-input"
                  type="email"
                  placeholder="alex@shinpo.local"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="auth-field-group">
              <label className="auth-label">Password</label>
              <input
                className="auth-input"
                type="password"
                placeholder="••••••••••••"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="auth-submit-btn" disabled={authLoading}>
              {authLoading ? 'Verifying credentials...' : authMode === 'LOGIN' ? 'Sign In' : 'Create Account'}
            </button>

            {authMode === 'LOGIN' && (
              <button
                type="button"
                className="auth-quick-fill-btn"
                onClick={handleQuickDemoFill}
              >
                Quick Fill (EONX / Dev Seed)
              </button>
            )}
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className={`app-shell ${isDarkMode ? '' : 'theme-light'}`}>


      {/* Collapsible Sidebar */}
      <Sidebar
        sidebarExpanded={sidebarExpanded}
        onToggleExpanded={handleToggleSidebar}
        activeTab={activeTab as AppView}
        onSelectTab={handleSelectTab}
        scheduledCount={scheduledCount}
        shinpoMessage={shinpoMessage}
        onRefreshShinpoMessage={handleRefreshShinpoMessage}
        pendingWarning={pendingWarning}
        activeGraceWarning={activeGraceWarning}
        activeSession={activeSession}
        graceSecondsLeft={graceSecondsLeft}
      />

      {/* Main Content Area */}
      <main className={`app-main ${sidebarExpanded ? 'sidebar-expanded' : ''}`}>
        {/* Top Bar */}
        <TopBar
          activeTab={activeTab as AppView}
          topSearchQuery={topSearchQuery}
          onSearchChange={setTopSearchQuery}
          unreadAlertCount={unreadAlertCount}
          isAlertsDrawerOpen={isAlertsDrawerOpen}
          onToggleAlertsDrawer={handleToggleAlertsDrawer}
          isDarkMode={isDarkMode}
          onToggleTheme={handleToggleTheme}
          onRefreshData={loadData}
          currentUser={currentUser}
          onLogout={handleLogout}
        />

        {/* Dynamic Tab Render */}
        {/* Dynamic Tab Render: Task Master 2x2 Bento Quadrant Dashboard */}
        {/* Dynamic Tab Render: SHINPO Flight Deck Dashboard */}
        {activeTab === 'Dashboard' && (
          <OverviewView
            missions={missions}
            goals={goals}
            sessions={sessions}
            activeSession={activeSession}
            sentinelStatus={sentinelStatus}
            executiveBriefing={executiveBriefing}
            isBriefingExpanded={isBriefingExpanded}
            setIsBriefingExpanded={setIsBriefingExpanded}
            briefingLoading={briefingLoading}
            analyticsData={analyticsData}
            topSearchQuery={topSearchQuery}
            setTopSearchQuery={setTopSearchQuery}
            setActiveTab={setActiveTab}
            handleArmMissionAsSession={handleArmMissionAsSession}
            handleToggleMissionComplete={handleToggleMissionComplete}
            handleDeleteMission={handleDeleteMission}
            deletingMissionId={deletingMissionId}
            handleStartFromSchedule={handleStartFromSchedule}
            isCreatingQuickMission={isCreatingQuickMission}
            setIsCreatingQuickMission={setIsCreatingQuickMission}
            quickMissionTitle={quickMissionTitle}
            setQuickMissionTitle={setQuickMissionTitle}
            quickMissionGoalId={quickMissionGoalId}
            setQuickMissionGoalId={setQuickMissionGoalId}
            quickMissionDuration={quickMissionDuration}
            setQuickMissionDuration={setQuickMissionDuration}
            isSubmittingQuickMission={isSubmittingQuickMission}
            quickMissionError={quickMissionError}
            setQuickMissionError={setQuickMissionError}
            handleQuickCreateMission={handleQuickCreateMission}
            inspectingMission={inspectingMission}
            setInspectingMission={setInspectingMission}
            activeTaskMenu={activeTaskMenu}
            setActiveTaskMenu={setActiveTaskMenu}
            handleAiSend={handleAiSend}
            refreshBriefing={refreshBriefing}
            handleEngageNextAction={handleEngageNextAction}
            pendingWarning={pendingWarning}
            activeGraceWarning={activeGraceWarning}
            graceSecondsLeft={graceSecondsLeft}
            timerSeconds={timerSeconds}
            handlePause={handlePause}
            handleResume={handleResume}
            setCompletingSessionId={setCompletingSessionId}
            nextActionMission={nextActionMission}
          />
        )}


        {/* Tab 2: Focus Engine */}
        {activeTab === 'Focus Engine' && (
          <FocusView
            activeSession={activeSession}
            timerSeconds={timerSeconds}
            sessions={sessions}
            pendingWarning={pendingWarning}
            activeGraceWarning={activeGraceWarning}
            graceSecondsLeft={graceSecondsLeft}
            sessionIntention={sessionIntention}
            setSessionIntention={setSessionIntention}
            selectedDuration={selectedDuration}
            setSelectedDuration={setSelectedDuration}
            isCustomDuration={isCustomDuration}
            setIsCustomDuration={setIsCustomDuration}
            selectedPomodoroPlan={selectedPomodoroPlan}
            setSelectedPomodoroPlan={setSelectedPomodoroPlan}
            handleStartSession={handleStartSession}
            handlePause={handlePause}
            handleResume={handleResume}
            setCompletingSessionId={setCompletingSessionId}
            handleDeleteSession={handleDeleteSession}
            handleCancelSession={handleCancelSession}
          />
        )}
        {/* Tab 3: AI Assistant / EONPAI */}
        {activeTab === 'AI Assistant' && (
          <EonpaiView
            chatMessages={chatMessages}
            aiLoading={aiLoading}
            handleTriggerPresetAction={handleTriggerPresetAction}
            handleClearChat={handleClearChat}
            handleStartTutorial={handleStartTutorial}
            handleArmMissionAsSession={handleArmMissionAsSession}
            handleCommitDailyPlan={handleCommitDailyPlan}
            handleCommitChatSuggestion={handleCommitChatSuggestion}
            handleRecoveryActionClick={handleRecoveryActionClick}
            handleAiSend={handleAiSend}
            onActionExecuted={loadData}
          />
        )}

        {/* Tab 3: Goals & Tasks */}
        {activeTab === 'Goals & Missions' && (
          <GoalsView
            goals={goals}
            missions={missions}
            aiDecompResult={aiDecompResult}
            setAiDecompResult={setAiDecompResult}
            decomposingGoalId={decomposingGoalId}
            handleDeconstructGoal={handleDeconstructGoal}
            handleCommitAiMissions={handleCommitAiMissions}
            handleDeleteGoal={handleDeleteGoal}
            handleDeleteAllGoals={handleDeleteAllGoals}
            handleDeleteMission={handleDeleteMission}
            handleDeleteMissionBulk={handleDeleteMissionBulk}
            handleToggleMissionComplete={handleToggleMissionComplete}
            handleArmMissionAsSession={handleArmMissionAsSession}
            setIsCreatingGoal={setIsCreatingGoal}
            setIsCreatingQuickMission={setIsCreatingQuickMission}
            quickMissionGoalId={quickMissionGoalId}
            setQuickMissionGoalId={setQuickMissionGoalId}
            onGoalRequired={() => {
              setToastAlerts((prev) => [
                ...prev,
                {
                  id: 'toast-info-' + Date.now(),
                  title: 'Goal Required',
                  description: 'Please create a goal first before adding a task.',
                  type: 'focus',
                  timestamp: new Date().toISOString(),
                },
              ])
              setIsCreatingGoal(true)
            }}
            openEditGoalModal={openEditGoalModal}
            openEditMissionModal={openEditMissionModal}
          />
        )}

        {/* Tab 5: Schedule View (C-002) */}
        {activeTab === 'Schedule' && (
          <ScheduleView
            sessions={sessions}
            selectedScheduleDate={selectedScheduleDate}
            setSelectedScheduleDate={setSelectedScheduleDate}
            setActiveTab={setActiveTab}
            handleOpenBookingModal={handleOpenBookingModal}
            handleStartFromSchedule={handleStartFromSchedule}
            handleCancelFromSchedule={handleCancelFromSchedule}
            handleDeleteSession={handleDeleteSession}
          />
        )}

        {/* ==========================================================================
            C-027 DEVICE TASK MANAGER VIEW
            ========================================================================== */}
        {activeTab === 'Task Manager' && (
          <TaskManagerView
            deviceSnapshot={deviceSnapshot}
            tmLoading={tmLoading}
            tmSearch={tmSearch}
            setTmSearch={setTmSearch}
            tmPolicy={tmPolicy}
            setTmPolicy={setTmPolicy}
            setTmRefreshKey={setTmRefreshKey}
            sentinelStatus={sentinelStatus}
            setSentinelStatus={setSentinelStatus}
            sentinelRules={sentinelRules}
            setSentinelRules={setSentinelRules}
            handleTerminateProcess={handleTerminateProcess}
            tamperEvents={tamperEvents}
            setTamperEvents={setTamperEvents}
            tamperEventsExpanded={tamperEventsExpanded}
            setTamperEventsExpanded={setTamperEventsExpanded}
            tamperEventsLoading={tamperEventsLoading}
            loadDeviceProcesses={loadDeviceProcesses}
            loadSentinelTamperEvents={loadSentinelTamperEvents}
            tmToast={tmToast}
            setTmToast={setTmToast}
          />
        )}

        {/* ==========================================================================
            C-003 ANALYTICS TAB VIEW
            ========================================================================== */}
        {activeTab === 'Analytics' && (
          <AnalyticsView
            analyticsData={analyticsData}
            analyticsLoading={analyticsLoading}
            loadAnalytics={loadAnalytics}
          />
        )}

        {/* Tab 4: Other Views Fallback */}
        {activeTab !== 'Dashboard' &&
          activeTab !== 'Focus Engine' &&
          activeTab !== 'Goals & Missions' &&
          activeTab !== 'AI Assistant' &&
          activeTab !== 'Schedule' &&
          activeTab !== 'Task Manager' &&
          activeTab !== 'Analytics' && (
            <div className="bento-card" style={{ padding: 48, textAlign: 'center' }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>{activeTab} Module</h2>
              <p style={{ color: 'var(--text-3)', fontSize: 14 }}>
                Switch to Overview, Goals, or Focus for available actions.
              </p>
            </div>
          )}
      </main>

      {/* Focus Protection Warning & Grace Period Modal */}
      <DistractionWarningModal
        pendingWarning={pendingWarning}
        warningSecondsLeft={warningSecondsLeft}
        selectedGraceMinutes={selectedGraceMinutes}
        setSelectedGraceMinutes={setSelectedGraceMinutes}
        warningSubmitting={warningSubmitting}
        warningError={warningError}
        onRespond={handleRespondToWarning}
      />

      {/* Post-Session Reflection Modal */}
      <SessionSummaryModal
        completingSessionId={completingSessionId}
        completionQuality={completionQuality}
        setCompletionQuality={setCompletionQuality}
        accomplishment={accomplishment}
        setAccomplishment={setAccomplishment}
        reflectionNotes={reflectionNotes}
        setReflectionNotes={setReflectionNotes}
        onCancel={() => setCompletingSessionId(null)}
        onSubmit={handleCompleteSubmit}
      />

      {/* Create Goal Modal */}
      <CreateGoalModal
        isOpen={isCreatingGoal}
        onClose={() => setIsCreatingGoal(false)}
        title={newGoalTitle}
        setTitle={setNewGoalTitle}
        description={newGoalDesc}
        setDescription={setNewGoalDesc}
        targetDate={newGoalDate}
        setTargetDate={setNewGoalDate}
        onSubmit={handleCreateGoal}
      />

      {/* Edit Goal Modal */}
      <EditGoalModal
        editingGoal={editingGoal}
        onClose={() => setEditingGoal(null)}
        title={editGoalTitle}
        setTitle={setEditGoalTitle}
        description={editGoalDesc}
        setDescription={setEditGoalDesc}
        targetDate={editGoalTargetDate}
        setTargetDate={setEditGoalTargetDate}
        status={editGoalStatus}
        setStatus={setEditGoalStatus}
        onSubmit={handleUpdateGoalSubmit}
      />

      {/* Edit Task Modal */}
      <EditTaskModal
        editingMission={editingMission}
        onClose={() => setEditingMission(null)}
        goals={goals}
        goalId={editMissionGoalId}
        setGoalId={setEditMissionGoalId}
        title={editMissionTitle}
        setTitle={setEditMissionTitle}
        description={editMissionDesc}
        setDescription={setEditMissionDesc}
        scheduledDate={editMissionDate}
        setScheduledDate={setEditMissionDate}
        estimatedMinutes={editMissionMinutes}
        setEstimatedMinutes={setEditMissionMinutes}
        status={editMissionStatus}
        setStatus={setEditMissionStatus}
        onSubmit={handleUpdateMissionSubmit}
      />

      {/* Schedule Focus Session Modal (C-002) */}
      <ScheduleSessionModal
        isOpen={isBookingSession}
        onClose={() => setIsBookingSession(false)}
        missions={missions}
        goals={goals}
        missionId={bookMissionId}
        setMissionId={setBookMissionId}
        name={bookName}
        setName={setBookName}
        intention={bookIntention}
        setIntention={setBookIntention}
        date={bookDate}
        setDate={setBookDate}
        time={bookTime}
        setTime={setBookTime}
        pomodoroPlans={pomodoroPlans}
        planName={bookPlanName}
        setPlanName={setBookPlanName}
        duration={bookDuration}
        setDuration={setBookDuration}
        onSubmit={handleConfirmBookSession}
      />

      {/* Interactive Guided Tour Spotlight Overlay */}
      {isTutorialActive && SHINPO_ONBOARDING_STEPS[tutorialStepIndex] && (
        <TutorialOverlay
          step={SHINPO_ONBOARDING_STEPS[tutorialStepIndex]}
          stepIndex={tutorialStepIndex}
          totalSteps={SHINPO_ONBOARDING_STEPS.length}
          onNext={handleNextTutorialStep}
          onPrev={handlePrevTutorialStep}
          onExit={handleExitTutorial}
          onTargetInteract={() => {
            const stepId = SHINPO_ONBOARDING_STEPS[tutorialStepIndex]?.id
            if (stepId === 'CREATE_GOAL') {
              setIsCreatingGoal(true)
            } else if (stepId === 'OPEN_SCHEDULE') {
              setActiveTab('Schedule')
              handleNextTutorialStep()
            } else if (stepId === 'FOCUS_CONTROLS') {
              setActiveTab('Focus Engine')
            } else if (stepId === 'VIEW_ANALYTICS') {
              setActiveTab('Analytics')
              handleNextTutorialStep()
            } else if (stepId === 'CHECK_PROGRESS') {
              setActiveTab('Dashboard')
              handleCompleteTutorial()
            }
          }}
        />
      )}

      {/* Real-Time Telemetry & Notifications Flyout */}
      <TelemetryDrawer
        isOpen={isAlertsDrawerOpen}
        onClose={() => setIsAlertsDrawerOpen(false)}
        isWsConnected={isWsConnected}
        liveAlerts={liveAlerts}
        onRequestClearHistory={() => {
          if (liveAlerts.length === 0) return
          requestConfirmation({
            title: 'Clear Activity History',
            message: (
              <div>
                <p style={{ margin: '0 0 8px 0' }}>
                  Clear <strong>{liveAlerts.length} notification event(s)</strong>?
                </p>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)' }}>
                  This removes your local notification history from this panel.
                </p>
              </div>
            ),
            confirmLabel: 'Clear History',
            cancelLabel: 'Cancel',
            isDestructive: true,
            onConfirm: () => {
              setLiveAlerts([])
            },
          })
        }}
      />

      {/* Real-Time Floating Toasts */}
      <FloatingToasts
        toastAlerts={toastAlerts}
        onDismiss={(id) => setToastAlerts((prev) => prev.filter((item) => item.id !== id))}
      />

      {/* In-App Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        cancelLabel={confirmDialog.cancelLabel}
        isDestructive={confirmDialog.isDestructive}
        isLoading={confirmDialog.isLoading}
        errorMessage={confirmDialog.errorMessage}
        onConfirm={confirmDialog.onConfirm}
        onCancel={closeConfirmation}
      />

    </div>
  )
}

export default App