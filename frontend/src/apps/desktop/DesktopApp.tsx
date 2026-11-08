import { lazy, Suspense, useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ErrorBoundary } from '../../components/common/ErrorBoundary'
import { DesktopLoginView } from './components'
import { ShinpoParticles } from '../../components/background/ShinpoParticles'


import {
  cancelFocusSession,
  completeFocusSession,
  createFocusSession,
  deleteFocusSession,
  getGuardianPreferences,
  getFocusSession,
  getFocusSessions,
  pauseFocusSession,
  returnToFocus,
  resumeFocusSession,
  startFocusSession,
  updateFocusSession,
} from '../../api/focusSessions'

import type { FocusSession, GuardianMode, GuardianPreferences } from '../../api/focusSessions'
import {
  clearActiveConversation,
  commitDailyPlan,
  commitSuggestion,
  decomposeGoal,
  getActiveConversation,
  getExecutiveBriefing,
  sendAiChat,
} from '../../api/ai'
import type {
  BugReportDraft,
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
} from '../../api/ai'
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
} from '../../api/goalsAndMissions'
import type { Goal, Mission } from '../../api/goalsAndMissions'
import {
  clearAuthSession,
  fetchCurrentUser,
  getAuthenticatedUserId,
  isLocalVaultSession,
  login,
  logout,
  register,
  recoverLocalAccount,
  setCustomServerUrl,
  touchLocalVaultActivity,
} from '../../api/auth'
import type { AuthUser } from '../../api/auth'
import { getCurrentUserProgress, claimOnboardingReward } from '../../api/progress'
import type { ProgressResponse } from '../../api/progress'
import {
  getOnboardingState,
  startOnboarding,
  finishOnboarding,
  pauseOnboarding,
  skipOnboarding,
} from '../../api/onboarding'
import {
  fetchDeviceSnapshot,
  fetchSentinelStatus,
  fetchSentinelRules,
  fetchSentinelTamperEvents,
  fetchActiveWarnings,
  respondToWarning,
} from '../../api/device'
import type {
  ProcessSnapshot,
  SentinelStatus,
  PolicyRule,
  SentinelTamperEventItem,
  SentinelQuarantineItem,
  SentinelWarningItem,
} from '../../api/device'
import { fetchAnalyticsDashboard } from '../../api/analytics'
import type { AnalyticsDashboardResponse } from '../../api/analytics'
import { takeRecentGuardianObservation } from '../../utils/guardianAlerts'
import { getBackendBaseUrl, getCustomServerUrl, isValidServerUrl } from '../../api/config'
import { CinematicStartup } from '../../components/startup/CinematicStartup'
import { OnboardingWelcome, TutorialOverlay } from '../../components/TutorialOverlay'
import { InteractiveTutorialModal } from '../../components/tutorial/InteractiveTutorialModal'
import { isInteractiveTutorialEnabled } from '../../components/tutorial/interactiveTutorialTypes'
import { ConfirmationDialog } from '../../components/ConfirmationDialog'
import { DistractionWarningModal } from '../../components/dialogs/DistractionWarningModal'
import { SessionSummaryModal } from '../../components/dialogs/SessionSummaryModal'
import { CreateGoalModal } from '../../components/dialogs/CreateGoalModal'
import { EditGoalModal } from '../../components/dialogs/EditGoalModal'
import { CreateTaskModal } from '../../components/dialogs/CreateTaskModal'
import { EditTaskModal } from '../../components/dialogs/EditTaskModal'
import { ScheduleSessionModal } from '../../components/dialogs/ScheduleSessionModal'
import { TelemetryDrawer } from '../../components/dialogs/TelemetryDrawer'
import { FloatingToasts } from '../../components/dialogs/FloatingToasts'
import { SettingsModal } from '../../components/dialogs/SettingsModal'
import type { SettingsSection } from '../../components/dialogs/SettingsModal'
import { CelebrationModal } from '../../components/dialogs/CelebrationModal'
import {
  type CelebrationPayload,
} from '../../utils/progressionEngine'
import type { LiveAlertItem } from '../../types/telemetry'
import { Sidebar } from '../../components/layout/Sidebar'
import { TopBar } from '../../components/layout/TopBar'
import { SHINPO_ONBOARDING_STEPS } from '../../tutorial/tutorialSteps'
import { wsClient } from '../../api/websocket'
import { isTauriEnvironment } from '../../api/tauri'
import type {
  SentinelQuarantineEvent,
  SentinelStatusEvent,
  FocusSessionEvent,
} from '../../api/websocket'
import { toSafeIsoString } from '../../api/eventNormalizer'

import { getInitialShinpoMessage, getNextShinpoMessage } from '../../utils/shinpoMessages'
import type { ShinpoMessage } from '../../utils/shinpoMessages'
import {
  calculateRemainingSeconds,
  pomodoroPlans,
} from '../../utils/focusTimer'
import { NAVIGATION_ITEMS } from '../../types/navigation'
import type { AppView } from '../../types/navigation'
import { trackRender } from '../../utils/renderTracker'
import { toLocalScheduleIso } from '../../utils/localScheduleTime'
import { isLocalVaultIdleLockDue } from '../../utils/idleLock'

const isAppView = (value: string): value is AppView =>
  NAVIGATION_ITEMS.some((item) => item.id === value)

const TaskManagerView = lazy(() => import('../../views/TaskManagerView').then(({ TaskManagerView }) => ({ default: TaskManagerView })))
const AnalyticsView = lazy(() => import('../../views/AnalyticsView').then(({ AnalyticsView }) => ({ default: AnalyticsView })))
const ScheduleView = lazy(() => import('../../views/ScheduleView').then(({ ScheduleView }) => ({ default: ScheduleView })))
const GoalsView = lazy(() => import('../../views/GoalsView').then(({ GoalsView }) => ({ default: GoalsView })))
const OverviewView = lazy(() => import('../../views/OverviewView').then(({ OverviewView }) => ({ default: OverviewView })))
const EonpaiView = lazy(() => import('../../views/EonpaiView').then(({ EonpaiView }) => ({ default: EonpaiView })))
const FocusView = lazy(() => import('../../views/FocusView').then(({ FocusView }) => ({ default: FocusView })))
const RewardsView = lazy(() => import('../../views/RewardsView').then(({ RewardsView }) => ({ default: RewardsView })))
const AuroraDashboardView = lazy(() => import('../../v2/dashboard/ThemedAuroraDashboardView')
  .then(({ ThemedAuroraDashboardView }) => ({ default: ThemedAuroraDashboardView })))

import './styles/desktop.css'

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

import { UiComponentGallery } from '../../dev/UiComponentGallery'

export function DesktopApp() {
  const isDevGallery =
    Boolean(import.meta.env.DEV) &&
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).get('dev') === 'gallery' || window.location.pathname === '/gallery')

  trackRender('App')
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [authRestored, setAuthRestored] = useState(false)
  const [isStartupFinished, setIsStartupFinished] = useState(() => {
    try {
      return typeof window !== 'undefined' && sessionStorage.getItem('shinpo_splash_shown') === 'true'
    } catch {
      return false
    }
  })
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER' | 'RECOVER'>(() =>
    isTauriEnvironment() && !isLocalVaultSession() ? 'REGISTER' : 'LOGIN',
  )
  const [authIdentifier, setAuthIdentifier] = useState(() => {
    try {
      return localStorage.getItem('shinpo_remembered_username') || ''
    } catch {
      return ''
    }
  })
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authRecoveryKey, setAuthRecoveryKey] = useState('')
  const [showAuthPassword, setShowAuthPassword] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [pendingRecovery, setPendingRecovery] = useState<{ user: AuthUser; recoveryKey: string } | null>(null)
  const [recoveryKeyCopied, setRecoveryKeyCopied] = useState(false)
  const [recoveryConfirmed, setRecoveryConfirmed] = useState(false)
  const [showServerConfig, setShowServerConfig] = useState(false)
  const [customServerUrlInput, setCustomServerUrlInput] = useState(() => getCustomServerUrl() || getBackendBaseUrl())
  const [serverConfigSaved, setServerConfigSaved] = useState(false)
  const [serverConfigError, setServerConfigError] = useState('')

  const [sessions, setSessions] = useState<FocusSession[]>([])
  const celebrationSequence = useRef(0)
  const scheduledCount = sessions.filter((s) => s.status === 'SCHEDULED' || Boolean(s.scheduledAt && s.status !== 'COMPLETED')).length
  const [selectedDuration, setSelectedDuration] = useState(30)
  const [pomodoroEnabled, setPomodoroEnabled] = useState(false)
  const pomodoroFocusCycles = 2
  const pomodoroShortBreakMinutes = 5
  const [pomodoroLongBreakMinutes, setPomodoroLongBreakMinutes] = useState(15)
  const [pomodoroGraceMinutes, setPomodoroGraceMinutes] = useState(10)
  const [guardianMode, setGuardianMode] = useState<GuardianMode>('PROTECTED')
  const [guardianAppMonitoring, setGuardianAppMonitoring] = useState(false)
  const [savedGuardianPreferences, setSavedGuardianPreferences] = useState<GuardianPreferences>({
    preferredMode: 'PROTECTED', appMonitoringConsent: false, applyToNewSessions: false,
    closureConsent: false, backgroundRuntimeConsent: false,
  })
  const [guardianBackgroundRuntimeConsent, setGuardianBackgroundRuntimeConsent] = useState(false)
  const [latePenaltyEnabled, setLatePenaltyEnabled] = useState(false)
  const [latePenaltyXp, setLatePenaltyXp] = useState(5)
  const [latePenaltyDailyCapXp, setLatePenaltyDailyCapXp] = useState(20)
  const [isCustomDuration, setIsCustomDuration] = useState(false)
  const [sessionIntention, setSessionIntention] = useState('')
  const [activeTab, setActiveTab] = useState<AppView>(() => {
    const tab = new URLSearchParams(window.location.search).get('tab')
    return tab && isAppView(tab) ? tab : 'Dashboard'
  })

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const urlTheme = new URLSearchParams(window.location.search).get('theme')
      if (urlTheme === 'light') return false
      if (urlTheme === 'dark') return true
      try {
        const stored = localStorage.getItem('shinpo_theme')
        if (stored === 'light') return false
        if (stored === 'dark') return true
      } catch {
        // ignore localStorage errors
      }
    }
    return true
  })
  const [isV2Preview, setIsV2Preview] = useState(() => {
    if (typeof window !== 'undefined') {
      const urlV2 = new URLSearchParams(window.location.search).get('v2')
      if (urlV2 === 'true') return true
      if (urlV2 === 'false') return false
      try {
        const stored = localStorage.getItem('shinpo_v2_preview')
        if (stored !== null) return stored === 'true'
      } catch {
        // ignore localStorage errors
      }
    }
    return true
  })
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('shinpo_sidebar_pinned')
        if (stored !== null) return stored === 'true'
      } catch {
        // ignore localStorage access errors
      }
      return window.innerWidth > 1000
    }
    return true
  })
  const [selectedPomodoroPlan, setSelectedPomodoroPlan] = useState<string | null>(null)
  const [liveAlerts, setLiveAlerts] = useState<LiveAlertItem[]>([])
  const [toastAlerts, setToastAlerts] = useState<LiveAlertItem[]>([])
  const [isAlertsDrawerOpen, setIsAlertsDrawerOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('appearance')
  const [isDataRefreshing, setIsDataRefreshing] = useState(false)
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
    onConfirm: () => { },
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
  const [isCompletingSession, setIsCompletingSession] = useState(false)
  const [completeSessionError, setCompleteSessionError] = useState<string | null>(null)

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
      text: 'EONPAI is SHINPO’s execution assistant. It can organize goals and tasks, help plan Focus sessions, and summarize saved work. Provider availability and offline capabilities are shown above the conversation.',
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


  // Rewards & Progression State
  const [userProgress, setUserProgress] = useState<ProgressResponse | null>(null)
  const [celebrationPayload, setCelebrationPayload] = useState<CelebrationPayload | null>(null)

  // Interactive Guided Tour State & Scoped Storage Helpers
  const [isTutorialActive, setIsTutorialActive] = useState(false)
  const [isOnboardingWelcomeOpen, setIsOnboardingWelcomeOpen] = useState(false)
  const [isInteractiveTutorialOpen, setIsInteractiveTutorialOpen] = useState(false)
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0)

  const handleStartInteractiveTutorial = useCallback(() => {
    setIsOnboardingWelcomeOpen(false)
    setIsTutorialActive(false)
    setIsInteractiveTutorialOpen(true)
  }, [])

  const getTutorialStorageItem = (prefix: string, userOrId?: AuthUser | number | null): string | null => {
    try {
      if (userOrId) {
        if (typeof userOrId === 'object' && userOrId !== null && 'username' in userOrId && userOrId.username) {
          const userKey = `${prefix}_user_${encodeURIComponent(userOrId.username.trim().toLowerCase())}`
          const val = localStorage.getItem(userKey)
          if (val !== null) return val
          const idKey = `${prefix}_${userOrId.id}`
          const idVal = localStorage.getItem(idKey)
          if (idVal !== null) return idVal
        } else if (typeof userOrId === 'number') {
          const scopedVal = localStorage.getItem(`${prefix}_${userOrId}`)
          if (scopedVal !== null) return scopedVal
        }
      }
      return null
    } catch {
      return null
    }
  }

  const setTutorialStorageItem = (prefix: string, value: string, userOrId?: AuthUser | number | null) => {
    try {
      if (userOrId) {
        if (typeof userOrId === 'object' && userOrId !== null && 'username' in userOrId && userOrId.username) {
          localStorage.setItem(`${prefix}_user_${encodeURIComponent(userOrId.username.trim().toLowerCase())}`, value)
          localStorage.setItem(`${prefix}_${userOrId.id}`, value)
        } else if (typeof userOrId === 'number') {
          localStorage.setItem(`${prefix}_${userOrId}`, value)
        }
      }
      localStorage.setItem(prefix, value)
    } catch {
      // localStorage may be unavailable in restricted browser contexts.
    }
  }

  const removeTutorialStorageItem = (prefix: string, userOrId?: AuthUser | number | null) => {
    try {
      if (userOrId) {
        if (typeof userOrId === 'object' && userOrId !== null && 'username' in userOrId && userOrId.username) {
          localStorage.removeItem(`${prefix}_user_${encodeURIComponent(userOrId.username.trim().toLowerCase())}`)
          localStorage.removeItem(`${prefix}_${userOrId.id}`)
        } else if (typeof userOrId === 'number') {
          localStorage.removeItem(`${prefix}_${userOrId}`)
        }
      }
      localStorage.removeItem(prefix)
    } catch {
      // localStorage may be unavailable in restricted browser contexts.
    }
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
  const [isBookingSaving, setIsBookingSaving] = useState(false)
  const bookingSaveInProgressRef = useRef(false)
  const [bookMissionId, setBookMissionId] = useState<number | null>(null)
  const [bookName, setBookName] = useState('')
  const [bookIntention, setBookIntention] = useState('')
  const [bookDate, setBookDate] = useState(() => localCalendarDate())
  const [bookTime, setBookTime] = useState('09:00')
  const [bookDuration, setBookDuration] = useState(25)
  const [bookPlanName, setBookPlanName] = useState<string | null>(null)
  const [editingScheduleSession, setEditingScheduleSession] = useState<FocusSession | null>(null)
  const [markTaskCompleted, setMarkTaskCompleted] = useState<boolean>(true)

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
  const seenGuardianObservationIds = useRef(new Set<number>())
  const [sentinelRules, setSentinelRules] = useState<PolicyRule[]>([])
  const [tamperEvents, setTamperEvents] = useState<SentinelTamperEventItem[]>([])
  const [tamperEventsExpanded, setTamperEventsExpanded] = useState(false)
  const [tamperEventsLoading, setTamperEventsLoading] = useState(false)

  // Sentinel Discipline Warning & Grace Period State (Item 3 & 4)
  const [activeWarnings, setActiveWarnings] = useState<SentinelWarningItem[]>([])
  const pendingWarning = Array.isArray(activeWarnings) ? activeWarnings.find((w) => w.status === 'ISSUED') ?? null : null
  const [selectedGraceMinutes, setSelectedGraceMinutes] = useState(5)
  const [warningSubmitting, setWarningSubmitting] = useState(false)
  const [warningError, setWarningError] = useState<string | null>(null)

  // Operational Velocity & Telemetry State (C-003)
  const [analyticsData, setAnalyticsData] = useState<AnalyticsDashboardResponse | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState(false)

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

  // Comprehensive active modal / drawer detection for tutorial coordination
  const hasActiveModal = Boolean(
    isCreatingQuickMission ||
    isCreatingGoal ||
    Boolean(editingGoal) ||
    Boolean(editingMission) ||
    isBookingSession ||
    isSettingsOpen ||
    isInteractiveTutorialOpen ||
    isAlertsDrawerOpen ||
    Boolean(pendingWarning) ||
    Boolean(completingSessionId) ||
    confirmDialog.isOpen
  )

  const isTutorialPendingLaunch = useRef<number | null>(null)
  const isWelcomePendingLaunch = useRef(false)
  const hasActiveModalRef = useRef(hasActiveModal)
  useEffect(() => {
    hasActiveModalRef.current = hasActiveModal
  }, [hasActiveModal])
  const handleStartTutorialRef = useRef<(initialStepIndex?: number) => void>(() => { })

  const handleQuickCreateMission = async (e: FormEvent) => {
    e.preventDefault()
    const effectiveGoalId = quickMissionGoalId ?? (goals.length > 0 ? goals[0].id : null)
    if (!quickMissionTitle.trim()) {
      setQuickMissionError('Task title is required.')
      return
    }
    if (!effectiveGoalId) {
      setQuickMissionError('A goal is required to create a task. Please create a goal first.')
      return
    }
    setQuickMissionError(null)
    setIsSubmittingQuickMission(true)
    try {
      const today = localCalendarDate()
      const created = await createMission({
        goalId: effectiveGoalId,
        title: quickMissionTitle.trim(),
        description: 'Focus session execution',
        scheduledDate: today,
        estimatedMinutes: quickMissionDuration,
      })
      setMissions((prev) => [created, ...prev])
      setQuickMissionTitle('')
      setIsCreatingQuickMission(false)
      pushToast({
        title: 'Task Created',
        description: `Created "${created.title}"`,
        type: 'focus',
        timestamp: new Date().toISOString(),
      })
      await loadData()
      advanceTutorialAfterAction('CREATE_TASK')
    } catch (err) {
      console.error('Failed to create quick task', err)
      setQuickMissionError('Could not create task. Please try again.')
      if (hasHttpStatus(err, 401)) {
        await clearAuthSession()
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
    const completedGoalIds = new Set(
      goals.filter((goal) => goal.status === 'COMPLETED').map((goal) => goal.id),
    )
    return missions.find((m) => m.status !== 'COMPLETED' && !completedGoalIds.has(m.goalId)) || null
  }, [goals, missions])




  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light')
    document.documentElement.setAttribute('data-brand', isV2Preview ? 'aurora' : 'classic')
    try {
      localStorage.setItem('shinpo_theme', isDarkMode ? 'dark' : 'light')
      localStorage.setItem('shinpo_v2_preview', String(isV2Preview))
    } catch {
      // ignore
    }
    document.body.classList.add('shinpo-glass-ui')
    if (isDarkMode) {
      document.body.classList.remove('theme-light')
      document.body.classList.add('theme-dark')
    } else {
      document.body.classList.remove('theme-dark')
      document.body.classList.add('theme-light')
    }
  }, [isDarkMode, isV2Preview])

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const currentTheme = document.documentElement.getAttribute('data-theme')
      if (currentTheme === 'light' && isDarkMode) {
        setIsDarkMode(false)
      } else if (currentTheme === 'dark' && !isDarkMode) {
        setIsDarkMode(true)
      }
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
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

  const recentToastsTracker = useRef<Map<string, number>>(new Map())
  const seenAlertKeys = useRef<Set<string>>(new Set())

  const shouldSuppressToast = useCallback((key: string, cooldownMs = 2800): boolean => {
    const now = Date.now()
    const lastTime = recentToastsTracker.current.get(key)
    if (lastTime && now - lastTime < cooldownMs) {
      return true
    }
    recentToastsTracker.current.set(key, now)
    if (recentToastsTracker.current.size > 50) {
      for (const [k, v] of recentToastsTracker.current.entries()) {
        if (now - v > 10000) recentToastsTracker.current.delete(k)
      }
    }
    return false
  }, [])

  const pushToast = useCallback((alert: Omit<LiveAlertItem, 'id'>) => {
    const safeTimestamp = toSafeIsoString(alert.timestamp)
    const dedupKey = `${alert.type}:${alert.title}`
    if (shouldSuppressToast(dedupKey, 2800)) {
      return
    }

    const item: LiveAlertItem = {
      ...alert,
      id: crypto.randomUUID(),
      timestamp: safeTimestamp,
    }
    setToastAlerts((prev) => [item, ...prev].slice(0, 2))
    window.setTimeout(() => {
      setToastAlerts((prev) => prev.filter((current) => current.id !== item.id))
    }, 4500)
  }, [shouldSuppressToast])

  const loadData = async (): Promise<{ success: boolean; failedServices: string[] }> => {
    const failedServices: string[] = []
    try {
      const [goalsRes, missionsRes, sessionsRes, analytics, sentStatus, briefing, warnings, progressRes] =
        await Promise.all([
          getGoals().catch((err) => {
            console.error('Failed to fetch goals', err)
            failedServices.push('Goals')
            return null
          }),
          getMissions().catch((err) => {
            console.error('Failed to fetch missions', err)
            failedServices.push('Tasks')
            return null
          }),
          getFocusSessions().catch((err) => {
            console.error('Failed to fetch focus sessions', err)
            failedServices.push('Sessions')
            return null
          }),
          fetchAnalyticsDashboard().catch((err) => {
            console.error('Failed to fetch analytics', err)
            failedServices.push('Analytics')
            return null
          }),
          fetchSentinelStatus().catch((err) => {
            console.error('Failed to fetch sentinel status', err)
            failedServices.push('Focus Protection')
            return null
          }),
          getExecutiveBriefing().catch(() => null),
          fetchActiveWarnings().catch(() => []),
          getCurrentUserProgress().catch(() => null),
        ])
      if (Array.isArray(goalsRes)) setGoals(goalsRes)
      if (Array.isArray(missionsRes)) setMissions(missionsRes)
      if (Array.isArray(sessionsRes)) setSessions(sessionsRes)
      if (analytics) setAnalyticsData(analytics)
      setSentinelStatus(sentStatus)
      if (briefing) setExecutiveBriefing(briefing)
      if (warnings) setActiveWarnings(Array.isArray(warnings) ? warnings : [])
      if (progressRes !== null) setUserProgress(progressRes)
      try {
        const onboarding = await getOnboardingState()
        if (onboarding.canClaimReward) {
          const updatedProgress = await claimOnboardingReward()
          setUserProgress(updatedProgress)
          pushToast({
            type: 'reward', title: 'Onboarding milestone recorded', description: 'Your first complete SHINPO workflow has been recorded.',
            timestamp: new Date().toISOString(),
          })
        }
      } catch {
        // Reward eligibility is rechecked by the backend after real workflow events.
      }
    } catch (err) {
      console.error('Failed during loadData execution', err)
    }

    return {
      success: failedServices.length === 0,
      failedServices,
    }
  }

  const loadDataForEffect = useEffectEvent(loadData)

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
              bugReportDraft:
                message.suggestionType === 'BUG_REPORT_DRAFT' && message.structuredCard
                  ? (message.structuredCard as BugReportDraft)
                  : null,
              structuredCard: message.structuredCard,
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
      } else {
        setChatMessages([{ role: 'assistant', text: 'How can I help you plan your work? I can use the tasks and sessions saved in your current account.' }])
      }
    } catch {
      // Keep initial chat
    }
  }, [])

  useEffect(() => {
    let active = true
    fetchCurrentUser().then((user) => {
      if (active) setCurrentUser(user)
    }).finally(() => {
      if (active) setAuthRestored(true)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    if (!currentUser || !isLocalVaultSession()) return () => { active = false }
    getGuardianPreferences().then((preferences) => {
      if (!active) return
      setSavedGuardianPreferences(preferences)
      setGuardianBackgroundRuntimeConsent(preferences.backgroundRuntimeConsent)
      if (preferences.applyToNewSessions) {
        setGuardianMode(preferences.preferredMode)
        setGuardianAppMonitoring(preferences.appMonitoringConsent)
      } else {
        setGuardianMode('PROTECTED')
        setGuardianAppMonitoring(false)
      }
    }).catch(() => {
      if (active) {
        setGuardianMode('PROTECTED')
        setGuardianAppMonitoring(false)
        setSavedGuardianPreferences({ preferredMode: 'PROTECTED', appMonitoringConsent: false, applyToNewSessions: false, closureConsent: false, backgroundRuntimeConsent: false })
        setGuardianBackgroundRuntimeConsent(false)
      }
    })
    return () => { active = false }
  }, [currentUser])

  useEffect(() => {
    const handleUnauthorized = () => {
      setCurrentUser(null)
      setAuthError('Your session expired. Please sign in again.')
    }
    window.addEventListener('shinpo:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('shinpo:unauthorized', handleUnauthorized)
  }, [])

  useEffect(() => {
    if (!authRestored || !currentUser) return
    const timer = setTimeout(() => {
      void loadDataForEffect()
      void loadActiveConversation()
    }, 0)
    return () => clearTimeout(timer)
  }, [authRestored, currentUser, loadActiveConversation])

  // First-Time User Onboarding Detection (Section 3.1 - Per-Account & Ledger Scoped)
  useEffect(() => {
    if (!authRestored || !currentUser) return
    let active = true
    let timer: number | undefined

    const launchTutorialOrWelcome = () => {
      // Focus/Guardian safety: Defer if user has an active or paused focus session
      if (sessions.some((s) => s.status === 'ACTIVE' || s.status === 'PAUSED')) {
        return
      }
      if (hasActiveModalRef.current) {
        isWelcomePendingLaunch.current = true
      } else if (isInteractiveTutorialEnabled()) {
        handleStartInteractiveTutorial()
      } else {
        setIsOnboardingWelcomeOpen(true)
      }
    }

    getOnboardingState()
      .then((state) => {
        if (!active) return
        if (state.status === 'COMPLETED' || state.status === 'SKIPPED') {
          return
        }
        const dismissed =
          getTutorialStorageItem('shinpo_onboarding_dismissed', currentUser) ||
          getTutorialStorageItem('shinpo_interactive_tutorial_dismissed', currentUser)
        const completed =
          getTutorialStorageItem('shinpo_onboarding_completed', currentUser) ||
          getTutorialStorageItem('shinpo_interactive_tutorial_completed', currentUser)
        if (!dismissed && !completed) {
          timer = window.setTimeout(() => {
            if (active) {
              if (state.status === 'IN_PROGRESS' && state.currentStep > 0 && !isInteractiveTutorialEnabled()) {
                isTutorialPendingLaunch.current = state.currentStep || 0
                if (!hasActiveModalRef.current) {
                  isTutorialPendingLaunch.current = null
                  handleStartTutorialRef.current(state.currentStep || 0)
                }
              } else {
                launchTutorialOrWelcome()
              }
            }
          }, 800)
        }
      })
      .catch(() => {
        if (!active) return
        try {
          const completed =
            getTutorialStorageItem('shinpo_onboarding_completed', currentUser) ||
            getTutorialStorageItem('shinpo_interactive_tutorial_completed', currentUser)
          const dismissed =
            getTutorialStorageItem('shinpo_onboarding_dismissed', currentUser) ||
            getTutorialStorageItem('shinpo_interactive_tutorial_dismissed', currentUser)
          if (!completed && !dismissed) {
            timer = window.setTimeout(() => {
              if (active) {
                launchTutorialOrWelcome()
              }
            }, 800)
          }
        } catch {
          // storage inaccessible
        }
      })

    return () => {
      active = false
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [authRestored, currentUser, sessions, handleStartInteractiveTutorial])

  const addLiveAlert = useCallback((alert: LiveAlertItem, showToast = true) => {
    const safeTimestamp = toSafeIsoString(alert.timestamp)
    const normalizedAlert = {
      ...alert,
      timestamp: safeTimestamp,
    }
    const eventKey = `${normalizedAlert.id}:${normalizedAlert.type}:${normalizedAlert.title}:${normalizedAlert.timestamp}`
    if (seenAlertKeys.current.has(eventKey)) return
    seenAlertKeys.current.add(eventKey)
    if (seenAlertKeys.current.size > 200) {
      seenAlertKeys.current = new Set(Array.from(seenAlertKeys.current).slice(-100))
    }
    setLiveAlerts((prev) => {
      return [normalizedAlert, ...prev].slice(0, 50)
    })
    setUnreadAlertCount((prev) => prev + 1)

    if (!showToast) return
    const dedupKey = `${alert.type}:${alert.title}`
    if (shouldSuppressToast(dedupKey, 2800)) {
      return
    }

    setToastAlerts((prev) => [normalizedAlert, ...prev].slice(0, 2))
    setTimeout(() => {
      setToastAlerts((prev) => prev.filter((item) => item.id !== normalizedAlert.id))
    }, 4500)
  }, [shouldSuppressToast])

  const handleOpenSettings = useCallback((section: SettingsSection = 'appearance') => {
    setSettingsSection(section)
    setIsSettingsOpen(true)
  }, [])

  const handleRefreshWithFeedback = async () => {
    if (isDataRefreshing) return
    setIsDataRefreshing(true)
    const startTime = performance.now()
    try {
      const result = await loadData()
      const elapsed = Math.round(performance.now() - startTime)
      if (!currentUser) return

      if (result.success) {
        pushToast({
          title: 'Data Synchronized',
          description: `All workspace data refreshed successfully (${elapsed}ms).`,
          type: 'focus',
          timestamp: new Date().toISOString(),
        })
      } else if (result.failedServices.length < 5) {
        pushToast({
          title: 'Partial Sync Completed',
          description: `Updated with warnings: ${result.failedServices.join(', ')} unreachable.`,
          type: 'sentinel',
          timestamp: new Date().toISOString(),
        })
      } else {
        pushToast({
          title: 'Sync Failed',
          description: 'Could not reach backend services. Please check connection.',
          type: 'quarantine',
          timestamp: new Date().toISOString(),
        })
      }
    } catch (err) {
      pushToast({
        title: 'Refresh Error',
        description: err instanceof Error ? err.message : 'An error occurred while refreshing data.',
        type: 'quarantine',
        timestamp: new Date().toISOString(),
      })
    } finally {
      window.setTimeout(() => {
        setIsDataRefreshing(false)
      }, 400)
    }
  }

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
      const closureConfirmed = ['TERMINATED', 'CLOSED_GRACEFULLY_VERIFIED']
        .includes(event.enforcementAction.toUpperCase())
      addLiveAlert({
        id: `quarantine-${event.id}-${Date.now()}`,
        type: 'quarantine',
        title: closureConfirmed
          ? `Focus Protection: Closed ${event.processName}`
          : `Focus Protection: Distraction observed — ${event.processName}`,
        badge: `PID ${event.pid} • ${event.enforcementAction || 'WARNING_ONLY'}`,
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
        const modeChanged = prev.enforcementMode !== event.mode
        const lockChanged = prev.isPolicyLocked !== event.isLocked

        if (modeChanged || lockChanged) {
          addLiveAlert({
            id: `status-${Date.now()}`,
            type: 'sentinel',
            title: `Shield: ${event.mode} Mode`,
            badge: event.isLocked ? 'STRICT LOCKED' : 'MONITORING',
            description: `${event.blockedCount} blocked rules actively guarded.`,
            timestamp: event.timestamp || new Date().toISOString(),
          })
        }
        return {
          ...prev,
          enforcementMode: event.mode,
          isPolicyLocked: event.isLocked,
          activePolicyRulesCount: event.blockedCount + event.allowedCount,
        }
      })
    })

    const unsubSession = wsClient.onFocusSession((event: FocusSessionEvent) => {
      void getFocusSessions().then((updatedSessions) => {
        setSessions(updatedSessions)
      }).catch(() => { })

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

      const sessLabel = event.id ? `Session #${event.id}` : 'Focus Sprint'
      const durLabel = `${event.plannedDurationMinutes || 25}m`

      addLiveAlert({
        id: `session-${event.id || Date.now()}-${Date.now()}`,
        type: 'focus',
        title: `Focus Session ${statusLabel}`,
        badge: `${sessLabel} • ${durLabel}`,
        description:
          event.status === 'ACTIVE'
            ? 'Focus timer active. Native protection status is shown separately.'
            : event.debriefNotes || `Focus session transitioned to ${event.status}.`,
        timestamp: event.timestamp || new Date().toISOString(),
      }, event.status !== 'SCHEDULED')
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
        fetchDeviceSnapshot(search, policy).catch(() => null),
        fetchSentinelStatus().catch(() => null),
        fetchSentinelRules().catch(() => []),
        fetchSentinelTamperEvents().catch(() => []),
      ])
      setDeviceSnapshot(snap)
      setSentinelStatus(sentStatus)
      if (Array.isArray(rules)) setSentinelRules(rules)
      if (Array.isArray(tEvents)) setTamperEvents(tEvents)
    } catch (err) {
      console.error('Failed to load device snapshot', err)
    } finally {
      setTmLoading(false)
    }
  }, [tmSearch, tmPolicy, setSentinelStatus, setSentinelRules, setTamperEvents])

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true)
    setAnalyticsError(false)
    try {
      const data = await fetchAnalyticsDashboard()
      setAnalyticsData(data)
    } catch (err) {
      setAnalyticsError(true)
      console.error('Failed to load analytics dashboard', err)
    } finally {
      setAnalyticsLoading(false)
    }
  }, [])

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
      } else if (authMode === 'REGISTER') {
        const cleanUsername = authIdentifier.trim().toLowerCase()
        if (cleanUsername.length < 3 || cleanUsername.length > 32 || !/^[a-z0-9_.-]+$/.test(cleanUsername)) {
          setAuthError('Username must be 3–32 characters using letters, numbers, dot, dash, or underscore (no spaces).')
          setAuthLoading(false)
          return
        }
        if (authPassword.length < 15) {
          setAuthError('Password must contain at least 15 characters.')
          setAuthLoading(false)
          return
        }
        const res = await register(authIdentifier.trim(), authEmail.trim(), authPassword)
        if (res.recoveryKey) {
          setPendingRecovery({ user: res.user, recoveryKey: res.recoveryKey })
          setRecoveryKeyCopied(false)
          setRecoveryConfirmed(false)
        } else {
          setCurrentUser(res.user)
        }
      } else {
        const res = await recoverLocalAccount(authIdentifier.trim(), authRecoveryKey, authPassword)
        setCurrentUser(res.user)
      }
      setAuthIdentifier('')
      setAuthEmail('')
      setAuthPassword('')
      setAuthRecoveryKey('')
    } catch (err: unknown) {
      const msg = err instanceof Error
        ? err.message
        : typeof err === 'string'
          ? err
          : 'Authentication failed'
      setAuthError(msg)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Locking workspace failed.'
      setAuthError(`Could not lock workspace securely: ${message}`)
      pushToast({
        type: 'sentinel',
        title: 'Lock Workspace Failed',
        description: `Could not securely lock the native encrypted vault: ${message}`,
        timestamp: new Date().toISOString(),
      })
      return
    }
    wsClient.disconnect()
    setIsWsConnected(false)
    setLiveAlerts([])
    setToastAlerts([])
    setUnreadAlertCount(0)
    setCurrentUser(null)
    setSessions([])
    setGoals([])
    setMissions([])
    setGuardianMode('PROTECTED')
    setGuardianAppMonitoring(false)
    setSavedGuardianPreferences({ preferredMode: 'PROTECTED', appMonitoringConsent: false, applyToNewSessions: false, closureConsent: false, backgroundRuntimeConsent: false })
    setGuardianBackgroundRuntimeConsent(false)
  }

  const triggerIdleLogout = useEffectEvent(() => {
    void handleLogout()
  })

  useEffect(() => {
    if (!currentUser || !isLocalVaultSession()) return
    let lastActivityAt = Date.now()
    let lastNativeActivityAt = 0
    let locked = false
    const checkIdle = () => {
      if (!locked && isLocalVaultIdleLockDue(lastActivityAt, Date.now())) {
        locked = true
        triggerIdleLogout()
      }
    }
    const recordActivity = () => {
      lastActivityAt = Date.now()
      if (lastActivityAt - lastNativeActivityAt >= 30_000) {
        lastNativeActivityAt = lastActivityAt
        void touchLocalVaultActivity().catch(() => undefined)
      }
    }
    const interval = window.setInterval(checkIdle, 15_000)
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel']
    for (const event of events) window.addEventListener(event, recordActivity, { passive: true })
    window.addEventListener('focus', checkIdle)
    document.addEventListener('visibilitychange', checkIdle)
    return () => {
      window.clearInterval(interval)
      for (const event of events) window.removeEventListener(event, recordActivity)
      window.removeEventListener('focus', checkIdle)
      document.removeEventListener('visibilitychange', checkIdle)
    }
  }, [currentUser])

  useEffect(() => {
    if (!currentUser) return
    if (isLocalVaultSession()) {
      seenGuardianObservationIds.current.clear()
      let active = true
      const refresh = () => fetchSentinelStatus().then((status) => {
        if (!active) return
        const observation = takeRecentGuardianObservation(
          status.guardianObservations ?? [],
          seenGuardianObservationIds.current,
        )
        if (observation) {
          pushToast({
            type: 'focus',
            title: `Guardian noticed ${observation.processName}`,
            description: 'This app matches the distraction catalog. It was recorded locally and remains open.',
            timestamp: observation.observedAt,
          })
        }
        setSentinelStatus(status)
      }).catch(() => {
        if (active) setSentinelStatus(null)
      })
      refresh()
      const interval = setInterval(refresh, 6000)
      return () => {
        active = false
        clearInterval(interval)
      }
    }
    const interval = setInterval(() => {
      fetchSentinelStatus()
        .then((st) => {
          if (st) setSentinelStatus(st)
        })
        .catch(() => setSentinelStatus(null))
    }, 6000)
    return () => {
      clearInterval(interval)
    }
  }, [currentUser, pushToast])

  const handleToggleSidebar = useCallback(() => {
    setSidebarExpanded((prev) => {
      const next = !prev
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('shinpo_sidebar_pinned', String(next))
        } catch {
          // ignore localStorage errors
        }
      }
      return next
    })
  }, [])

  const handleSelectTab = useCallback((tab: AppView) => {
    setActiveTab(tab)
    if (tab === 'Dashboard') {
      // The active-session card already confirms this event; keep its toast off the schedule.
      setToastAlerts((prev) => prev.filter((alert) => alert.title !== 'Focus Session Started'))
    }
  }, [setActiveTab])

  const [missionsFilter, setMissionsFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL')

  const handleNavigateToTasks = (filter: 'ALL' | 'PENDING' | 'COMPLETED' = 'ALL') => {
    setMissionsFilter(filter)
    setActiveTab('Goals & Missions')
  }

  const handleToggleAlertsDrawer = useCallback(() => {
    setIsAlertsDrawerOpen((prev) => !prev)
    setUnreadAlertCount(0)
  }, [])

  const handleToggleTheme = useCallback(() => {
    setIsDarkMode((prev) => {
      const next = !prev
      document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
      try {
        localStorage.setItem('shinpo_theme', next ? 'dark' : 'light')
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  const handleToggleV2Preview = useCallback(() => {
    setIsV2Preview((prev) => {
      const next = !prev
      document.documentElement.setAttribute('data-brand', next ? 'aurora' : 'classic')
      try {
        localStorage.setItem('shinpo_v2_preview', String(next))
      } catch {
        // ignore localStorage errors
      }
      return next
    })
  }, [])

  const handleSaveServerUrl = async () => {
    const validation = isValidServerUrl(customServerUrlInput)
    if (!validation.valid) {
      setServerConfigSaved(false)
      setServerConfigError(validation.reason || 'Invalid server URL')
      return
    }
    try {
      await setCustomServerUrl(customServerUrlInput)
    } catch (err) {
      setServerConfigSaved(false)
      setServerConfigError(err instanceof Error ? err.message : 'Could not clear the saved session')
      return
    }
    setServerConfigError('')
    setServerConfigSaved(true)
    setTimeout(() => setServerConfigSaved(false), 3000)
  }

  const handleResetServerUrl = async () => {
    try {
      await setCustomServerUrl('')
    } catch (err) {
      setServerConfigError(err instanceof Error ? err.message : 'Could not clear the saved session')
      return
    }
    setCustomServerUrlInput('')
    setServerConfigSaved(true)
    setTimeout(() => setServerConfigSaved(false), 2000)
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
      pushToast({
        title: 'Goal Created',
        description: `Created "${created.title}"`,
        type: 'focus',
        timestamp: new Date().toISOString(),
      })
      await loadData()
      if (isTutorialActive && SHINPO_ONBOARDING_STEPS[tutorialStepIndex]?.id === 'CREATE_GOAL') {
        handleNextTutorialStep()
      }
    } catch (err) {
      console.error('Failed to create goal', err)
      pushToast({
        title: 'Goal Creation Failed',
        description: 'Could not create goal. Please try again.',
        type: 'focus',
        timestamp: new Date().toISOString(),
      })
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
      if (updated.status === 'COMPLETED' && editingGoal.status !== 'COMPLETED') {
        pushToast({
          title: 'Goal Completed',
          description: 'Strategic outcome achieved.',
          type: 'reward',
          timestamp: new Date().toISOString(),
        })
      }
      setEditingGoal(null)
      await loadData()
      advanceTutorialAfterAction('CREATE_GOAL')
    } catch (err) {
      console.error('Failed to update goal', err)
      pushToast({
        title: 'Goal Update Failed',
        description: 'Could not update goal. Please try again.',
        type: 'focus',
        timestamp: new Date().toISOString(),
      })
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
      await loadData()
      advanceTutorialAfterAction('CREATE_TASK')
    } catch (err) {
      console.error('Failed to update task', err)
      pushToast({
        title: 'Task Update Failed',
        description: 'Could not update task. Please try again.',
        type: 'focus',
        timestamp: new Date().toISOString(),
      })
    }
  }

  const handleDeconstructGoal = async (goalId: number) => {
    if (!currentUser) return
    setDecomposingGoalId(goalId)
    try {
      const result = await decomposeGoal(goalId, currentUser.id)
      setAiDecompResult(result)
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
        await commitSuggestion(aiDecompResult.suggestionId, { targetGoalId: aiDecompResult.goalId, confirmationToken: aiDecompResult.confirmationToken })
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
      if (!activeGoalId) {
        pushToast({
          title: 'Goal Required',
          description: 'Please create an execution goal first before adding AI tasks.',
          type: 'focus',
          timestamp: new Date().toISOString(),
        })
        setChatMessages((prev) =>
          prev.map((msg, idx) =>
            idx === msgIndex ? { ...msg, committing: false } : msg,
          ),
        )
        return
      }
      await commitSuggestion(suggestionId, {
        targetGoalId: activeGoalId,
        selectedMissions: specificMission ? [specificMission] : undefined,
      })
      await loadData()
      pushToast({
        title: 'Tasks Added',
        description: specificMission
          ? `Added task: "${specificMission.title}"`
          : 'AI suggested tasks added to your plan.',
        type: 'focus',
        timestamp: new Date().toISOString(),
      })
      setChatMessages((prev) =>
        prev.map((msg, idx) =>
          idx === msgIndex
            ? { ...msg, committing: false, committed: specificMission ? msg.committed : true }
            : msg,
        ),
      )
    } catch (err) {
      console.error('Failed to commit suggestion', err)
      pushToast({
        title: 'Action Failed',
        description: 'Could not add suggested tasks. Please try again.',
        type: 'focus',
        timestamp: new Date().toISOString(),
      })
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
        confirmationToken: plan.confirmationToken,
      })
      await loadData()
      pushToast({
        title: 'Agenda Scheduled',
        description: 'Daily plan scheduled into your calendar.',
        type: 'focus',
        timestamp: new Date().toISOString(),
      })
      setChatMessages((prev) =>
        prev.map((msg, idx) =>
          idx === msgIndex
            ? { ...msg, committing: false, committed: true }
            : msg,
        ),
      )
    } catch (err) {
      console.error('Failed to commit daily plan to schedule:', err)
      pushToast({
        title: 'Schedule Failed',
        description: 'Could not schedule daily plan. Please try again.',
        type: 'focus',
        timestamp: new Date().toISOString(),
      })
      setChatMessages((prev) =>
        prev.map((msg, idx) =>
          idx === msgIndex ? { ...msg, committing: false } : msg,
        ),
      )
    }
  }

  const handleToggleMissionComplete = async (missionId: number) => {
    try {
      const targetMission = missions.find((m) => m.id === missionId)
      await completeMission(missionId)
      setMissions((prev) =>
        prev.map((m) => (m.id === missionId ? { ...m, status: 'COMPLETED' } : m)),
      )
      await loadData()
      const updatedProg = await getCurrentUserProgress().catch(() => null)
      if (updatedProg) setUserProgress(updatedProg)
      const isMinimal = typeof localStorage !== 'undefined' && localStorage.getItem('shinpo_celebration_effects') === 'minimal'
      pushToast({ title: 'Task completed', description: 'Task state saved successfully.', type: 'focus', timestamp: new Date().toISOString() })
      const celebrationTimestamp = ++celebrationSequence.current
      if (!isMinimal) {
        setCelebrationPayload({
          id: `task-${missionId}-${celebrationTimestamp}`,
          type: 'TASK',
          headline: 'Task completed',
          detail: `“${targetMission?.title || 'Task'}” was saved as complete.`,
          xpEarned: 0,
          nextActionPrompt: 'Arm Focus Sprint',
          nextActionTab: 'Focus Engine',
        })
      }
      if (sessions.some((session) => session.missionId === missionId && session.status === 'COMPLETED')) {
        advanceTutorialAfterAction('COMPLETE')
      }
    } catch (err) {
      console.error('Failed to complete task', err)
      pushToast({
        title: 'Task Completion Failed',
        description: 'Could not complete task. Please try again.',
        type: 'focus',
        timestamp: new Date().toISOString(),
      })
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
        try {
          await deleteGoal(goalId)
          setGoals((prev) => prev.filter((g) => g.id !== goalId))
          setMissions((prev) => prev.filter((m) => m.goalId !== goalId))
          await loadData()
        } catch (err: unknown) {
          console.error('Failed to delete goal:', err)
          pushToast({
            type: 'focus',
            title: 'Delete Failed',
            description: err instanceof Error ? err.message : 'Could not delete goal.',
            timestamp: new Date().toISOString(),
          })
          await loadData()
        }
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
        try {
          await deleteAllGoals()
          setGoals([])
          setMissions((prev) => prev.filter((mission) => !goals.some((goal) => goal.id === mission.goalId)))
          await loadData()
        } catch (err: unknown) {
          console.error('Failed to delete all goals:', err)
          pushToast({
            type: 'focus',
            title: 'Delete All Failed',
            description: err instanceof Error ? err.message : 'Could not delete all goals.',
            timestamp: new Date().toISOString(),
          })
          await loadData()
        }
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
  const activeGraceWarning = Array.isArray(activeWarnings) ? activeWarnings.find((w) => w.status === 'GRACE_ACTIVE') ?? null : null

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

  useEffect(() => {
    if (!activeSession?.pomodoroEnabled || activeSession.status !== 'ACTIVE') return
    let cancelled = false
    let timeout: number
    const refreshPhase = async () => {
      try {
        const updated = await getFocusSession(activeSession.id)
        if (!cancelled) {
          setSessions((prev) => prev.map((session) => session.id === updated.id ? updated : session))
          if (updated.currentPhase === 'RETURN_REQUIRED' && activeSession?.currentPhase !== 'RETURN_REQUIRED') {
            const progress = await getCurrentUserProgress().catch(() => null)
            if (!cancelled && progress) setUserProgress(progress)
          }
        }
      } catch {
        // Preserve the last persisted phase during temporary API loss.
      } finally {
        if (!cancelled) timeout = window.setTimeout(refreshPhase, 2500)
      }
    }
    void refreshPhase()
    return () => { cancelled = true; window.clearTimeout(timeout) }
  }, [activeSession?.id, activeSession?.pomodoroEnabled, activeSession?.status, activeSession?.currentPhase])

  // Poll for Sentinel warnings during active focus session or while warnings/grace windows exist
  useEffect(() => {
    if (!currentUser) return
    const pollWarnings = async () => {
      try {
        const w = await fetchActiveWarnings()
        setActiveWarnings(Array.isArray(w) ? w : [])
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
      const msg = err instanceof Error ? err.message : 'Failed to submit your response to the focus protection warning'
      setWarningError(msg)
    } finally {
      setWarningSubmitting(false)
    }
  }

  // When all conflicting modals close, resume any pending tutorial launch cleanly
  useEffect(() => {
    if (hasActiveModal) return
    if (isWelcomePendingLaunch.current) {
      isWelcomePendingLaunch.current = false
      const timer = setTimeout(() => {
        if (isInteractiveTutorialEnabled()) {
          handleStartInteractiveTutorial()
        } else {
          setIsOnboardingWelcomeOpen(true)
        }
      }, 0)
      return () => clearTimeout(timer)
    }
    if (isTutorialPendingLaunch.current !== null) {
      const stepToLaunch = isTutorialPendingLaunch.current
      isTutorialPendingLaunch.current = null
      const timer = setTimeout(() => {
        if (isInteractiveTutorialEnabled()) {
          handleStartInteractiveTutorial()
        } else {
          handleStartTutorialRef.current(stepToLaunch)
        }
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [hasActiveModal, handleStartInteractiveTutorial])

  function handleStartTutorial(initialStepIndex?: number) {
    if (isInteractiveTutorialEnabled()) {
      handleStartInteractiveTutorial()
      return
    }
    handleStartTutorialRef.current = handleStartTutorial
    setIsOnboardingWelcomeOpen(false)
    let stepIndex = initialStepIndex
    if (stepIndex === undefined) {
      try {
        const saved = getTutorialStorageItem('shinpo_onboarding_progress', currentUser?.id)
        stepIndex = saved ? parseInt(saved, 10) : 0
      } catch {
        stepIndex = 0
      }
    }
    if (isNaN(stepIndex) || stepIndex < 0 || stepIndex >= SHINPO_ONBOARDING_STEPS.length) {
      stepIndex = 0
    }

    // Modal conflict guard
    if (hasActiveModal) {
      const hasUnsavedDraft =
        (isCreatingQuickMission && quickMissionTitle.trim().length > 0) ||
        (isCreatingGoal && newGoalTitle.trim().length > 0) ||
        Boolean(editingGoal) ||
        Boolean(editingMission) ||
        Boolean(isBookingSession && bookName.trim().length > 0) ||
        Boolean(pendingWarning) ||
        Boolean(completingSessionId)

      if (hasUnsavedDraft) {
        pushToast({
          type: 'focus',
          title: 'Action In Progress',
          description: 'Please finish or close your active draft before starting the guided tour.',
          timestamp: new Date().toISOString(),
        })
        isTutorialPendingLaunch.current = stepIndex
        return
      }

      // Safe to close clean / empty modals before starting tour
      setIsCreatingQuickMission(false)
      setIsCreatingGoal(false)
      setIsBookingSession(false)
      setIsSettingsOpen(false)
      setIsAlertsDrawerOpen(false)
    }

    setIsTutorialActive(true)
    setTutorialStepIndex(stepIndex)
    startOnboarding(stepIndex).catch(() => { })
    setTutorialStorageItem('shinpo_onboarding_progress', String(stepIndex), currentUser?.id)
    removeTutorialStorageItem('shinpo_onboarding_dismissed', currentUser?.id)
    const step = SHINPO_ONBOARDING_STEPS[stepIndex]
    if (step && step.targetTab) {
      if (isAppView(step.targetTab)) setActiveTab(step.targetTab)
    }
  }
  useEffect(() => {
    handleStartTutorialRef.current = handleStartTutorial
  })

  function handleNextTutorialStep() {
    if (tutorialStepIndex < SHINPO_ONBOARDING_STEPS.length - 1) {
      const nextIndex = tutorialStepIndex + 1
      setTutorialStepIndex(nextIndex)
      setTutorialStorageItem('shinpo_onboarding_progress', String(nextIndex), currentUser?.id)
      const nextStep = SHINPO_ONBOARDING_STEPS[nextIndex]
      if (nextStep && nextStep.targetTab) {
        if (isAppView(nextStep.targetTab)) setActiveTab(nextStep.targetTab)
      }
    } else {
      handleCompleteTutorial()
    }
  }

  function advanceTutorialAfterAction(stepId: string) {
    if (isTutorialActive && SHINPO_ONBOARDING_STEPS[tutorialStepIndex]?.id === stepId) {
      handleNextTutorialStep()
    }
  }

  const handlePrevTutorialStep = () => {
    if (tutorialStepIndex > 0) {
      const prevIndex = tutorialStepIndex - 1
      setTutorialStepIndex(prevIndex)
      setTutorialStorageItem('shinpo_onboarding_progress', String(prevIndex), currentUser?.id)
      const prevStep = SHINPO_ONBOARDING_STEPS[prevIndex]
      if (prevStep && prevStep.targetTab) {
        if (isAppView(prevStep.targetTab)) setActiveTab(prevStep.targetTab)
      }
    }
  }

  const handleExitTutorial = () => {
    setIsTutorialActive(false)
    setTutorialStorageItem('shinpo_onboarding_dismissed', 'true', currentUser?.id)
    setTutorialStorageItem('shinpo_onboarding_progress', String(tutorialStepIndex), currentUser?.id)
    pauseOnboarding(tutorialStepIndex).catch(() => { })
    setChatMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        text: 'Walkthrough paused. You can resume right where you left off anytime by asking "How do I use SHINPO?" or clicking "Guided tour".',
        suggestionType: 'COACH',
      },
    ])
  }

  const handleSkipTutorial = () => {
    setIsTutorialActive(false)
    setIsOnboardingWelcomeOpen(false)
    setTutorialStorageItem('shinpo_onboarding_dismissed', 'true', currentUser?.id)
    removeTutorialStorageItem('shinpo_onboarding_progress', currentUser?.id)
    skipOnboarding().catch(() => { })
    pushToast({
      type: 'focus',
      title: 'Walkthrough Skipped',
      description: 'You can replay the guided tour anytime from EONPAI or Settings.',
      timestamp: new Date().toISOString(),
    })
    setChatMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        text: 'Guided walkthrough skipped. You can restart the tour anytime by asking "How do I use SHINPO?" or clicking "Guided tour".',
        suggestionType: 'COACH',
      },
    ])
  }

  const handleDismissOnboardingWelcome = () => {
    setIsOnboardingWelcomeOpen(false)
    setTutorialStorageItem('shinpo_onboarding_dismissed', 'true', currentUser)
  }

  const handleCloseInteractiveTutorial = useCallback(() => {
    setIsInteractiveTutorialOpen(false)
    setTutorialStorageItem('shinpo_interactive_tutorial_dismissed', 'true', currentUser)
    setTutorialStorageItem('shinpo_onboarding_dismissed', 'true', currentUser)
    skipOnboarding().catch(() => {})
  }, [currentUser])

  const handleCompleteInteractiveTutorial = useCallback(
    async (data: {
      goalTitle: string
      objectiveTitle: string
      taskTitle: string
      taskDuration: number
      taskPriority: 'HIGH' | 'MEDIUM' | 'LOW'
      scheduledDay: string
      scheduledTimeSlot: string
      saveToWorkspace: boolean
    }) => {
      setIsInteractiveTutorialOpen(false)
      const alreadyCompleted =
        getTutorialStorageItem('shinpo_interactive_tutorial_completed', currentUser) === 'true' ||
        getTutorialStorageItem('shinpo_onboarding_completed', currentUser) === 'true'

      setTutorialStorageItem('shinpo_interactive_tutorial_completed', 'true', currentUser)
      setTutorialStorageItem('shinpo_onboarding_completed', 'true', currentUser)
      setTutorialStorageItem('shinpo_onboarding_dismissed', 'true', currentUser)
      try {
        localStorage.setItem('shinpo_onboarding_verified', 'true')
        setTutorialStorageItem('shinpo_onboarding_verified', 'true', currentUser)
      } catch {
        // ignore
      }

      finishOnboarding().catch(() => {})

      if (!alreadyCompleted) {
        claimOnboardingReward()
          .then((prog) => {
            if (prog) setUserProgress(prog)
          })
          .catch(() => {})
      }

      if (data.saveToWorkspace && data.goalTitle.trim()) {
        try {
          const today = new Date().toISOString().split('T')[0]
          const createdGoal = await createGoal({
            title: data.goalTitle.trim(),
            description: data.objectiveTitle ? `Objective: ${data.objectiveTitle}` : undefined,
            startDate: today,
          })

          if (createdGoal && createdGoal.id && data.taskTitle.trim()) {
            await createMission({
              goalId: createdGoal.id,
              title: data.taskTitle.trim(),
              description: `Priority: ${data.taskPriority} • Planned: ${data.taskDuration}m (${data.scheduledDay} ${data.scheduledTimeSlot})`,
              scheduledDate: today,
              estimatedMinutes: data.taskDuration,
            })
          }

          await loadData()

          pushToast({
            type: 'focus',
            title: 'Workspace Ready',
            description: `Added goal "${data.goalTitle}" and initial task to your workspace.`,
            timestamp: new Date().toISOString(),
          })
        } catch (err) {
          console.error('Failed to seed tutorial goal into workspace:', err)
        }
      } else {
        pushToast({
          type: 'focus',
          title: 'Welcome to SHINPO',
          description: 'Your workspace is ready. Define your next focus session whenever you are ready.',
          timestamp: new Date().toISOString(),
        })
      }
    },
    [currentUser, loadData, pushToast],
  )

  const handleCompleteTutorial = () => {
    setIsTutorialActive(false)
    setTutorialStorageItem('shinpo_onboarding_completed', 'true', currentUser?.id)
    setTutorialStorageItem('shinpo_tutorial_completed', 'true', currentUser?.id)
    removeTutorialStorageItem('shinpo_onboarding_progress', currentUser?.id)
    removeTutorialStorageItem('shinpo_onboarding_dismissed', currentUser?.id)

    finishOnboarding()
      .then((state) => {
        if (state.canClaimReward) return claimOnboardingReward()
        pushToast({
          type: 'focus', title: 'Tour complete',
          description: 'Complete a real goal, linked task, scheduled Focus session and task completion to record this milestone.',
          timestamp: new Date().toISOString(),
        })
        return null
      })
      .then((prog) => {
        if (!prog) return
        setTutorialStorageItem('shinpo_onboarding_verified', 'true', currentUser?.id)
        setUserProgress(prog)
        setCelebrationPayload({
          id: `onboarding-${Date.now()}`,
          type: 'ONBOARDING',
          headline: 'Onboarding complete',
          detail: 'You have mastered the complete Execution OS workflow: Goal → Task → Schedule → Focus → Progress.',
          xpEarned: 0,
          nextActionPrompt: 'Enter Cockpit',
          nextActionTab: 'Dashboard',
        })
        pushToast({
          type: 'reward',
          title: 'Onboarding complete',
          description: 'Your core SHINPO workflow is ready to use.',
          timestamp: new Date().toISOString(),
        })
      })
      .catch((err) => {
        console.warn('Onboarding reward claim rejected or already claimed:', err)
      })

    setChatMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        text: "You're all set! You now know the complete core SHINPO loop: Goal -> Task -> Schedule -> Focus Session -> Focus Protection -> Session Summary -> Analytics. Execution begins now.",
        suggestionType: 'COACH',
      },
    ])
  }

  useEffect(() => {
    window.__SHINPO_START_TUTORIAL__ = (initialStepIndex?: number) => handleStartTutorialRef.current(initialStepIndex)
    window.__SHINPO_NAVIGATE_TAB__ = (tab: AppView) => {
      if (isAppView(tab)) setActiveTab(tab)
    }
    return () => {
      delete window.__SHINPO_START_TUTORIAL__
      delete window.__SHINPO_NAVIGATE_TAB__
    }
  }, [setActiveTab])

  const handleStartSession = async () => {
    if (!currentUser) return
    const userId = currentUser.id

    const conflict = sessions.find((s) => s.status === 'ACTIVE' || s.status === 'PAUSED')
    if (conflict) {
      pushToast({
        type: 'focus',
        title: 'Focus Session in Progress',
        description: `"${conflict.name}" is already ${conflict.status.toLowerCase()}. Please complete or cancel it first.`,
        timestamp: new Date().toISOString(),
      })
      return
    }

    try {
      const created = await createFocusSession({
        userId,
        name: selectedPomodoroPlan ?? `${selectedDuration}m Focus Session`,
        intention: sessionIntention.trim() || undefined,
        durationMinutes: selectedDuration,
        pomodoroEnabled,
        pomodoroFocusCycles,
        pomodoroShortBreakMinutes,
        pomodoroLongBreakMinutes,
        pomodoroGraceMinutes,
        latePenaltyEnabled: pomodoroEnabled && latePenaltyEnabled,
        latePenaltyXp,
        latePenaltyDailyCapXp,
        guardianMode,
        guardianAppMonitoring,
      })
      const started = await startFocusSession(created.id, userId)
      setGuardianMode(savedGuardianPreferences.applyToNewSessions ? savedGuardianPreferences.preferredMode : 'PROTECTED')
      setGuardianAppMonitoring(savedGuardianPreferences.applyToNewSessions && savedGuardianPreferences.appMonitoringConsent)
      setSessions((prev) => [started, ...prev.filter((s) => s.id !== started.id)])
      advanceTutorialAfterAction('FOCUS')
      setSessionIntention('')
      pushToast({
        type: 'focus',
        title: 'Focus Session Started',
        description: `Focus timer started for "${started.name}". Protection status is shown separately.`,
        timestamp: new Date().toISOString(),
      })
    } catch (e: unknown) {
      console.error(e)
      pushToast({
        type: 'focus',
        title: 'Start Failed',
        description: e instanceof Error ? e.message : 'Could not start focus session.',
        timestamp: new Date().toISOString(),
      })
    }
  }

  const handleEngageNextAction = async () => {
    if (!currentUser || !nextActionMission) return
    const userId = currentUser.id

    const conflict = sessions.find((s) => s.status === 'ACTIVE' || s.status === 'PAUSED')
    if (conflict) {
      pushToast({
        type: 'focus',
        title: 'Focus Session in Progress',
        description: `"${conflict.name}" is already ${conflict.status.toLowerCase()}.`,
        timestamp: new Date().toISOString(),
      })
      setActiveTab('Focus Engine')
      return
    }

    const mins = nextActionMission.estimatedMinutes || 25
    try {
      const created = await createFocusSession({
        userId,
        goalId: nextActionMission.goalId,
        missionId: nextActionMission.id,
        name: nextActionMission.title,
        intention: nextActionMission.title,
        durationMinutes: mins,
      })
      const started = await startFocusSession(created.id, userId)
      setSessions((prev) => [started, ...prev.filter((s) => s.id !== started.id)])
      advanceTutorialAfterAction('FOCUS')
      setSelectedDuration(mins)
      setSessionIntention(nextActionMission.title)
      setActiveTab('Focus Engine')
      pushToast({
        type: 'focus',
        title: 'Focus Session Started',
        description: `Working on next action: "${started.name}".`,
        timestamp: new Date().toISOString(),
      })
    } catch (e: unknown) {
      console.error(e)
      pushToast({
        type: 'focus',
        title: 'Start Failed',
        description: e instanceof Error ? e.message : 'Could not start focus session.',
        timestamp: new Date().toISOString(),
      })
    }
  }

  const handleArmMissionAsSession = async (missionTitle: string, estimatedMinutes?: number) => {
    if (!currentUser) return
    const conflict = sessions.find((session) => session.status === 'ACTIVE' || session.status === 'PAUSED')
    if (conflict) {
      pushToast({
        type: 'focus',
        title: 'Focus Session in Progress',
        description: `"${conflict.name}" is already in progress.`,
        timestamp: new Date().toISOString(),
      })
      setActiveTab('Focus Engine')
      return
    }
    const userId = currentUser.id
    const mins = estimatedMinutes || 25
    const matchedMission = missions.find((m) => m.title === missionTitle)
    try {
      const created = await createFocusSession({
        userId,
        goalId: matchedMission?.goalId,
        missionId: matchedMission?.id,
        name: missionTitle,
        intention: missionTitle,
        durationMinutes: mins,
      })
      const started = await startFocusSession(created.id, userId)
      setSessions((prev) => [started, ...prev.filter((s) => s.id !== started.id)])
      advanceTutorialAfterAction('FOCUS')
      setSelectedDuration(mins)
      setSessionIntention(missionTitle)
      setActiveTab('Focus Engine')
      pushToast({
        type: 'focus',
        title: 'Focus Session Started',
        description: `Focus timer started for "${started.name}". Protection status is shown separately.`,
        timestamp: new Date().toISOString(),
      })
    } catch (e: unknown) {
      console.error('Failed to start focus session:', e)
      pushToast({
        type: 'focus',
        title: 'Arm Sprint Failed',
        description: e instanceof Error ? e.message : 'Could not start focus session.',
        timestamp: new Date().toISOString(),
      })
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

  const handleReturnToFocus = async (id: number) => {
    try {
      const updated = await returnToFocus(id)
      setSessions((prev) => prev.map((session) => session.id === id ? updated : session))
    } catch (error) {
      console.error('Could not return to Focus:', error)
    }
  }

  const handleCompleteSubmit = async (e: FormEvent, debriefWithAi: boolean = false) => {
    e.preventDefault()
    if (!currentUser || !completingSessionId || isCompletingSession) return
    const targetSessionId = completingSessionId
    const userId = currentUser.id
    setIsCompletingSession(true)
    setCompleteSessionError(null)
    try {
      const res = await completeFocusSession(
        targetSessionId,
        userId,
        {
          quality: completionQuality,
          accomplishment,
          reflectionNote: reflectionNotes,
          markMissionCompleted: markTaskCompleted,
        },
      )
      setSessions((prev) => prev.map((s) => (s.id === targetSessionId ? res : s)))
      if (markTaskCompleted) advanceTutorialAfterAction('COMPLETE')
      setCompletingSessionId(null)
      setAccomplishment('')
      setReflectionNotes('')
      setCompleteSessionError(null)
      const measuredFocusSeconds = res.pomodoroEnabled ? res.focusActiveSeconds ?? res.activeSeconds ?? 0 : res.activeSeconds ?? 0
      const activeMinutes = Math.floor(measuredFocusSeconds / 60)
      const isMinimal = typeof localStorage !== 'undefined' && localStorage.getItem('shinpo_celebration_effects') === 'minimal'
      await loadData()
      const updatedProg = await getCurrentUserProgress().catch(() => null)
      if (updatedProg) setUserProgress(updatedProg)
      pushToast({
        type: 'focus',
        title: 'Session completed',
        description: `Focus block recorded with ${activeMinutes} actual active minutes and quality ${completionQuality}/5.`,
        timestamp: new Date().toISOString(),
      })
      const celebrationTimestamp = ++celebrationSequence.current
      if (!isMinimal) {
        setCelebrationPayload({
          id: `session-${targetSessionId}-${celebrationTimestamp}`,
          type: 'FOCUS_SESSION',
          headline: 'Focus session completed',
          detail: `Deep work session verified (${activeMinutes} active mins, quality ${completionQuality}/5).`,
          xpEarned: 0,
          nextActionPrompt: debriefWithAi ? 'Debrief with EONPAI' : 'Take a 5-min Breather',
          nextActionTab: debriefWithAi ? 'AI Assistant' : undefined,
        })
      }
      if (debriefWithAi) {
        setActiveTab('AI Assistant')
        handleAiSend(`Analyze session debrief for session #${targetSessionId}`, targetSessionId)
      }
    } catch (err: unknown) {
      console.error(err)
      const errorMsg = err instanceof Error ? err.message : 'Could not save session completion.'
      setCompleteSessionError(errorMsg)
      pushToast({
        type: 'focus',
        title: 'Completion Failed',
        description: errorMsg,
        timestamp: new Date().toISOString(),
      })
    } finally {
      setIsCompletingSession(false)
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
      handleAiSend('Break my current task into clear 15-minute steps')
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
    if (!prompt.trim() || aiLoading) return

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
      const bugReportDraft: BugReportDraft | null =
        res.suggestionType === 'BUG_REPORT_DRAFT' && res.structuredCard
          ? (res.structuredCard as BugReportDraft)
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
            bugReportDraft,
            structuredCard: res.structuredCard,
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
            bugReportDraft: null,
            structuredCard: null,
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
                      bugReportDraft,
                      structuredCard: res.structuredCard,
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
        await clearAuthSession()
        setCurrentUser(null)
        return
      }
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: "I couldn't complete that request. Your message is still visible in this chat; please try again.",
          suggestionType: 'ERROR',
        },
      ])
    }
  }

  const handleTriggerPresetAction = (promptText: string) => {
    setActiveTab('AI Assistant')
    handleAiSend(promptText)
  }

  const getUpcomingBookingTime = (): string => {
    const d = new Date()
    d.setMinutes(d.getMinutes() + 15, 0, 0)
    const hours = String(d.getHours()).padStart(2, '0')
    const mins = String(d.getMinutes()).padStart(2, '0')
    return `${hours}:${mins}`
  }

  const handleOpenBookingModal = (defaultDate?: string, presetDuration?: number, presetPlan?: string) => {
    const todayStr = localCalendarDate()
    const targetDate = defaultDate || selectedScheduleDate || todayStr
    setBookDate(targetDate)
    setBookDuration(presetDuration || 25)
    setBookPlanName(presetPlan ?? null)
    setBookMissionId(null)
    setBookName('')
    setBookIntention('')
    setBookTime(targetDate === todayStr ? getUpcomingBookingTime() : '09:00')
    setEditingScheduleSession(null)
    setIsBookingSession(true)
  }

  const handleEditSessionFromSchedule = (session: FocusSession) => {
    setEditingScheduleSession(session)
    setBookName(session.name)
    setBookIntention(session.intention || '')
    setBookDuration(session.durationMinutes)
    setBookMissionId(session.missionId ?? null)
    setBookPlanName(null)
    if (session.scheduledAt) {
      const d = new Date(session.scheduledAt)
      setBookDate(formatLocalCalendarDate(d))
      const h = String(d.getHours()).padStart(2, '0')
      const m = String(d.getMinutes()).padStart(2, '0')
      setBookTime(`${h}:${m}`)
    } else {
      setBookDate(selectedScheduleDate)
      setBookTime(getUpcomingBookingTime())
    }
    setIsBookingSession(true)
  }

  const handleConfirmBookSession = async (e: FormEvent) => {
    e.preventDefault()
    if (!currentUser || bookingSaveInProgressRef.current) return
    bookingSaveInProgressRef.current = true
    setIsBookingSaving(true)
    const userId = currentUser.id

    try {
      const mission = missions.find((m) => m.id === bookMissionId)
      const sessionTitle = bookName.trim() || mission?.title || `${bookDuration}m Focus Session`
      const intention = bookIntention.trim() || mission?.title || 'Execution block'
      let scheduledAt: string | undefined
      if (bookDate) {
        scheduledAt = toLocalScheduleIso(bookDate, bookTime || '09:00') || undefined
        if (!scheduledAt) throw new Error('That date and time is not valid in your local timezone. Choose another time.')
        if (new Date(scheduledAt).getTime() < Date.now() - 60000 && bookDate === localCalendarDate()) {
          scheduledAt = new Date(Date.now() + 5 * 60000).toISOString()
        }
      }

      if (editingScheduleSession) {
        const updated = await updateFocusSession(editingScheduleSession.id, {
          name: sessionTitle,
          intention,
          durationMinutes: bookDuration,
          scheduledAt,
          missionId: bookMissionId,
          goalId: mission?.goalId ?? null,
          unlinkTask: !bookMissionId,
        })
        setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
        setEditingScheduleSession(null)
        setIsBookingSession(false)
        pushToast({
          type: 'focus',
          title: 'Session Updated',
          description: `Scheduled focus block "${updated.name}" updated successfully.`,
          timestamp: new Date().toISOString(),
        })
        await loadData()
        advanceTutorialAfterAction('SCHEDULE')
      } else {
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
        pushToast({
          type: 'focus',
          title: 'Session Scheduled',
          description: `Focus block "${created.name}" booked for ${bookDate}.`,
          timestamp: new Date().toISOString(),
        })
        await loadData()
        advanceTutorialAfterAction('SCHEDULE')
      }
    } catch (err: unknown) {
      console.error('Failed to book or edit session:', err)
      pushToast({
        title: 'Schedule Action Failed',
        description: err instanceof Error ? err.message : 'Could not save focus session.',
        type: 'focus',
        timestamp: new Date().toISOString(),
      })
    } finally {
      bookingSaveInProgressRef.current = false
      setIsBookingSaving(false)
    }
  }

  const handleStartFromSchedule = async (sessionId: number) => {
    if (!currentUser) return
    const userId = currentUser.id

    const conflict = sessions.find((s) => s.status === 'ACTIVE' || s.status === 'PAUSED')
    if (conflict) {
      pushToast({
        type: 'focus',
        title: 'Focus Session in Progress',
        description: `"${conflict.name}" is already ${conflict.status.toLowerCase()}. Please complete or cancel it first.`,
        timestamp: new Date().toISOString(),
      })
      setActiveTab('Focus Engine')
      return
    }

    try {
      const started = await startFocusSession(sessionId, userId)
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? started : s)))
      setActiveTab('Focus Engine')
      advanceTutorialAfterAction('FOCUS')
      pushToast({
        type: 'focus',
        title: 'Focus Started',
        description: `Focus session "${started.name}" started from calendar.`,
        timestamp: new Date().toISOString(),
      })
    } catch (err: unknown) {
      console.error('Failed to start session from schedule:', err)
      pushToast({
        type: 'focus',
        title: 'Start Failed',
        description: err instanceof Error ? err.message : 'Could not start focus session.',
        timestamp: new Date().toISOString(),
      })
    }
  }

  const handleCancelSession = async (sessionId: number) => {
    if (!currentUser) return
    const userId = currentUser.id
    try {
      const cancelled = await cancelFocusSession(sessionId, userId)
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? cancelled : s)))
      pushToast({
        type: 'focus',
        title: 'Session Cancelled',
        description: `Focus session "${cancelled.name}" cancelled.`,
        timestamp: new Date().toISOString(),
      })
      await loadData()
    } catch (err: unknown) {
      console.error('Failed to cancel session:', err)
      pushToast({
        type: 'focus',
        title: 'Cancel Failed',
        description: err instanceof Error ? err.message : 'Could not cancel session.',
        timestamp: new Date().toISOString(),
      })
    }
  }

  const handleCancelFromSchedule = handleCancelSession

  if (isDevGallery) {
    return <UiComponentGallery />
  }

  if (!isStartupFinished) {
    return (
      <CinematicStartup
        isReady={authRestored}
        onComplete={() => setIsStartupFinished(true)}
      />
    )
  }

  if (!currentUser) {
    return (
      <DesktopLoginView
        authMode={authMode}
        setAuthMode={setAuthMode}
        authIdentifier={authIdentifier}
        setAuthIdentifier={setAuthIdentifier}
        authPassword={authPassword}
        setAuthPassword={setAuthPassword}
        authEmail={authEmail}
        setAuthEmail={setAuthEmail}
        authRecoveryKey={authRecoveryKey}
        setAuthRecoveryKey={setAuthRecoveryKey}
        authError={authError}
        setAuthError={setAuthError}
        authLoading={authLoading}
        showAuthPassword={showAuthPassword}
        setShowAuthPassword={setShowAuthPassword}
        handleAuthSubmit={handleAuthSubmit}
        pendingRecovery={pendingRecovery}
        setPendingRecovery={setPendingRecovery}
        recoveryConfirmed={recoveryConfirmed}
        setRecoveryConfirmed={setRecoveryConfirmed}
        recoveryKeyCopied={recoveryKeyCopied}
        setRecoveryKeyCopied={setRecoveryKeyCopied}
        customServerUrlInput={customServerUrlInput}
        setCustomServerUrlInput={setCustomServerUrlInput}
        showServerConfig={showServerConfig}
        setShowServerConfig={setShowServerConfig}
        handleSaveServerUrl={handleSaveServerUrl}
        handleResetServerUrl={handleResetServerUrl}
        serverConfigSaved={serverConfigSaved}
        serverConfigError={serverConfigError}
        setCurrentUser={setCurrentUser}
        isDarkMode={isDarkMode}
        isAurora={isV2Preview}
      />
    )
  }

  const renderTabContent = () => (
    <>
      {/* Dynamic Tab Render */}
      {/* Dynamic Tab Render: Task Master 2x2 Bento Quadrant Dashboard */}
      {/* Dynamic Tab Render: SHINPO Flight Deck Dashboard */}
      {activeTab === 'Dashboard' && (
        isV2Preview ? (
          <AuroraDashboardView
            currentUser={currentUser}
            missions={missions}
            goals={goals}
            sessions={sessions}
            activeSession={activeSession}
            sentinelStatus={sentinelStatus}
            analyticsData={analyticsData}
            progress={userProgress}
            setActiveTab={handleSelectTab}
            onNavigateToTasks={handleNavigateToTasks}
            handleArmMissionAsSession={handleArmMissionAsSession}
            handleToggleMissionComplete={handleToggleMissionComplete}
            handleDeleteMission={handleDeleteMission}
            handleStartFromSchedule={handleStartFromSchedule}
            setIsCreatingQuickMission={setIsCreatingQuickMission}
            setQuickMissionGoalId={setQuickMissionGoalId}
            nextActionMission={nextActionMission}
            handleEngageNextAction={handleEngageNextAction}
            pendingWarning={pendingWarning}
            activeGraceWarning={activeGraceWarning}
            graceSecondsLeft={graceSecondsLeft}
            timerSeconds={timerSeconds}
            handlePause={handlePause}
            handleResume={handleResume}
            setCompletingSessionId={setCompletingSessionId}
            topSearchQuery={topSearchQuery}
            setTopSearchQuery={setTopSearchQuery}
            isDarkMode={isDarkMode}
            onOpenAchievements={() => handleSelectTab('Rewards')}
          />
        ) : (
          <OverviewView
            currentUser={currentUser}
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
            onNavigateToTasks={handleNavigateToTasks}
            handleArmMissionAsSession={handleArmMissionAsSession}
            handleToggleMissionComplete={handleToggleMissionComplete}
            handleDeleteMission={handleDeleteMission}
            deletingMissionId={deletingMissionId}
            handleStartFromSchedule={handleStartFromSchedule}
            setIsCreatingQuickMission={setIsCreatingQuickMission}
            setQuickMissionGoalId={setQuickMissionGoalId}
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
            onOpenAchievements={() => handleSelectTab('Rewards')}
          />
        )
      )}


      {/* Tab 2: Focus Engine */}
      {activeTab === 'Focus Engine' && (
        <FocusView
          isAurora={isV2Preview}
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
          pomodoroEnabled={pomodoroEnabled}
          setPomodoroEnabled={setPomodoroEnabled}
          pomodoroShortBreakMinutes={pomodoroShortBreakMinutes}
          pomodoroLongBreakMinutes={pomodoroLongBreakMinutes}
          setPomodoroLongBreakMinutes={setPomodoroLongBreakMinutes}
          pomodoroGraceMinutes={pomodoroGraceMinutes}
          setPomodoroGraceMinutes={setPomodoroGraceMinutes}
          latePenaltyEnabled={latePenaltyEnabled}
          setLatePenaltyEnabled={setLatePenaltyEnabled}
          latePenaltyXp={latePenaltyXp}
          setLatePenaltyXp={setLatePenaltyXp}
          latePenaltyDailyCapXp={latePenaltyDailyCapXp}
          setLatePenaltyDailyCapXp={setLatePenaltyDailyCapXp}
          guardianMode={guardianMode}
          setGuardianMode={setGuardianMode}
          guardianAppMonitoring={guardianAppMonitoring}
          setGuardianAppMonitoring={setGuardianAppMonitoring}
          onGuardianPreferencesSaved={(preferences) => {
            setSavedGuardianPreferences(preferences)
            setGuardianBackgroundRuntimeConsent(preferences.backgroundRuntimeConsent)
          }}
          backgroundRuntimeConsent={guardianBackgroundRuntimeConsent}
          setBackgroundRuntimeConsent={setGuardianBackgroundRuntimeConsent}
          guardianModeAvailable={isTauriEnvironment() && isLocalVaultSession()}
          handleReturnToFocus={handleReturnToFocus}
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
          isAurora={isV2Preview}
          goals={goals}
          missions={missions}
          sessions={sessions}
          activeSession={activeSession ?? null}
          focusStreak={analyticsData?.summary?.currentStreak ?? 0}
          handleTriggerPresetAction={handleTriggerPresetAction}
          handleClearChat={handleClearChat}
          handleStartTutorial={handleStartTutorial}
          handleArmMissionAsSession={handleArmMissionAsSession}
          handleCommitDailyPlan={handleCommitDailyPlan}
          handleCommitChatSuggestion={handleCommitChatSuggestion}
          handleRecoveryActionClick={handleRecoveryActionClick}
          handleAiSend={handleAiSend}
          requestConversationDelete={(title, confirm) => requestConfirmation({ title: 'Delete conversation', message: `Delete “${title}” and its saved messages?`, confirmLabel: 'Delete', isDestructive: true, onConfirm: confirm })}
          onConversationChange={loadActiveConversation}
          onActionExecuted={loadData}
          onOpenAiSettings={() => handleOpenSettings('eonpai')}
        />
      )}

      {/* Tab 3: Goals & Tasks */}
      {activeTab === 'Goals & Missions' && (
        <GoalsView
          key={currentUser?.id ?? 'signed-out'}
          userId={currentUser?.id ?? null}
          goals={goals}
          missions={missions}
          activeSession={activeSession}
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
            pushToast({
              title: 'Goal Required',
              description: 'Please create a goal first before adding a task.',
              type: 'focus',
              timestamp: new Date().toISOString(),
            })
            setIsCreatingGoal(true)
          }}
          openEditGoalModal={openEditGoalModal}
          openEditMissionModal={openEditMissionModal}
          missionsFilter={missionsFilter}
          setMissionsFilter={setMissionsFilter}
        />
      )}

      {/* Tab 5: Schedule View (C-002) */}
      {activeTab === 'Schedule' && (
        <ScheduleView
          sessions={sessions}
          goals={goals}
          missions={missions}
          selectedScheduleDate={selectedScheduleDate}
          setSelectedScheduleDate={setSelectedScheduleDate}
          setActiveTab={setActiveTab}
          handleOpenBookingModal={handleOpenBookingModal}
          handleStartFromSchedule={handleStartFromSchedule}
          handleCancelFromSchedule={handleCancelFromSchedule}
          handleDeleteSession={handleDeleteSession}
          handleEditSession={handleEditSessionFromSchedule}
        />
      )}

      {/* ==========================================================================
            C-027 DEVICE TASK MANAGER VIEW
            ========================================================================== */}
      {activeTab === 'Task Manager' && (
        <TaskManagerView
          isAurora={isV2Preview}
          localVaultMode={isLocalVaultSession()}
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
          tamperEvents={tamperEvents}
          setTamperEvents={setTamperEvents}
          tamperEventsExpanded={tamperEventsExpanded}
          setTamperEventsExpanded={setTamperEventsExpanded}
          tamperEventsLoading={tamperEventsLoading}
          loadDeviceProcesses={loadDeviceProcesses}
          loadSentinelTamperEvents={loadSentinelTamperEvents}
          tmToast={tmToast}
          setTmToast={setTmToast}
          onOpenCompanionSettings={() => handleOpenSettings('companion')}
          onConfigureGuardianMode={() => {
            handleSelectTab('Focus Engine')
            window.setTimeout(() => {
              const el = document.getElementById('study-mode-section')
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                el.classList.add('study-mode-highlight')
                window.setTimeout(() => el.classList.remove('study-mode-highlight'), 2200)
              }
            }, 120)
          }}
        />
      )}

      {/* ==========================================================================
            C-003 ANALYTICS TAB VIEW
            ========================================================================== */}
      {activeTab === 'Analytics' && (
        <AnalyticsView
          analyticsData={analyticsData}
          analyticsLoading={analyticsLoading}
          analyticsError={analyticsError}
          loadAnalytics={loadAnalytics}
          onNavigateFocus={() => handleSelectTab('Focus Engine')}
          userId={currentUser?.id ?? null}
        />
      )}

      {activeTab === 'Rewards' && (
        <RewardsView
          progress={userProgress}
          analytics={analyticsData}
          goals={goals}
          missions={missions}
          sessions={sessions}
          onboardingVerified={getTutorialStorageItem('shinpo_onboarding_verified', currentUser?.id) === 'true'}
          onNavigate={handleSelectTab}
        />
      )}

      {/* Tab 4: Other Views Fallback */}
      {activeTab !== 'Dashboard' &&
        activeTab !== 'Focus Engine' &&
        activeTab !== 'Goals & Missions' &&
        activeTab !== 'AI Assistant' &&
        activeTab !== 'Schedule' &&
        activeTab !== 'Task Manager' &&
        activeTab !== 'Analytics' &&
        activeTab !== 'Rewards' && (
          <div className="bento-card" style={{ padding: 48, textAlign: 'center' }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>{activeTab} Module</h2>
            <p style={{ color: 'var(--text-3)', fontSize: 14 }}>
              Switch to Overview, Goals, or Focus for available actions.
            </p>
          </div>
        )}
    </>
  )

  return (
    <>
      <div className={`shinpo-desktop-app app-shell shinpo-glass-ui ${isDarkMode ? '' : 'theme-light'} ${isV2Preview ? 'theme-aurora aurora-viewport' : ''} ${activeTab === 'Focus Engine' && (activeSession?.status === 'ACTIVE' || activeSession?.status === 'PAUSED') ? 'focus-immersed' : ''}`}>
        <ShinpoParticles />
        {isV2Preview && (
          <div className="aurora-ambient-glow" aria-hidden="true" />
        )}

        {/* Collapsible Sidebar */}
        <Sidebar
          sidebarExpanded={sidebarExpanded}
          onToggleExpanded={handleToggleSidebar}
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          scheduledCount={scheduledCount}
          shinpoMessage={shinpoMessage}
          onRefreshShinpoMessage={handleRefreshShinpoMessage}
          pendingWarning={pendingWarning}
          activeGraceWarning={activeGraceWarning}
          activeSession={activeSession}
          graceSecondsLeft={graceSecondsLeft}
          sentinelStatus={sentinelStatus}
          userProgress={userProgress}
        />

        {/* Main Content Area */}
        <main className={`app-main ${sidebarExpanded ? 'sidebar-expanded' : ''} ${activeTab === 'AI Assistant' ? 'app-main-ai' : ''}`}>
          {/* Top Bar */}
          <TopBar
            activeTab={activeTab}
            onSelectTab={handleSelectTab}
            topSearchQuery={topSearchQuery}
            onSearchChange={setTopSearchQuery}
            unreadAlertCount={unreadAlertCount}
            isAlertsDrawerOpen={isAlertsDrawerOpen}
            onToggleAlertsDrawer={handleToggleAlertsDrawer}
            isDarkMode={isDarkMode}
            onToggleTheme={handleToggleTheme}
            onRefreshData={handleRefreshWithFeedback}
            isRefreshing={isDataRefreshing}
            onOpenSettings={handleOpenSettings}
            currentUser={currentUser}
            userProgress={userProgress}
            onLogout={handleLogout}
            onToggleV2Preview={handleToggleV2Preview}
            isV2Preview={isV2Preview}
            isFocusActive={activeSession?.status === 'ACTIVE' || activeSession?.status === 'PAUSED'}
            onStartTutorial={handleStartInteractiveTutorial}
          />

          <div className={`app-content-stage${activeTab === 'AI Assistant' ? ' app-content-stage-ai' : ''}`}>
            <ErrorBoundary>
              <Suspense fallback={<div role="status" aria-busy="true" className="bento-card" style={{ margin: 20, padding: 24 }}>Loading {activeTab}…</div>}>
                {renderTabContent()}
              </Suspense>
            </ErrorBoundary>
          </div>

        </main>
      </div>

      <FloatingToasts
        toastAlerts={toastAlerts}
        onDismiss={(id) => setToastAlerts((prev) => prev.filter((item) => item.id !== id))}
      />

      {/* Real Functional Settings Modal (8 Working Areas) */}
      <SettingsModal
        key={settingsSection}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        initialSection={settingsSection}
        isDarkMode={isDarkMode}
        onToggleTheme={handleToggleTheme}
        isV2Preview={isV2Preview}
        onToggleV2Preview={handleToggleV2Preview}
        currentUser={currentUser}
        onUserUpdated={setCurrentUser}
        onLogout={handleLogout}
        sentinelStatus={sentinelStatus}
        onSentinelStatusChange={setSentinelStatus}
        isWsConnected={isWsConnected}
        onRefreshData={handleRefreshWithFeedback}
        isRefreshing={isDataRefreshing}
        goals={goals}
        missions={missions}
        sessions={sessions}
        onReplayTutorial={handleStartInteractiveTutorial}
      />

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
      {(() => {
        const completingSession = sessions.find((s) => s.id === completingSessionId)
        const completingTask = missions.find((m) => m.id === completingSession?.missionId)
        return (
          <SessionSummaryModal
            completingSessionId={completingSessionId}
            completionQuality={completionQuality}
            setCompletionQuality={setCompletionQuality}
            accomplishment={accomplishment}
            setAccomplishment={setAccomplishment}
            reflectionNotes={reflectionNotes}
            setReflectionNotes={setReflectionNotes}
            markTaskCompleted={markTaskCompleted}
            setMarkTaskCompleted={setMarkTaskCompleted}
            linkedTaskTitle={completingTask?.title}
            isSubmitting={isCompletingSession}
            errorMessage={completeSessionError}
            onCancel={() => {
              setCompletingSessionId(null)
              setCompleteSessionError(null)
            }}
            onSubmit={handleCompleteSubmit}
          />
        )
      })()}

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

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={isCreatingQuickMission}
        onClose={() => setIsCreatingQuickMission(false)}
        goals={goals}
        goalId={quickMissionGoalId}
        setGoalId={setQuickMissionGoalId}
        title={quickMissionTitle}
        setTitle={setQuickMissionTitle}
        duration={quickMissionDuration}
        setDuration={setQuickMissionDuration}
        isSubmitting={isSubmittingQuickMission}
        error={quickMissionError}
        onSubmit={handleQuickCreateMission}
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
        isEditing={Boolean(editingScheduleSession)}
        isSubmitting={isBookingSaving}
      />

      {/* Interactive Guided Tour Spotlight Overlay */}
      {isOnboardingWelcomeOpen && !isTutorialActive && !isInteractiveTutorialOpen && !hasActiveModal && (
        <OnboardingWelcome
          onStart={handleStartInteractiveTutorial}
          onExplore={handleSkipTutorial}
          onDismiss={handleDismissOnboardingWelcome}
        />
      )}
      {/* Cinematic 7-Stage Interactive Tutorial Modal */}
      <InteractiveTutorialModal
        isOpen={isInteractiveTutorialOpen}
        onClose={handleCloseInteractiveTutorial}
        onComplete={handleCompleteInteractiveTutorial}
        userId={currentUser?.id}
      />
      {isTutorialActive && SHINPO_ONBOARDING_STEPS[tutorialStepIndex] && !hasActiveModal && (
        <TutorialOverlay
          step={SHINPO_ONBOARDING_STEPS[tutorialStepIndex]}
          stepIndex={tutorialStepIndex}
          totalSteps={SHINPO_ONBOARDING_STEPS.length}
          userId={currentUser?.id}
          hasActiveModal={hasActiveModal}
          onNext={handleNextTutorialStep}
          onPrev={handlePrevTutorialStep}
          onExit={handleExitTutorial}
          onSkipTour={handleSkipTutorial}
          onNavigateTab={(tab) => {
            if (isAppView(tab)) setActiveTab(tab)
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

      {/* Universal Duolingo-Inspired Celebration Moment */}
      <CelebrationModal
        payload={celebrationPayload}
        onClose={() => setCelebrationPayload(null)}
        onNextAction={() => {
          const tab = celebrationPayload?.nextActionTab
          if (tab === 'Progression') {
            handleSelectTab('Rewards')
          } else if (tab && isAppView(tab)) {
            setActiveTab(tab)
          }
        }}
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
    </>
  )
}

export default DesktopApp
