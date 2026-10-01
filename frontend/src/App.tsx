import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  triggerSentinelSweep,
  fetchSentinelRules,
  addSentinelRule,
  deleteSentinelRule,
  updateSentinelMode,
  emergencyOverride,
  fetchSentinelTamperEvents,
} from './api/device'
import type { ProcessInfo, ProcessSnapshot, SentinelStatus, PolicyRule, SentinelTamperEventItem } from './api/device'
import { fetchAnalyticsDashboard } from './api/analytics'
import type { AnalyticsDashboardResponse, DailyFocusVelocity, RecentDebrief } from './api/analytics'
import { ShinpoLogo } from './components/ShinpoLogo'
import { TutorialOverlay } from './components/TutorialOverlay'
import { CustomCursor } from './components/CustomCursor'
import { SHINPO_ONBOARDING_STEPS } from './tutorial/tutorialSteps'

import './App.css'

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

type IconName =
  | 'dashboard'
  | 'quests'
  | 'schedule'
  | 'goals'
  | 'focus'
  | 'analytics'
  | 'apps'
  | 'journal'
  | 'rewards'
  | 'settings'
  | 'search'
  | 'bell'
  | 'moon'
  | 'sun'
  | 'chevron'
  | 'chevron-left'
  | 'chevron-right'
  | 'menu'
  | 'play'
  | 'pause'
  | 'check'
  | 'plus'
  | 'target'
  | 'clock'
  | 'xp'
  | 'close'
  | 'sparkle'
  | 'refresh'
  | 'arrow-up-right'
  | 'power'
  | 'trash'
  | 'edit'
  | 'zap'
  | 'search'
  | 'shield'
  | 'lock'

const durationPresets = [15, 30, 60, 90]

const pomodoroPlans = [
  {
    name: 'Classic Pomodoro',
    totalMinutes: 55,
    schedule: '25m Focus • 5m Rest • 25m Focus',
  },
  {
    name: 'Deep Work Sprint',
    totalMinutes: 60,
    schedule: '50m Focus • 10m Rest',
  },
  {
    name: 'Extended Flow',
    totalMinutes: 90,
    schedule: '45m Focus • 15m Rest • 30m Focus',
  },
]

function Icon({
  name,
  size = 18,
}: {
  name: IconName
  size?: number
}) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  switch (name) {
    case 'dashboard':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
      )
    case 'focus':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="3" />
          <line x1="12" y1="2" x2="12" y2="4" />
          <line x1="12" y1="20" x2="12" y2="22" />
          <line x1="2" y1="12" x2="4" y2="12" />
          <line x1="20" y1="12" x2="22" y2="12" />
        </svg>
      )
    case 'goals':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      )
    case 'quests':
      return (
        <svg {...common}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      )
    case 'schedule':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      )
    case 'analytics':
      return (
        <svg {...common}>
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      )
    case 'apps':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
        </svg>
      )
    case 'journal':
      return (
        <svg {...common}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      )
    case 'rewards':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="6" />
          <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      )
    case 'bell':
      return (
        <svg {...common}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      )
    case 'moon':
      return (
        <svg {...common}>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )
    case 'sun':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      )
    case 'chevron':
    case 'chevron-right':
      return (
        <svg {...common}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      )
    case 'chevron-left':
      return (
        <svg {...common}>
          <polyline points="15 18 9 12 15 6" />
        </svg>
      )
    case 'play':
      return (
        <svg {...common}>
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      )
    case 'pause':
      return (
        <svg {...common}>
          <rect x="6" y="4" width="4" height="16" rx="1" />
          <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
      )
    case 'check':
      return (
        <svg {...common}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )
    case 'plus':
      return (
        <svg {...common}>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      )
    case 'target':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      )
    case 'clock':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      )
    case 'xp':
    case 'zap':
      return (
        <svg {...common}>
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      )
    case 'sparkle':
      return (
        <svg {...common}>
          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
        </svg>
      )
    case 'close':
      return (
        <svg {...common}>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )
    case 'refresh':
      return (
        <svg {...common}>
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
          <path d="M16 21h5v-5" />
        </svg>
      )
    case 'arrow-up-right':
      return (
        <svg {...common}>
          <line x1="7" y1="17" x2="17" y2="7" />
          <polyline points="7 7 17 7 17 17" />
        </svg>
      )
    case 'power':
      return (
        <svg {...common}>
          <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
          <line x1="12" y1="2" x2="12" y2="12" />
        </svg>
      )
    case 'trash':
      return (
        <svg {...common}>
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      )
    case 'edit':
      return (
        <svg {...common}>
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
      )
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      )
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      )
    case 'lock':
      return (
        <svg {...common}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      )
  }
}

export function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(getStoredUser())
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN')
  const [authIdentifier, setAuthIdentifier] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)

  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
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
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const [selectedPomodoroPlan, setSelectedPomodoroPlan] = useState<string | null>(null)

  // Cursor glow tracker
  const [mousePos, setMousePos] = useState({ x: -500, y: -500 })

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
  const [chatInput, setChatInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const aiFeedRef = useRef<HTMLDivElement>(null)
  const aiContentRef = useRef<HTMLDivElement>(null)
  const autoFollowEnabledRef = useRef<boolean>(true)
  const isProgrammaticScrollRef = useRef<boolean>(false)
  const lastScrollTopRef = useRef<number>(0)
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState<boolean>(false)
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
        text: "You're all set. You now know the complete core SHINPO loop: Goal -> Mission -> Schedule -> Focus Sprint -> Sentinel Shield -> Outcome Debrief -> Analytics.",
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
  const [newGoalDate, setNewGoalDate] = useState(() =>
    new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
  )
  const [decomposingGoalId, setDecomposingGoalId] = useState<number | null>(null)
  const [aiDecompResult, setAiDecompResult] = useState<GoalDecomposition | null>(null)
  const [missionsFilter, setMissionsFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL')
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
    return new URLSearchParams(window.location.search).get('date') || new Date().toISOString().split('T')[0]
  })
  const [scheduleWeekOffset, setScheduleWeekOffset] = useState<number>(0)
  const [scheduleFilter, setScheduleFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL')
  const [isBookingSession, setIsBookingSession] = useState(() => new URLSearchParams(window.location.search).get('book') === 'true')
  const [bookMissionId, setBookMissionId] = useState<number | null>(null)
  const [bookName, setBookName] = useState('')
  const [bookIntention, setBookIntention] = useState('')
  const [bookDate, setBookDate] = useState(() => new Date().toISOString().split('T')[0])
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
  const [sentinelSweeping, setSentinelSweeping] = useState(false)
  const [showAddRuleModal, setShowAddRuleModal] = useState(false)
  const [newRulePattern, setNewRulePattern] = useState('')
  const [newRuleType, setNewRuleType] = useState<'BLOCKED' | 'ALLOWED'>('BLOCKED')
  // Sentinel Administrative Policy Gate & Tamper Resistance (Phase 3.3)
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [overridePassword, setOverridePassword] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [overrideTargetMode, setOverrideTargetMode] = useState<'CONTAINMENT' | 'AUDIT_ONLY'>('CONTAINMENT')
  const [overrideLoading, setOverrideLoading] = useState(false)
  const [overrideError, setOverrideError] = useState<string | null>(null)
  const [tamperEvents, setTamperEvents] = useState<SentinelTamperEventItem[]>([])
  const [tamperEventsExpanded, setTamperEventsExpanded] = useState(false)
  const [tamperEventsLoading, setTamperEventsLoading] = useState(false)

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
      const today = new Date().toISOString().split('T')[0]
      await createMission({
        goalId: quickMissionGoalId,
        title: quickMissionTitle.trim(),
        description: 'Tactical execution sprint',
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

  const scheduleWeekDays = useMemo(() => {
    const base = new Date()
    base.setDate(base.getDate() + scheduleWeekOffset * 7)
    const dayOfWeek = base.getDay()
    const distToMon = (dayOfWeek + 6) % 7
    const monday = new Date(base)
    monday.setDate(base.getDate() - distToMon)

    const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const todayStr = new Date().toISOString().split('T')[0]

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const dateStr = d.toISOString().split('T')[0]
      const count = sessions.filter((s) => {
        const sDate = s.scheduledAt
          ? s.scheduledAt.split('T')[0]
          : s.startedAt
          ? s.startedAt.split('T')[0]
          : s.createdAt.split('T')[0]
        return sDate === dateStr
      }).length

      return {
        dateStr,
        dayName: dayNames[i],
        dayNum: d.getDate(),
        monthName: monthNames[d.getMonth()],
        isToday: dateStr === todayStr,
        sessionCount: count,
      }
    })
  }, [scheduleWeekOffset, sessions])

  const selectedDaySessions = useMemo(() => {
    return sessions.filter((s) => {
      const sDate = s.scheduledAt
        ? s.scheduledAt.split('T')[0]
        : s.startedAt
        ? s.startedAt.split('T')[0]
        : s.createdAt.split('T')[0]
      if (sDate !== selectedScheduleDate) return false

      if (scheduleFilter === 'PENDING') {
        return s.status === 'SCHEDULED' || s.status === 'ACTIVE' || s.status === 'PAUSED'
      }
      if (scheduleFilter === 'COMPLETED') {
        return s.status === 'COMPLETED'
      }
      return true
    })
  }, [sessions, selectedScheduleDate, scheduleFilter])

  useEffect(() => {
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

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
      const [g, m, s, analytics, sentStatus, briefing] = await Promise.all([
        getGoals(),
        getMissions(),
        getFocusSessions(),
        fetchAnalyticsDashboard().catch(() => null),
        fetchSentinelStatus().catch(() => null),
        getExecutiveBriefing().catch(() => null),
      ])
      setGoals(g)
      setMissions(m)
      setSessions(s)
      if (analytics) setAnalyticsData(analytics)
      if (sentStatus) setSentinelStatus(sentStatus)
      if (briefing) setExecutiveBriefing(briefing)
    } catch {
      // Keep empty if backend offline
    }

  }, [])

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
  }, [])

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
  }, [tmSearch, tmPolicy])

  const handleSentinelSweep = async () => {
    setSentinelSweeping(true)
    try {
      const res = await triggerSentinelSweep()
      setTmToast(res.message)
      setTimeout(() => setTmToast(null), 4500)
      const st = await fetchSentinelStatus().catch(() => null)
      if (st) setSentinelStatus(st)
      void loadDeviceProcesses()
    } catch (err: unknown) {
      setTmToast(err instanceof Error ? err.message : 'Sentinel sweep failed')
      setTimeout(() => setTmToast(null), 4000)
    } finally {
      setSentinelSweeping(false)
    }
  }

  const handleToggleSentinelMode = async () => {
    if (!sentinelStatus) return
    if (sentinelStatus.isPolicyLocked) {
      setTmToast('Administrative Policy Gate Active: STRICT mode cannot be altered during an active sprint. Use Emergency Override.')
      setShowOverrideModal(true)
      setTimeout(() => setTmToast(null), 4500)
      return
    }
    const nextMode = sentinelStatus.enforcementMode === 'STRICT' ? 'AUDIT_ONLY'
      : sentinelStatus.enforcementMode === 'AUDIT_ONLY' ? 'CONTAINMENT' : 'STRICT'
    try {
      const updated = await updateSentinelMode(nextMode)
      setSentinelStatus(updated)
      setTmToast(`Sentinel enforcement mode set to: ${nextMode}`)
      setTimeout(() => setTmToast(null), 3000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update enforcement mode'
      setTmToast(msg)
      setTimeout(() => setTmToast(null), 4500)
      void loadSentinelTamperEvents()
    }
  }

  const handleAddSentinelRule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRulePattern.trim()) return
    try {
      const created = await addSentinelRule(newRulePattern.trim(), newRuleType)
      setSentinelRules((prev) => [created, ...prev.filter((r) => r.id !== created.id)])
      setNewRulePattern('')
      setShowAddRuleModal(false)
      setTmToast(`Added "${created.processNamePattern}" to Sentinel distraction blocklist`)
      setTimeout(() => setTmToast(null), 3500)
      void loadDeviceProcesses()
    } catch (err: unknown) {
      setTmToast(err instanceof Error ? err.message : 'Failed to add rule')
      setTimeout(() => setTmToast(null), 3500)
    }
  }

  const handleDeleteSentinelRule = async (ruleId: number, pattern: string) => {
    try {
      await deleteSentinelRule(ruleId)
      setSentinelRules((prev) => prev.filter((r) => r.id !== ruleId))
      setTmToast(`Removed "${pattern}" from Sentinel blocklist`)
      setTimeout(() => setTmToast(null), 3500)
      void loadDeviceProcesses()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete rule'
      setTmToast(msg)
      setTimeout(() => setTmToast(null), 4500)
      void loadSentinelTamperEvents()
    }
  }

  const handleEmergencyOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!overridePassword) {
      setOverrideError('Administrator password is required')
      return
    }
    if (overrideReason.trim().length < 15) {
      setOverrideError('Justification must be at least 15 characters to satisfy audit requirements')
      return
    }
    setOverrideLoading(true)
    setOverrideError(null)
    try {
      const res = await emergencyOverride({
        password: overridePassword,
        reason: overrideReason.trim(),
        targetMode: overrideTargetMode,
      })
      setTmToast(`🛡️ Emergency Override Approved: Enforcement set to ${res.newMode}`)
      setTimeout(() => setTmToast(null), 5000)
      setShowOverrideModal(false)
      setOverridePassword('')
      setOverrideReason('')
      const st = await fetchSentinelStatus().catch(() => null)
      if (st) setSentinelStatus(st)
      void loadDeviceProcesses()
      void loadSentinelTamperEvents()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Emergency override failed'
      setOverrideError(msg)
      void loadSentinelTamperEvents()
    } finally {
      setOverrideLoading(false)
    }
  }

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

  const handleTerminateProcess = async (proc: ProcessInfo) => {
    if (!window.confirm(`Are you sure you want to terminate process "${proc.name}" (PID ${proc.pid})?`)) return
    try {
      const res = await terminateProcess(proc.pid, true)
      if (res.status === 'SUCCESS' || res.status === 'FORCE_KILL') {
        setTmToast(`Process ${proc.name} (PID ${proc.pid}) terminated`)
        setTmRefreshKey((key) => key + 1)
      } else {
        setTmToast(`Notice: ${res.message}`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Termination failed'
      setTmToast(`Error: ${msg}`)
    }
    setTimeout(() => setTmToast(null), 4000)
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

  const handleLogout = async () => {
    await logout()
    setCurrentUser(null)
    setDashboard(null)
    setSessions([])
    setGoals([])
    setMissions([])
  }

  const handleQuickDemoFill = () => {
    setAuthMode('LOGIN')
    setAuthIdentifier('EONX')
    setAuthPassword('shinpo_dev')
  }

  const handleCreateGoal = async (e: FormEvent) => {
    e.preventDefault()
    if (!newGoalTitle.trim()) return
    try {
      const created = await createGoal({
        userId: dashboard?.user.id ?? 1,
        title: newGoalTitle.trim(),
        description: newGoalDesc.trim() || undefined,
        startDate: new Date().toISOString().split('T')[0],
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
      alert('Could not update goal. Please try again.')
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
      console.error('Failed to update mission', err)
      alert('Could not update mission. Please try again.')
    }
  }

  const handleDeconstructGoal = async (goalId: number) => {
    setDecomposingGoalId(goalId)
    try {
      const result = await decomposeGoal(goalId, dashboard?.user.id ?? 1)
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
        const today = new Date().toISOString().split('T')[0]
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

  const handleDeleteGoal = async (goalId: number, goalTitle: string) => {
    if (!window.confirm(`Delete goal "${goalTitle}"?\n\nAll linked tactical missions will also be permanently removed.`)) {
      return
    }
    try {
      await deleteGoal(goalId)
      setGoals((prev) => prev.filter((g) => g.id !== goalId))
      setMissions((prev) => prev.filter((m) => m.goalId !== goalId))
      loadData()
    } catch (err) {
      console.error('Failed to delete goal:', err)
      alert('Could not delete goal. Please check server logs.')
    }
  }

  const handleDeleteMission = async (missionId: number, missionTitle: string) => {
    if (deletingMissionId === missionId) return
    if (!window.confirm(`Delete task "${missionTitle}"?\n\nThis will remove it from your tactical execution queue.`)) {
      return
    }
    try {
      setDeletingMissionId(missionId)
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
        console.error('Failed to delete task:', err)
        alert(`Could not delete task: ${err instanceof Error ? err.message : 'Server error'}`)
      }
    } finally {
      setDeletingMissionId(null)
    }
  }


  const handleDeleteSession = async (sessionId: number) => {
    if (!window.confirm(`Delete focus session #${sessionId}?`)) {
      return
    }
    try {
      await deleteFocusSession(sessionId, dashboard?.user.id ?? 1)
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
    } catch (err) {
      console.error('Failed to delete focus session:', err)
      alert('Could not delete focus session.')
    }
  }

  // Timer ticker
  const [timerNow, setTimerNow] = useState(() => Date.now())
  useEffect(() => {
    const interval = setInterval(() => setTimerNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const activeSession = useMemo(() => {
    return sessions.find(
      (s) => s.status === 'ACTIVE' || s.status === 'PAUSED',
    )
  }, [sessions])

  const timerSeconds = useMemo(() => {
    if (!activeSession) return selectedDuration * 60
    const totalSec = (activeSession.durationMinutes || 25) * 60
    if (activeSession.status === 'ACTIVE' && activeSession.startedAt) {
      const elapsed = Math.floor(
        (timerNow - new Date(activeSession.startedAt).getTime()) / 1000,
      )
      return Math.max(0, totalSec - elapsed)
    }
    return totalSec
  }, [activeSession, timerNow, selectedDuration])

  const formatTimerDigits = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const handleStartSession = async () => {
    const userId = dashboard?.user.id ?? 1
    try {
      const created = await createFocusSession({
        userId,
        name: selectedPomodoroPlan ?? `${selectedDuration}m Focus Sprint`,
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
    if (!nextActionMission) return
    const userId = dashboard?.user.id ?? 1
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
    if (sessions.some((session) => session.status === 'ACTIVE' || session.status === 'PAUSED')) {
      setActiveTab('Focus Engine')
      return
    }
    const userId = dashboard?.user.id ?? 1
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
    const userId = dashboard?.user.id ?? 1
    try {
      const p = await pauseFocusSession(id, userId)
      setSessions((prev) => prev.map((s) => (s.id === id ? p : s)))
    } catch (e) {
      console.error(e)
    }
  }

  const handleResume = async (id: number) => {
    const userId = dashboard?.user.id ?? 1
    try {
      const r = await resumeFocusSession(id, userId)
      setSessions((prev) => prev.map((s) => (s.id === id ? r : s)))
    } catch (e) {
      console.error(e)
    }
  }

  const handleCompleteSubmit = async (e: FormEvent, debriefWithAi: boolean = false) => {
    e.preventDefault()
    if (!completingSessionId) return
    const targetSessionId = completingSessionId
    const userId = dashboard?.user.id ?? 1
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
      const sprintTitle = '15m Micro-Sprint: ' + (activeRunning?.name || 'Momentum Recovery')
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
    const prompt = messageText || chatInput
    if (!prompt.trim()) return

    // Immediately enable bottom auto-follow and hide button
    autoFollowEnabledRef.current = true
    setShowScrollBottomBtn(false)

    setChatMessages((prev) => [...prev, { role: 'user', text: prompt }])
    if (!messageText) setChatInput('')
    setAiLoading(true)

    // Immediate pin to bottom
    if (aiFeedRef.current) {
      aiFeedRef.current.scrollTop = aiFeedRef.current.scrollHeight
    }

    try {
      const userId = dashboard?.user.id ?? 1
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
        if (autoFollowEnabledRef.current && aiFeedRef.current) {
          aiFeedRef.current.scrollTop = aiFeedRef.current.scrollHeight
          lastScrollTopRef.current = aiFeedRef.current.scrollTop
        }
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

              if (autoFollowEnabledRef.current && aiFeedRef.current) {
                aiFeedRef.current.scrollTop = aiFeedRef.current.scrollHeight
                lastScrollTopRef.current = aiFeedRef.current.scrollTop
              }
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
              if (autoFollowEnabledRef.current && aiFeedRef.current) {
                aiFeedRef.current.scrollTop = aiFeedRef.current.scrollHeight
                lastScrollTopRef.current = aiFeedRef.current.scrollTop
              }
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
      if (autoFollowEnabledRef.current && aiFeedRef.current) {
        aiFeedRef.current.scrollTop = aiFeedRef.current.scrollHeight
        lastScrollTopRef.current = aiFeedRef.current.scrollTop
      }
    }
  }

  // Auto-follow via ResizeObserver on the messages content wrapper
  useEffect(() => {
    if (activeTab !== 'AI Assistant') return

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

    return () => {
      observer.disconnect()
    }
  }, [activeTab])

  // Direct auto-follow sync whenever chat messages or loading state changes
  useEffect(() => {
    if (activeTab === 'AI Assistant' && autoFollowEnabledRef.current && aiFeedRef.current) {
      aiFeedRef.current.scrollTop = aiFeedRef.current.scrollHeight
      lastScrollTopRef.current = aiFeedRef.current.scrollTop
    }
  }, [chatMessages, aiLoading, activeTab])

  // Auto-follow when navigating to AI Assistant tab
  useEffect(() => {
    if (activeTab === 'AI Assistant') {
      autoFollowEnabledRef.current = true
      const timer = setTimeout(() => {
        setShowScrollBottomBtn(false)
        if (aiFeedRef.current) {
          aiFeedRef.current.scrollTop = aiFeedRef.current.scrollHeight
          lastScrollTopRef.current = aiFeedRef.current.scrollTop
        }
      }, 60)
      return () => clearTimeout(timer)
    }
  }, [activeTab])

  const handleChatScroll = () => {
    const feedEl = aiFeedRef.current
    if (!feedEl) return

    const { scrollTop, scrollHeight, clientHeight } = feedEl
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight

    if (isProgrammaticScrollRef.current) {
      if (distanceFromBottom <= 30) {
        isProgrammaticScrollRef.current = false
        autoFollowEnabledRef.current = true
        setShowScrollBottomBtn(false)
      }
      lastScrollTopRef.current = scrollTop
      return
    }

    // Threshold of 60px per ChatGPT-style specification
    if (distanceFromBottom <= 60) {
      autoFollowEnabledRef.current = true
      setShowScrollBottomBtn(false)
    } else {
      // Away from bottom
      setShowScrollBottomBtn(true)
      // If user deliberately scrolled UP (scrollTop decreased), pause auto-follow
      if (scrollTop < lastScrollTopRef.current - 4) {
        autoFollowEnabledRef.current = false
      }
    }

    lastScrollTopRef.current = scrollTop
  }

  const handleScrollToBottom = () => {
    const feedEl = aiFeedRef.current
    if (!feedEl) return

    isProgrammaticScrollRef.current = true
    autoFollowEnabledRef.current = true
    setShowScrollBottomBtn(false)

    feedEl.scrollTo({
      top: feedEl.scrollHeight,
      behavior: 'smooth',
    })

    setTimeout(() => {
      isProgrammaticScrollRef.current = false
      if (feedEl) {
        feedEl.scrollTop = feedEl.scrollHeight
        lastScrollTopRef.current = feedEl.scrollTop
        const dist = feedEl.scrollHeight - feedEl.scrollTop - feedEl.clientHeight
        if (dist <= 60) {
          autoFollowEnabledRef.current = true
          setShowScrollBottomBtn(false)
        }
      }
    }, 450)
  }

  const handleTriggerPresetAction = (promptText: string) => {
    setActiveTab('AI Assistant')
    autoFollowEnabledRef.current = true
    setShowScrollBottomBtn(false)
    handleAiSend(promptText)
    if (aiFeedRef.current) {
      aiFeedRef.current.scrollTop = aiFeedRef.current.scrollHeight
      lastScrollTopRef.current = aiFeedRef.current.scrollTop
    }
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
    const userId = currentUser?.id ?? 1
    const mission = missions.find((m) => m.id === bookMissionId)
    const sessionTitle = bookName.trim() || mission?.title || `${bookDuration}m Focus Sprint`
    const intention = bookIntention.trim() || mission?.title || 'Execution block'

    let scheduledAt: string | undefined = undefined
    if (bookDate) {
      const timePart = bookTime ? (bookTime.length === 5 ? `${bookTime}:00` : bookTime) : '09:00:00'
      scheduledAt = new Date(`${bookDate}T${timePart}Z`).toISOString()
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
      alert('Could not schedule focus session. Check server logs.')
    }
  }

  const handleStartFromSchedule = async (sessionId: number) => {
    const userId = currentUser?.id ?? 1
    try {
      const started = await startFocusSession(sessionId, userId)
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? started : s)))
      setActiveTab('Focus Engine')
    } catch (err) {
      console.error('Failed to start session from schedule:', err)
    }
  }

  const handleCancelFromSchedule = async (sessionId: number) => {
    const userId = currentUser?.id ?? 1
    try {
      const cancelled = await cancelFocusSession(sessionId, userId)
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? cancelled : s)))
      loadData()
    } catch (err) {
      console.error('Failed to cancel session:', err)
    }
  }

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
                placeholder={authMode === 'LOGIN' ? 'eonx / user@shinpo.local' : 'e.g. Commander'}
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
                  placeholder="operator@shinpo.local"
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
      {/* Ambient cursor glow */}
      <div
        className="ambient-cursor-glow"
        style={{ left: `${mousePos.x}px`, top: `${mousePos.y}px` }}
      />

      {/* Collapsible Sidebar */}
      <aside className={`icon-sidebar ${sidebarExpanded ? 'expanded' : ''}`}>
        <div className="sidebar-header">
          <div
            className="brand-badge"
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            title={sidebarExpanded ? 'Collapse Sidebar' : 'Expand Sidebar'}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <ShinpoLogo
              size={sidebarExpanded ? 28 : 34}
              variant={sidebarExpanded ? 'full' : 'icon'}
            />
          </div>
          <button
            className="sidebar-toggle-btn"
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            title={sidebarExpanded ? 'Collapse Sidebar' : 'Expand Sidebar'}
            data-tooltip={sidebarExpanded ? 'Collapse' : 'Expand'}
          >
            <Icon name={sidebarExpanded ? 'chevron-left' : 'chevron-right'} size={15} />
          </button>
        </div>

        {sidebarExpanded && (
          <div className="sidebar-hero-greeting">
            <span className="sidebar-hero-line">Start Your</span>
            <span className="sidebar-hero-line">Day Be</span>
            <span className="sidebar-hero-line highlight">Productive</span>
          </div>
        )}

        <nav className="sidebar-nav-stack">
          {sidebarExpanded && (
            <div className="sidebar-section-header">
              <span>Menu</span>
            </div>
          )}
          {[
            { id: 'Dashboard', icon: 'dashboard' as IconName, label: 'Dashboard', tut: 'nav-dashboard' },
            { id: 'Goals & Missions', icon: 'goals' as IconName, label: 'Goals', tut: 'nav-goals' },
            { id: 'Focus Engine', icon: 'focus' as IconName, label: 'Focus', tut: 'nav-focus' },
                    { id: 'Schedule', icon: 'schedule' as IconName, label: 'Calendar', badge: scheduledCount > 0 ? `+${scheduledCount}` : undefined, tut: 'nav-schedule' },
            { id: 'Analytics', icon: 'analytics' as IconName, label: 'Analytics', tut: 'nav-analytics' },
            { id: 'Task Manager', icon: 'apps' as IconName, label: 'Task Manager', badge: 'Live', tut: 'nav-tasks' },
            { id: 'AI Assistant', icon: 'sparkle' as IconName, label: 'EONPAI', badge: 'AI', tut: 'nav-ai' },
          ].map((item) => (
            <button
              key={item.id}
              className={`sidebar-btn ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
              title={item.label}
              data-tooltip={item.label}
              data-tutorial={item.tut}
            >
              <Icon name={item.icon} size={18} />
              {sidebarExpanded && <span>{item.label}</span>}
              {sidebarExpanded && item.badge && (
                <span className={`sidebar-nav-badge ${item.badge === 'Live' ? 'live' : item.badge === 'AI' ? 'ai' : ''}`}>
                  {item.badge}
                </span>
              )}
              {sidebarExpanded && activeTab === item.id && (
                <span className="sidebar-active-arrow">↗</span>
              )}
            </button>
          ))}
        </nav>

        {sidebarExpanded && (
          <>
            {/* EONPAI Tactical Companion Card */}
            <div className="sidebar-eonpai-companion">
              <div className="eonpai-comp-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="eonpai-comp-name">EONPAI</span>
                  <span className="eonpai-online-dot" />
                </div>
                <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>TACTICAL</span>
              </div>
              <div className="eonpai-bubble-row">
                <div className="eonpai-speech-bubble bubble-short">
                  <span>Ready to focus</span>
                </div>
                <span className="bubble-time-ext">12.49</span>
              </div>
              <div className="eonpai-bubble-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <div className="eonpai-speech-bubble bubble-wide">
                  <span>
                    {missions.length > 0
                      ? `Today we will move on to "${missions[0].title.slice(0, 24)}..."`
                      : "Today we will establish your primary execution objectives."}
                  </span>
                </div>
                <span className="bubble-time-ext" style={{ alignSelf: 'flex-end', marginTop: 2 }}>12.50</span>
              </div>
              <button
                className="eonpai-comp-action-btn"
                onClick={() => {
                  if (missions.length > 0 && !activeSession) {
                    handleArmMissionAsSession(missions[0].title, missions[0].estimatedMinutes || 25)
                  } else {
                    setActiveTab('AI Assistant')
                  }
                }}
              >
                {activeSession ? 'Inspect Sprint' : missions.length > 0 ? 'Ok EONPAI' : 'Ask EONPAI'}
              </button>
            </div>
          </>
        )}

        <div className="sidebar-footer">
          <div
            className="sidebar-status-quiet"
            title={activeSession ? 'Sentinel Shield Locked: Distraction apps blocked' : 'Sentinel Shield Armed & Monitoring'}
          >
            <span className={`status-dot-active ${activeSession ? 'focus-engaged' : ''}`} />
            {sidebarExpanded && (
              <div className="status-quiet-text">
                <span className="status-quiet-title">Sentinel {activeSession ? 'Shielded' : 'Armed'}</span>
                <span className="status-quiet-sub">{activeSession ? 'Processes locked' : 'Execution ready'}</span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={`app-main ${sidebarExpanded ? 'sidebar-expanded' : ''}`}>
        {/* Top Bar — Reference-Inspired Glass & Opaque Header */}
        <div className="cockpit-top-bar">
          <div className="page-header-info">
            <h1 className="top-brand-title">
              {activeTab === 'AI Assistant'
                ? 'EONPAI'
                : activeTab === 'Focus Engine'
                ? 'Focus'
                : activeTab === 'Goals & Missions'
                ? 'Goals & Missions'
                : activeTab === 'Schedule'
                ? 'Calendar'
                : activeTab}
            </h1>
          </div>

          {/* Pill Search Input */}
          <div className="top-search-command">
            <Icon name="search" size={16} />
            <input
              type="text"
              className="top-search-input"
              placeholder="Start Searching Here..."
              value={topSearchQuery}
              onChange={(e) => setTopSearchQuery(e.target.value)}
            />
            <button className="top-search-filter-btn" title="Filter & Focus">
              <Icon name="sparkle" size={14} />
            </button>
          </div>

          <div className="top-bar-actions">
            <button className="action-btn-circle has-badge" title="Notifications">
              <Icon name="bell" size={16} />
              <span className="bell-red-dot" />
            </button>
            <button
              className="action-btn-circle"
              onClick={() => setIsDarkMode(!isDarkMode)}
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              <Icon name={isDarkMode ? 'sun' : 'moon'} size={16} />
            </button>
            <button className="action-btn-circle" onClick={loadData} title="Telemetry Sync">
              <Icon name="settings" size={16} />
            </button>
            <div className="profile-badge-card" title={`Signed in as ${currentUser.username} (${currentUser.email})`}>
              <div className="profile-avatar-circle">
                {currentUser.username.charAt(0).toUpperCase()}
              </div>
              <div className="profile-text-wrap">
                <span className="profile-username">{currentUser.username}</span>
                <span className="profile-role">Execution Lead</span>
              </div>
            </div>
            <button
              className="action-btn-circle"
              onClick={handleLogout}
              title="Terminate Session (Sign Out)"
            >
              <Icon name="power" size={14} />
            </button>
          </div>
        </div>

        {/* Dynamic Tab Render */}
        {/* Dynamic Tab Render: Task Master 2x2 Bento Quadrant Dashboard */}
        {/* Dynamic Tab Render: SHINPO Flight Deck Dashboard */}
        {activeTab === 'Dashboard' && (() => {
          const totalMissionsCount = missions.length
          const completedMissionsCount = missions.filter((m) => m.status === 'COMPLETED').length
          const velocityRate = totalMissionsCount > 0
            ? Math.round((completedMissionsCount / totalMissionsCount) * 100)
            : (analyticsData?.summary?.completionRate ? Math.round(analyticsData.summary.completionRate) : 0)

          const gaugeCircumference = 235.62
          const gaugeOffset = gaugeCircumference * (1 - Math.min(100, Math.max(0, velocityRate)) / 100)

          const q = topSearchQuery.trim().toLowerCase()
          const searchFilter = (m: Mission) => {
            if (!q) return true
            return m.title.toLowerCase().includes(q) || (m.description && m.description.toLowerCase().includes(q))
          }

          const inProgM = missions.filter((m) => {
            if (!searchFilter(m)) return false
            if (activeSession) {
              const matchesActive =
                m.title.toLowerCase() === activeSession.name.toLowerCase() ||
                (activeSession.intention && m.title.toLowerCase() === activeSession.intention.toLowerCase())
              if (matchesActive) return true
            }
            return m.status === 'IN_PROGRESS'
          })

          const compM = missions.filter((m) => m.status === 'COMPLETED' && searchFilter(m))
          const inProgIds = new Set(inProgM.map((m) => m.id))
          const pendM = missions.filter((m) => m.status !== 'COMPLETED' && !inProgIds.has(m.id) && searchFilter(m))

          const displayInProgress = inProgM.length > 0 ? inProgM : (activeSession && pendM.length > 0 ? [pendM[0]] : [])
          const displayPending = displayInProgress.length > 0 && pendM.length > 0 && displayInProgress[0].id === pendM[0].id
            ? pendM.slice(1)
            : pendM

          const recentDebriefsList = analyticsData?.recentDebriefs && analyticsData.recentDebriefs.length > 0
            ? analyticsData.recentDebriefs
            : []

          const renderFlightDeckCard = (task: Mission) => {
            const parentGoal = goals.find((g) => g.id === task.goalId)
            const isDone = task.status === 'COMPLETED'
            const isActive = activeSession && (
              task.title.toLowerCase() === activeSession.name.toLowerCase() ||
              (activeSession.intention && task.title.toLowerCase() === activeSession.intention.toLowerCase())
            )
            const hasOpenMenu = activeTaskMenu?.task.id === task.id

            return (
              <div
                key={task.id}
                className={`flight-deck-card ${isActive ? 'is-active-sprint' : ''} ${hasOpenMenu ? 'has-open-menu' : ''}`}
                onClick={() => {
                  if (hasOpenMenu) {
                    setActiveTaskMenu(null)
                    return
                  }
                  setInspectingMission(task)
                }}
                title="Click to inspect mission details"
              >
                <div className="card-top-row">
                  <h3 className={`card-title ${isDone ? 'completed-title' : ''}`}>
                    {task.title}
                  </h3>
                  <div className="card-menu-container" onClick={(e) => e.stopPropagation()}>
                    <button
                      className={`card-menu-btn ${hasOpenMenu ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        const rect = e.currentTarget.getBoundingClientRect()
                        setActiveTaskMenu((prev) => (prev?.task.id === task.id ? null : { task, rect }))
                      }}
                      title="Task actions"
                      aria-label="Task actions"
                      aria-expanded={hasOpenMenu}
                    >
                      ···
                    </button>
                  </div>
                </div>

                <div className="card-context-row">
                  {parentGoal ? (
                    <span className="card-goal-tag">🎯 {parentGoal.title}</span>
                  ) : (
                    <span className="card-goal-tag">⚡ Strategic Mission</span>
                  )}
                </div>

                <div className="card-meta-row">
                  <div className="card-meta-left">
                    <span className="card-duration-chip">
                      <Icon name="clock" size={11} />
                      <span>{task.estimatedMinutes || 25}m</span>
                    </span>
                    <span className="card-priority-chip">
                      {isDone ? '✓ Completed' : isActive ? '⚡ In Sprint' : 'High Priority'}
                    </span>
                  </div>

                  {!isDone && (
                    <button
                      className="card-quick-arm-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleArmMissionAsSession(task.title, task.estimatedMinutes || undefined)
                      }}
                      title="Arm Focus Sprint"
                    >
                      <Icon name="play" size={11} />
                      <span>Focus</span>
                    </button>
                  )}
                </div>
              </div>
            )
          }

          return (
            <div className="shinpo-flight-deck">
              {/* Task Actions Floating Portal Menu - Completely immune to overflow/scroll clipping */}
              {activeTaskMenu && typeof document !== 'undefined' && createPortal(
                (() => {
                  const { task, rect } = activeTaskMenu
                  const isDone = task.status === 'COMPLETED'
                  const menuWidth = 175
                  const menuHeight = 160
                  const spaceBelow = window.innerHeight - rect.bottom
                  const openUp = spaceBelow < menuHeight + 12

                  const top = openUp ? Math.max(10, rect.top - menuHeight - 6) : rect.bottom + 6
                  const left = Math.max(10, Math.min(window.innerWidth - menuWidth - 16, rect.right - menuWidth))

                  return (
                    <>
                      <div
                        className="card-menu-backdrop-overlay"
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveTaskMenu(null)
                        }}
                      />
                      <div
                        className={`flight-deck-card-menu portal-menu ${openUp ? 'menu-open-up' : 'menu-open-down'}`}
                        style={{
                          position: 'fixed',
                          top: `${top}px`,
                          left: `${left}px`,
                          width: `${menuWidth}px`,
                          right: 'auto',
                          zIndex: 9999,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          className="card-menu-item"
                          onClick={() => {
                            setActiveTaskMenu(null)
                            setInspectingMission(task)
                          }}
                        >
                          <Icon name="sparkle" size={13} />
                          <span>Inspect Details</span>
                        </button>
                        {!isDone && (
                          <button
                            className="card-menu-item"
                            onClick={() => {
                              setActiveTaskMenu(null)
                              handleArmMissionAsSession(task.title, task.estimatedMinutes || undefined)
                            }}
                          >
                            <Icon name="play" size={13} />
                            <span>Start Focus</span>
                          </button>
                        )}
                        {!isDone && (
                          <button
                            className="card-menu-item"
                            onClick={() => {
                              setActiveTaskMenu(null)
                              handleToggleMissionComplete(task.id)
                            }}
                          >
                            <Icon name="check" size={13} />
                            <span>Mark Done</span>
                          </button>
                        )}
                        <div className="card-menu-divider" />
                        <button
                          className="card-menu-item action-delete"
                          onClick={() => {
                            setActiveTaskMenu(null)
                            handleDeleteMission(task.id, task.title)
                          }}
                          disabled={deletingMissionId === task.id}
                        >
                          <Icon name="trash" size={13} />
                          <span>{deletingMissionId === task.id ? 'Deleting...' : 'Delete Task'}</span>
                        </button>
                      </div>
                    </>
                  )
                })(),
                document.body
              )}

              {/* AI.9: Executive Command Briefing Card */}
              {executiveBriefing && (
                <section
                  className="executive-briefing-banner"
                  aria-label="Executive Intelligence Briefing"
                  style={{
                    marginBottom: 20,
                    padding: '18px 24px',
                    borderRadius: 'var(--radius-lg, 16px)',
                    background: 'linear-gradient(135deg, rgba(255, 77, 94, 0.08) 0%, rgba(20, 22, 28, 0.95) 100%)',
                    border: '1px solid rgba(255, 77, 94, 0.22)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 8,
                          background: 'linear-gradient(135deg, var(--accent-coral, #FF4D5E), #D92B3E)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          boxShadow: '0 0 16px rgba(255, 77, 94, 0.35)',
                        }}
                      >
                        <Icon name="sparkle" size={18} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1, #fff)' }}>
                            {executiveBriefing.executiveHeadline}
                          </span>
                          <span
                            className={`badge-tag ${
                              executiveBriefing.sentinelThreatPosture === 'SECURE'
                                ? 'green'
                                : executiveBriefing.sentinelThreatPosture === 'CONTAINED'
                                ? 'blue'
                                : 'coral'
                            }`}
                            style={{ fontSize: 11, padding: '2px 8px', fontWeight: 700 }}
                          >
                            SHIELD: {executiveBriefing.sentinelThreatPosture}
                          </span>
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--text-3, #8E929E)' }}>
                          EONPAI Executive Briefing • Generated {new Date(executiveBriefing.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        className="btn-timer secondary"
                        style={{ padding: '6px 12px', fontSize: 12 }}
                        onClick={refreshBriefing}
                        disabled={briefingLoading}
                        title="Re-synthesize Executive Briefing"
                      >
                        <Icon name="refresh" size={12} />
                        <span>{briefingLoading ? 'Synthesizing...' : 'Re-synthesize'}</span>
                      </button>
                      <button
                        className="sidebar-toggle-btn"
                        onClick={() => setIsBriefingExpanded((prev) => !prev)}
                        title={isBriefingExpanded ? 'Collapse Briefing' : 'Expand Briefing'}
                      >
                        <Icon name={isBriefingExpanded ? 'chevron' : 'chevron-right'} size={14} />
                      </button>
                    </div>
                  </div>

                  {isBriefingExpanded && (
                    <div style={{ marginTop: 14 }}>
                      <p style={{ fontSize: 14, color: 'var(--text-2, #C5C8D4)', lineHeight: 1.55, margin: '0 0 14px' }}>
                        {executiveBriefing.tacticalSummary}
                      </p>

                      {/* Executive Vital Metrics */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                          gap: 10,
                          marginBottom: 16,
                        }}
                      >
                        <div
                          style={{
                            padding: '10px 14px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: 10,
                          }}
                        >
                          <div style={{ fontSize: 11, color: 'var(--text-3, #8E929E)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Active Goals
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1, #fff)', marginTop: 2 }}>
                            {executiveBriefing.activeGoalsCount}
                          </div>
                        </div>

                        <div
                          style={{
                            padding: '10px 14px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: 10,
                          }}
                        >
                          <div style={{ fontSize: 11, color: 'var(--text-3, #8E929E)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Queued Missions
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#38bdf8', marginTop: 2 }}>
                            {executiveBriefing.pendingMissionsCount}
                          </div>
                        </div>

                        <div
                          style={{
                            padding: '10px 14px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: 10,
                          }}
                        >
                          <div style={{ fontSize: 11, color: 'var(--text-3, #8E929E)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Focus Logged
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#4ade80', marginTop: 2 }}>
                            {executiveBriefing.focusMinutesToday}m
                          </div>
                        </div>

                        <div
                          style={{
                            padding: '10px 14px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: 10,
                          }}
                        >
                          <div style={{ fontSize: 11, color: 'var(--text-3, #8E929E)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Goal Velocity
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#a78bfa', marginTop: 2 }}>
                            {executiveBriefing.goalProgressAveragePct}%
                          </div>
                        </div>

                        <div
                          style={{
                            padding: '10px 14px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: 10,
                          }}
                        >
                          <div style={{ fontSize: 11, color: 'var(--text-3, #8E929E)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Interceptions
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: executiveBriefing.quarantinedDistractionsToday > 0 ? '#fb7185' : 'var(--text-2, #C5C8D4)', marginTop: 2 }}>
                            {executiveBriefing.quarantinedDistractionsToday}
                          </div>
                        </div>
                      </div>

                      {/* Primary Recommendation Banner */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          background: 'rgba(255, 77, 94, 0.06)',
                          border: '1px solid rgba(255, 77, 94, 0.16)',
                          borderRadius: 10,
                          marginBottom: 14,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Icon name="target" size={16} />
                          <span style={{ fontSize: 13, color: 'var(--text-1, #fff)' }}>
                            <strong style={{ color: 'var(--accent-coral, #FF4D5E)' }}>Priority Action:</strong> {executiveBriefing.primaryRecommendation}
                          </span>
                        </div>
                        <button
                          className="btn-timer primary"
                          style={{ padding: '6px 14px', fontSize: 12 }}
                          onClick={() => {
                            if (executiveBriefing.pendingMissionsCount > 0) {
                              setActiveTab('Focus Engine')
                            } else {
                              setActiveTab('Goals & Missions')
                            }
                          }}
                        >
                          <Icon name="play" size={12} />
                          <span>Engage</span>
                        </button>
                      </div>

                      {/* Key Action Items */}
                      {executiveBriefing.keyActionItems.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {executiveBriefing.keyActionItems.map((item, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                fontSize: 12,
                                color: 'var(--text-3, #8E929E)',
                              }}
                            >
                              <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent-coral, #FF4D5E)' }} />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}

              {/* Top Tier: Multi-Column Kanban Work Board */}
              <section className="flight-deck-board-panel" aria-label="Flight Deck Work Board">
                <div className="board-panel-header">
                  <div className="board-header-left">
                    <h2 className="board-panel-title">All Tasks</h2>
                    <div className="board-status-summary">
                      <span className="summary-pill active">
                        {displayInProgress.length + displayPending.length} in progress & ready
                      </span>
                      <span className="summary-pill completed">
                        {compM.length} completed
                      </span>
                      {sentinelStatus && (
                        <span
                          className={`summary-pill sentinel-pill ${sentinelStatus.status === 'ACTIVE_DEFENSE' ? 'active-defense' : 'standby'}`}
                          title={`Sentinel Shield Mode: ${sentinelStatus.enforcementMode} • ${sentinelStatus.totalInterceptedToday} intercepted today. Click to manage Sentinel.`}
                          onClick={() => setActiveTab('Task Manager')}
                          style={{ cursor: 'pointer' }}
                        >
                          <span className="sentinel-mini-dot" />
                          <span>Sentinel: {sentinelStatus.status.replace('_', ' ')}</span>
                          {sentinelStatus.totalInterceptedToday > 0 && (
                            <span className="sentinel-interception-badge">
                              {sentinelStatus.totalInterceptedToday}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="board-header-actions">
                    {topSearchQuery && (
                      <div className="board-filter-indicator">
                        <span>Filtering: "{topSearchQuery}"</span>
                        <button onClick={() => setTopSearchQuery('')} title="Clear filter">×</button>
                      </div>
                    )}
                    <button
                      className="board-action-btn primary"
                      onClick={() => {
                        if (goals.length > 0) {
                          setQuickMissionGoalId(goals[0].id)
                          setQuickMissionError(null)
                          setIsCreatingQuickMission(true)
                        } else {
                          setActiveTab('Goals & Missions')
                        }
                      }}
                      title="Add a new mission"
                    >
                      <Icon name="plus" size={13} />
                      <span>Add Task</span>
                    </button>
                  </div>
                </div>

                <div className="flight-deck-board-grid">
                  {/* Column 1: IN PROGRESS */}
                  <div className="status-column col-in-progress">
                    <div className="status-column-header">
                      <div className="column-header-title">
                        <span className="column-status-dot dot-coral" />
                        <span className="column-title-text">IN PROGRESS</span>
                      </div>
                      <span className="column-count-badge">{displayInProgress.length}</span>
                    </div>

                    <div className="status-column-cards">
                      {displayInProgress.length > 0 ? (
                        displayInProgress.map((t) => renderFlightDeckCard(t))
                      ) : (
                        <div className="status-column-empty">
                          <span>No task currently running</span>
                          {displayPending.length > 0 && (
                            <button
                              className="empty-action-link"
                              onClick={() => handleArmMissionAsSession(displayPending[0].title, displayPending[0].estimatedMinutes || 25)}
                            >
                              ⚡ Start Next Focus Sprint
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Column 2: READY FOR SPRINT */}
                  <div className="status-column col-backlog">
                    <div className="status-column-header">
                      <div className="column-header-title">
                        <span className="column-status-dot dot-cyan" />
                        <span className="column-title-text">READY FOR SPRINT</span>
                      </div>
                      <span className="column-count-badge">{displayPending.length}</span>
                    </div>

                    <div className="status-column-cards">
                      {displayPending.length > 0 ? (
                        displayPending.map((t) => renderFlightDeckCard(t))
                      ) : (
                        <div className="status-column-empty">
                          <span>Sprint queue clear</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Column 3: COMPLETED */}
                  <div className="status-column col-completed">
                    <div className="status-column-header">
                      <div className="column-header-title">
                        <span className="column-status-dot dot-emerald" />
                        <span className="column-title-text">COMPLETED</span>
                      </div>
                      <span className="column-count-badge">{compM.length}</span>
                    </div>

                    <div className="status-column-cards">
                      {compM.length > 0 ? (
                        compM.map((t) => renderFlightDeckCard(t))
                      ) : (
                        <div className="status-column-empty">
                          <span>No completed tasks yet</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* Bottom Tier: Supporting Cockpit Panels (4 Bento Cards) */}
              <section className="flight-deck-cockpit-grid" aria-label="Flight Deck Supporting Cockpit Panels">
                {/* PANEL 1: ACTIVE EXECUTION COCKPIT HERO */}
                <div className="cockpit-panel cockpit-hero-panel">
                  <div className="cockpit-panel-header">
                    <div className="cockpit-panel-header-left">
                      <div className="cockpit-panel-icon">
                        <Icon name="focus" size={16} />
                      </div>
                      <h3 className="cockpit-panel-title">Execution Cockpit</h3>
                    </div>
                    {activeSession ? (
                      <span className="hero-session-tag">
                        <span className="hero-pulse-dot" />
                        <span>ACTIVE</span>
                      </span>
                    ) : (
                      <span className="hero-idle-shield-tag">
                        <span>SHIELD ARMED</span>
                      </span>
                    )}
                  </div>

                  {activeSession ? (
                    <div className="hero-body-active">
                      <div className="hero-session-name">{activeSession.name}</div>
                      {activeSession.intention && (
                        <div className="hero-session-intention">{activeSession.intention}</div>
                      )}
                      <div className="hero-timer-display">{formatTimerDigits(timerSeconds)}</div>
                      <div className="hero-progress-track">
                        <div
                          className="hero-progress-bar"
                          style={{
                            width: `${Math.max(
                              0,
                              Math.min(
                                100,
                                ((((activeSession.durationMinutes || 25) * 60 - timerSeconds) /
                                  ((activeSession.durationMinutes || 25) * 60)) *
                                  100),
                              ),
                            )}%`,
                          }}
                        />
                      </div>
                      <div className="hero-actions-row">
                        {activeSession.status === 'ACTIVE' && (
                          <button
                            className="hero-btn secondary"
                            onClick={() => handlePause(activeSession.id)}
                          >
                            <Icon name="pause" size={12} />
                            <span>Pause</span>
                          </button>
                        )}
                        {activeSession.status === 'PAUSED' && (
                          <button
                            className="hero-btn primary"
                            onClick={() => handleResume(activeSession.id)}
                          >
                            <Icon name="play" size={12} />
                            <span>Resume</span>
                          </button>
                        )}
                        <button
                          className="hero-btn primary"
                          onClick={() => setCompletingSessionId(activeSession.id)}
                        >
                          <Icon name="check" size={12} />
                          <span>Debrief</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="hero-body-idle">
                      <div className="hero-idle-headline">Sentinel Shield Ready</div>
                      <div className="hero-idle-task-preview">
                        <span className="hero-preview-label">Next Action Target</span>
                        <span className="hero-preview-title">
                          {nextActionMission?.title || (missions.length > 0 ? missions[0].title : 'Plan your next sprint')}
                        </span>
                      </div>
                      <button
                        className="hero-arm-btn"
                        onClick={handleEngageNextAction}
                        title="Start focus on highest priority mission"
                      >
                        <Icon name="play" size={13} />
                        <span>⚡ Start Focus Sprint</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* PANEL 2: SPRINT VELOCITY ARC GAUGE */}
                <div className="cockpit-panel cockpit-velocity-panel">
                  <div className="cockpit-panel-header">
                    <div className="cockpit-panel-header-left">
                      <div className="cockpit-panel-icon">
                        <Icon name="analytics" size={16} />
                      </div>
                      <h3 className="cockpit-panel-title">Sprint Velocity</h3>
                    </div>
                    <button
                      className="cockpit-panel-action-icon"
                      onClick={() => setActiveTab('Analytics')}
                      title="View Detailed Analytics"
                    >
                      <Icon name="arrow-up-right" size={13} />
                    </button>
                  </div>

                  <div className="velocity-body">
                    <div className="velocity-score-row">
                      <div className="velocity-score-num">{velocityRate}%</div>
                      <div className="velocity-score-label">Mission Completion Rate</div>
                    </div>

                    <div className="velocity-gauge-wrap">
                      <svg className="velocity-gauge-svg" viewBox="0 0 200 115" width="100%" height="115">
                        <defs>
                          <linearGradient id="velocityGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#38BDF8" />
                            <stop offset="50%" stopColor="#F59E0B" />
                            <stop offset="100%" stopColor="#FF4D5E" />
                          </linearGradient>
                        </defs>
                        {/* Background track arc */}
                        <path
                          d="M 25 95 A 75 75 0 0 1 175 95"
                          fill="none"
                          stroke="rgba(255, 255, 255, 0.08)"
                          strokeWidth="11"
                          strokeLinecap="round"
                        />
                        {/* Foreground progress arc */}
                        <path
                          d="M 25 95 A 75 75 0 0 1 175 95"
                          fill="none"
                          stroke="url(#velocityGaugeGrad)"
                          strokeWidth="11"
                          strokeLinecap="round"
                          strokeDasharray={gaugeCircumference}
                          strokeDashoffset={gaugeOffset}
                          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}
                        />
                      </svg>
                      <div className="velocity-tick-labels">
                        <span>• Mon</span>
                        <span>• Tue</span>
                        <span>• Wed</span>
                        <span>• Thu</span>
                        <span>• Fri</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PANEL 3: TIME SHEET / SCHEDULE */}
                <div className="cockpit-panel cockpit-timesheet-panel">
                  <div className="cockpit-panel-header">
                    <div className="cockpit-panel-header-left">
                      <div className="cockpit-panel-icon">
                        <Icon name="schedule" size={16} />
                      </div>
                      <h3 className="cockpit-panel-title">Time Sheet</h3>
                    </div>
                    <button
                      className="cockpit-panel-action-icon"
                      onClick={() => setActiveTab('Schedule')}
                      title="Open Calendar Schedule"
                    >
                      <Icon name="arrow-up-right" size={13} />
                    </button>
                  </div>

                  <div className="timesheet-list">
                    {sessions.length > 0 ? (
                      sessions.slice(0, 4).map((s, idx) => {
                        const canStart = s.status === 'SCHEDULED' && !activeSession
                        const title = canStart
                          ? 'Click to start session'
                          : s.status === 'COMPLETED'
                            ? 'Completed session'
                            : activeSession
                              ? 'Finish the active focus session before starting another'
                              : `Session is ${s.status.toLowerCase()}`
                        return (
                        <div
                          key={s.id}
                          className={`timesheet-item ${idx === 0 ? 'rank-first' : ''}`}
                          onClick={() => {
                            if (canStart) void handleStartFromSchedule(s.id)
                          }}
                          style={{ cursor: canStart ? 'pointer' : 'default' }}
                          title={title}
                        >
                          <div className="timesheet-item-left">
                            <span className="timesheet-rank-pill">{idx + 1}</span>
                            <div className="timesheet-meta">
                              <span className="timesheet-name">{s.name}</span>
                              <span className="timesheet-sub">{s.intention || 'Strategic Sprint'}</span>
                            </div>
                          </div>
                          <div className="timesheet-item-right">
                            <span className="timesheet-duration-badge">{s.durationMinutes}m</span>
                          </div>
                        </div>
                        )
                      })
                    ) : (
                      <div className="status-column-empty" style={{ padding: '16px' }}>
                        <span>No focus sessions recorded yet</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* PANEL 4: ACTIVITY FEED */}
                <div className="cockpit-panel cockpit-activity-panel">
                  <div className="cockpit-panel-header">
                    <div className="cockpit-panel-header-left">
                      <div className="cockpit-panel-icon">
                        <Icon name="sparkle" size={16} />
                      </div>
                      <h3 className="cockpit-panel-title">Activity</h3>
                    </div>
                    <span className="card-goal-tag" style={{ fontSize: '10.5px' }}>Today</span>
                  </div>

                  <div className="activity-feed-list">
                    {recentDebriefsList.length > 0 ? (
                      recentDebriefsList.slice(0, 3).map((d) => (
                        <div key={d.sessionId} className="activity-feed-item">
                          <div className="activity-feed-top">
                            <span className="activity-feed-name">{d.sessionName}</span>
                            <span className="activity-feed-time">
                              {d.completedAt ? new Date(d.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                            </span>
                          </div>
                          <span className="activity-feed-note">
                            {d.accomplishment || d.reflectionNote || 'Completed sprint and recorded debrief telemetry'}
                          </span>
                          <span className="activity-feed-tag">✓ Sprint Debriefed ({d.durationMinutes}m)</span>
                        </div>
                      ))
                    ) : sessions.filter((s) => s.status === 'COMPLETED').length > 0 ? (
                      sessions
                        .filter((s) => s.status === 'COMPLETED')
                        .slice(0, 3)
                        .map((s) => (
                          <div key={s.id} className="activity-feed-item">
                            <div className="activity-feed-top">
                              <span className="activity-feed-name">{s.name}</span>
                              <span className="activity-feed-time">Completed</span>
                            </div>
                            <span className="activity-feed-note">{s.intention || 'Execution session concluded successfully'}</span>
                            <span className="activity-feed-tag">✓ {s.durationMinutes}m Focus Completed</span>
                          </div>
                        ))
                    ) : (
                      <div className="status-column-empty" style={{ padding: '16px' }}>
                        <span>No recent debrief records</span>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* Quick Mission Creator Modal */}
              {isCreatingQuickMission && (
                <div className="flight-deck-quick-modal-overlay" onClick={() => setIsCreatingQuickMission(false)}>
                  <div className="flight-deck-quick-modal-card" onClick={(e) => e.stopPropagation()}>
                    <div className="quick-modal-header">
                      <h3 className="quick-modal-title">Create Tactical Mission</h3>
                      <button className="quick-modal-close" onClick={() => setIsCreatingQuickMission(false)}>
                        <Icon name="close" size={14} />
                      </button>
                    </div>

                    <form className="quick-modal-form" onSubmit={handleQuickCreateMission}>
                      {quickMissionError && (
                        <div className="quick-modal-error" role="alert">{quickMissionError}</div>
                      )}
                      <div className="quick-field-group">
                        <label className="quick-field-label">Target Strategic Goal</label>
                        <select
                          className="quick-field-select"
                          value={quickMissionGoalId ?? ''}
                          onChange={(e) => setQuickMissionGoalId(Number(e.target.value))}
                          required
                        >
                          {goals.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.title}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="quick-field-group">
                        <label className="quick-field-label">Mission Title</label>
                        <input
                          type="text"
                          className="quick-field-input"
                          placeholder="E.g. Refactor API telemetry endpoint..."
                          value={quickMissionTitle}
                          onChange={(e) => setQuickMissionTitle(e.target.value)}
                          required
                          autoFocus
                        />
                      </div>

                      <div className="quick-field-group">
                        <label className="quick-field-label">Sprint Duration</label>
                        <div className="quick-duration-presets">
                          {[15, 25, 45, 60].map((dur) => (
                            <button
                              type="button"
                              key={dur}
                              className={`quick-preset-btn ${quickMissionDuration === dur ? 'active' : ''}`}
                              onClick={() => setQuickMissionDuration(dur)}
                            >
                              {dur}m
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="quick-modal-actions">
                        <button
                          type="button"
                          className="board-action-btn secondary"
                          onClick={() => setIsCreatingQuickMission(false)}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="board-action-btn primary"
                          disabled={isSubmittingQuickMission || !quickMissionTitle.trim()}
                        >
                          {isSubmittingQuickMission ? 'Creating...' : '+ Create Mission'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Task Inspector & Focus Sprint Arming Modal */}
              {inspectingMission && (
                <div className="taskmaster-modal-overlay" onClick={() => setInspectingMission(null)}>
                  <div className="taskmaster-modal-card" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="badge-tag red">MISSION INSPECTOR</span>
                        <span className="badge-tag blue">{inspectingMission.estimatedMinutes || 25}m Sprint</span>
                      </div>
                      <button className="modal-close-icon-btn" onClick={() => setInspectingMission(null)}>
                        <Icon name="close" size={14} />
                      </button>
                    </div>

                    <h3 className="modal-mission-title">{inspectingMission.title}</h3>
                    {inspectingMission.description && (
                      <p className="modal-mission-desc">{inspectingMission.description}</p>
                    )}

                    <div className="modal-meta-grid">
                      <div className="modal-meta-item">
                        <span className="meta-label">STATUS</span>
                        <span className="meta-val">{inspectingMission.status || 'PENDING'}</span>
                      </div>
                      <div className="modal-meta-item">
                        <span className="meta-label">FOCUS DURATION</span>
                        <span className="meta-val">{inspectingMission.estimatedMinutes || 25} Minutes</span>
                      </div>
                      <div className="modal-meta-item">
                        <span className="meta-label">OS SHIELD</span>
                        <span className="meta-val highlight-red">ENFORCEMENT READY</span>
                      </div>
                    </div>

                    <div className="modal-action-footer">
                      <button
                        className="modal-btn-arm-sprint"
                        onClick={() => {
                          handleArmMissionAsSession(inspectingMission.title, inspectingMission.estimatedMinutes ?? undefined)
                          setInspectingMission(null)
                        }}
                      >
                        <Icon name="sparkle" size={14} />
                        <span>Arm & Start Focus Sprint</span>
                      </button>
                      {inspectingMission.id > 0 && inspectingMission.status !== 'COMPLETED' && (
                        <button
                          className="modal-btn-complete"
                          onClick={() => {
                            handleToggleMissionComplete(inspectingMission.id)
                            setInspectingMission(null)
                          }}
                        >
                          <Icon name="check" size={14} />
                          <span>Mark Done</span>
                        </button>
                      )}
                      <button
                        className="modal-btn-deconstruct"
                        onClick={() => {
                          setActiveTab('AI Assistant')
                          handleAiSend(`Deconstruct this mission into concrete micro-steps: "${inspectingMission.title}"`)
                          setInspectingMission(null)
                        }}
                      >
                        <span>Eonpai Assist</span>
                      </button>
                      {inspectingMission.id > 0 && (
                        <button
                          className="modal-btn-delete"
                          onClick={() => {
                            handleDeleteMission(inspectingMission.id, inspectingMission.title)
                          }}
                          disabled={deletingMissionId === inspectingMission.id}
                          title="Delete this task permanently"
                        >
                          <Icon name="trash" size={14} />
                          <span>{deletingMissionId === inspectingMission.id ? 'Deleting...' : 'Delete'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })()}


        {/* Tab 2: Focus Engine */}
        {activeTab === 'Focus Engine' && (
          <div className="bento-grid">
            {/* Running Timer HUD */}
            <div className="bento-card card-timer-hud">
              <div className="card-header-row">
                <div className="card-title-group">
                  <span className="card-title">Focus</span>
                  <span className={`badge-tag ${activeSession ? 'green' : 'blue'}`}>
                    {activeSession ? activeSession.status : 'STANDBY'}
                  </span>
                </div>
                <Icon name="clock" size={20} />
              </div>

              <div className="timer-digits-display">{formatTimerDigits(timerSeconds)}</div>

              {(activeSession?.intention || sessionIntention) && (
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <span className="active-intention-tag">
                    {activeSession?.intention || sessionIntention}
                  </span>
                </div>
              )}

              <div className="timer-progress-track">
                <div
                  className="timer-progress-fill"
                  style={{
                    width: activeSession
                      ? `${Math.max(
                          0,
                          Math.min(
                            100,
                            ((((activeSession.durationMinutes || 25) * 60 - timerSeconds) /
                              ((activeSession.durationMinutes || 25) * 60)) *
                              100),
                          ),
                        )}%`
                      : '0%',
                  }}
                />
              </div>

              <div className="timer-action-buttons">
                {!activeSession && (
                  <button className="btn-timer primary" onClick={handleStartSession} data-tutorial="start-timer-btn">
                    <Icon name="play" size={16} />
                    <span>Engage {selectedDuration}m Sprint</span>
                  </button>
                )}

                {activeSession && activeSession.status === 'ACTIVE' && (
                  <>
                    <button
                      className="btn-timer secondary"
                      onClick={() => handlePause(activeSession.id)}
                    >
                      <Icon name="pause" size={16} />
                      <span>Pause Session</span>
                    </button>
                    <button
                      className="btn-timer primary"
                      onClick={() => setCompletingSessionId(activeSession.id)}
                      data-tutorial="debrief-controls"
                    >
                      <Icon name="check" size={16} />
                      <span>Complete & Debrief</span>
                    </button>
                    <button
                      className="btn-timer danger"
                      onClick={() => handleDeleteSession(activeSession.id)}
                      title="Discard and delete current focus session"
                    >
                      <Icon name="trash" size={16} />
                      <span>Delete</span>
                    </button>
                  </>
                )}

                {activeSession && activeSession.status === 'PAUSED' && (
                  <>
                    <button
                      className="btn-timer primary"
                      onClick={() => handleResume(activeSession.id)}
                    >
                      <Icon name="play" size={16} />
                      <span>Resume Sprint</span>
                    </button>
                    <button
                      className="btn-timer secondary"
                      onClick={() => setCompletingSessionId(activeSession.id)}
                    >
                      <Icon name="check" size={16} />
                      <span>Debrief Early</span>
                    </button>
                    <button
                      className="btn-timer danger"
                      onClick={() => handleDeleteSession(activeSession.id)}
                      title="Discard and delete current focus session"
                    >
                      <Icon name="trash" size={16} />
                      <span>Delete</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Session Creator & Pomodoro Plans */}
            <div className="bento-card card-session-creator">
              <div className="card-header-row">
                <div className="card-title-group">
                  <span className="card-title">Focus plan</span>
                  <span className="badge-tag">Presets & Custom</span>
                </div>
                <Icon name="target" size={20} />
              </div>

              <div className="preset-chip-row">
                {durationPresets.map((mins) => (
                  <button
                    key={mins}
                    className={`preset-chip ${
                      selectedDuration === mins && !isCustomDuration ? 'active' : ''
                    }`}
                    onClick={() => {
                      setSelectedDuration(mins)
                      setSelectedPomodoroPlan(null)
                      setIsCustomDuration(false)
                    }}
                  >
                    {mins}m
                  </button>
                ))}
                <button
                  className={`preset-chip ${isCustomDuration ? 'active' : ''}`}
                  onClick={() => {
                    setIsCustomDuration(true)
                    setSelectedPomodoroPlan(null)
                  }}
                >
                  Custom
                </button>
              </div>

              {isCustomDuration && (
                <div className="custom-duration-card">
                  <div className="custom-duration-header">
                    <span>Custom Sprint Duration</span>
                    <span className="custom-mins-badge">{selectedDuration} min</span>
                  </div>
                  <div className="custom-slider-row">
                    <input
                      type="range"
                      min={5}
                      max={180}
                      step={5}
                      value={selectedDuration}
                      onChange={(e) => setSelectedDuration(Number(e.target.value))}
                      className="custom-slider"
                    />
                    <input
                      type="number"
                      min={1}
                      max={480}
                      value={selectedDuration}
                      onChange={(e) =>
                        setSelectedDuration(Math.max(1, Math.min(480, Number(e.target.value))))
                      }
                      className="modal-field"
                      style={{
                        width: 75,
                        marginBottom: 0,
                        padding: '6px 8px',
                        textAlign: 'center',
                        fontWeight: 800,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Optional Session Intention Input */}
              <div className="session-intention-box">
                <input
                  type="text"
                  value={sessionIntention}
                  onChange={(e) => setSessionIntention(e.target.value)}
                  placeholder="Target Intention (e.g. Build neural kernel / Close open PR)..."
                  className="session-intention-input"
                  disabled={!!activeSession}
                />
              </div>

              <div className="pomodoro-plan-grid">
                {pomodoroPlans.map((plan) => (
                  <div
                    key={plan.name}
                    className={`plan-card-item ${
                      selectedPomodoroPlan === plan.name ? 'active' : ''
                    }`}
                    onClick={() => {
                      setSelectedPomodoroPlan(plan.name)
                      setSelectedDuration(plan.totalMinutes)
                    }}
                  >
                    <div>
                      <div className="plan-name">{plan.name}</div>
                      <div className="plan-schedule-sub">{plan.schedule}</div>
                    </div>
                    <span className="badge-tag blue">{plan.totalMinutes}m</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bento Card 3: Focus Sprints History & Registry */}
            <div className="bento-card card-session-history">
              <div className="card-header-row">
                <div className="card-title-group">
                  <span className="card-title">Recent sessions</span>
                  <span className="badge-tag">{sessions.length} Recorded</span>
                </div>
                <Icon name="clock" size={18} />
              </div>

              {sessions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-3)', fontSize: 14 }}>
                  No focus sprint records yet. Engage your first sprint above to initialize telemetry.
                </div>
              ) : (
                <div className="dense-table-wrapper">
                  <table className="dense-table">
                    <thead>
                      <tr>
                        <th>Sprint Target / Name</th>
                        <th>Duration</th>
                        <th>Status</th>
                        <th>Timeline</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((sess) => (
                        <tr key={sess.id}>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                              {sess.name}
                            </div>
                            {sess.intention && (
                              <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
                                {sess.intention}
                              </div>
                            )}
                          </td>
                          <td>
                            <span className="badge-tag blue">{sess.durationMinutes}m</span>
                          </td>
                          <td>
                            <span
                              className={`status-indicator-pill ${
                                sess.status === 'COMPLETED'
                                  ? 'completed'
                                  : sess.status === 'ACTIVE'
                                  ? 'active'
                                  : 'pending'
                              }`}
                            >
                              {sess.status}
                            </span>
                          </td>
                          <td style={{ fontSize: 13, color: 'var(--text-3)' }}>
                            {sess.startedAt
                              ? new Date(sess.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : sess.createdAt
                              ? new Date(sess.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : '—'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn-icon-delete"
                              title="Delete Focus Session"
                              onClick={() => handleDeleteSession(sess.id)}
                            >
                              <Icon name="trash" size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: AI Assistant / EONPAI */}
        {activeTab === 'AI Assistant' && (
          <div className="ai-bento-container">
            <div className="ai-sidebar-card">
              <div className="card-header-row" style={{ margin: 0 }}>
                <span className="card-title">Quick Actions</span>
                <Icon name="sparkle" size={18} />
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>
                Issue natural commands or trigger direct strategic algorithms to structure your day.
              </p>

              {[
                { label: 'Plan My Execution Day', prompt: 'Plan my day with high-impact sessions' },
                { label: 'Debrief Last Sprint', prompt: 'Debrief my last focus session' },
                { label: 'Cognitive Recovery Protocol', prompt: 'I need a cognitive recovery break' },
                { label: 'Start Guided Walkthrough', prompt: 'How do I use SHINPO?' },
                { label: 'Check Sentinel Status', prompt: 'Why is YouTube blocked?' },
                { label: 'Report an Issue / Bug', prompt: 'I found a bug. Please report this issue' },
                { label: 'What is My Next Action?', prompt: 'What should I work on right now?' },
                { label: 'Deconstruct Top Goal', prompt: 'Break down my top goal into actionable steps' },
              ].map((p, idx) => (
                <button
                  key={idx}
                  className="ai-preset-btn"
                  onClick={() => handleTriggerPresetAction(p.prompt)}
                >
                  <span>{p.label}</span>
                  <Icon name="arrow-up-right" size={14} />
                </button>
              ))}
            </div>

            <div className="ai-chat-card">
              <div className="card-header-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="card-title">EONPAI Conversation</span>
                  <span className="badge-tag green">EONPAI ONLINE</span>
                </div>
                <button
                  className="btn-ai-new-chat"
                  onClick={handleClearChat}
                  title="Archive current conversation and start fresh"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-3)',
                    fontSize: 12,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--text-1)'
                    e.currentTarget.style.borderColor = 'var(--border-strong)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-3)'
                    e.currentTarget.style.borderColor = 'var(--border-subtle)'
                  }}
                >
                  <Icon name="refresh" size={13} />
                  <span>New Chat</span>
                </button>
              </div>

              <div
                className="ai-messages-feed"
                ref={aiFeedRef}
                onScroll={handleChatScroll}
                onWheel={(e) => {
                  if (e.deltaY < 0) {
                    autoFollowEnabledRef.current = false
                    setShowScrollBottomBtn(true)
                  }
                }}
              >
                <div className="ai-messages-content" ref={aiContentRef}>
                  {chatMessages.map((msg, index) => (
                    <div key={msg.id ?? index} className={`ai-bubble ${msg.role}`}>
                      <div>{msg.text}</div>

                      {msg.suggestionType === 'GREETING' && (
                        <div className="ai-quick-chips">
                          <button className="ai-quick-chip" onClick={() => handleTriggerPresetAction('Plan my day')}>
                            Plan my day
                          </button>
                          <button className="ai-quick-chip" onClick={() => handleTriggerPresetAction('What should I work on right now?')}>
                            What should I work on?
                          </button>
                          <button className="ai-quick-chip" onClick={() => handleTriggerPresetAction('Debrief my last focus session')}>
                            ⚡ Debrief last sprint
                          </button>
                          <button className="ai-quick-chip" onClick={() => handleTriggerPresetAction('I need a recovery break')}>
                            🛡️ Recovery break
                          </button>
                          <button className="ai-quick-chip" onClick={() => handleStartTutorial(0)}>
                            Start tour
                          </button>
                          <button className="ai-quick-chip" onClick={() => handleTriggerPresetAction('Why is YouTube blocked?')}>
                            Check Sentinel status
                          </button>
                        </div>
                      )}

                      {msg.tutorial && (
                        <div className="ai-tutorial-card">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span className="badge-tag red">TUTORIAL • STEP {msg.tutorial.stepId}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{msg.tutorial.tutorialId}</span>
                          </div>
                          <p style={{ fontSize: 13, color: 'var(--text)', margin: '0 0 10px 0', lineHeight: 1.4 }}>
                            {msg.tutorial.instruction}
                          </p>
                          <button
                            className="ai-arm-sprint-btn"
                            onClick={() => handleStartTutorial(0)}
                          >
                            <span>Start interactive tour</span>
                            <Icon name="arrow-up-right" size={12} />
                          </button>
                        </div>
                      )}

                      {msg.bugReport && (
                        <div className="ai-bug-card">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span className="badge-tag green">DIAGNOSTIC LOGGED: {msg.bugReport.bugId}</span>
                            <span className="badge-tag blue">{msg.bugReport.feature}</span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'monospace' }}>
                            Sanitized host telemetry captured (OS, memory, JVM, focus status). Zero credentials stored.
                          </div>
                        </div>
                      )}

                      {msg.dailyPlan && (
                        <div className="ai-daily-agenda-card" role="region" aria-label="Circadian Daily Agenda">
                          <div className="ai-daily-agenda-header">
                            <div className="ai-agenda-title-row">
                              <span className="badge-tag coral">
                                <span className="agenda-pulse-dot" /> CIRCADIAN AGENDA
                              </span>
                              {msg.dailyPlan.circadianPacingStrategy && (
                                <span className="badge-tag blue">
                                  {msg.dailyPlan.circadianPacingStrategy.replace(/_/g, ' ')}
                                </span>
                              )}
                              {msg.dailyPlan.userEstimationBiasPct !== undefined && msg.dailyPlan.userEstimationBiasPct !== 0 && (
                                <span className={`badge-tag ${msg.dailyPlan.userEstimationBiasPct > 0 ? 'amber' : 'green'}`}>
                                  ⏱️ Calibrated ({msg.dailyPlan.userEstimationBiasPct > 0 ? '+' : ''}{Math.round(msg.dailyPlan.userEstimationBiasPct)}% bias)
                                </span>
                              )}
                            </div>
                            <h4 className="ai-agenda-headline">{msg.dailyPlan.headline}</h4>
                            <p className="ai-agenda-rationale">{msg.dailyPlan.rationale}</p>
                          </div>

                          <div className="ai-agenda-metrics-bar">
                            <div className="agenda-metric-chip">
                              <span className="agenda-metric-label">Total Duration</span>
                              <span className="agenda-metric-val">
                                {msg.dailyPlan.totalPlannedMinutes ||
                                  msg.dailyPlan.planItems?.reduce((acc, it) => acc + (it.durationMinutes || 0), 0) ||
                                  0}m
                              </span>
                            </div>
                            <div className="agenda-metric-chip focus">
                              <span className="agenda-metric-label">Deep Focus</span>
                              <span className="agenda-metric-val">
                                {msg.dailyPlan.totalFocusMinutes ||
                                  msg.dailyPlan.planItems?.filter(it => !it.isRestorativeBreak).reduce((acc, it) => acc + (it.durationMinutes || 0), 0) ||
                                  0}m
                              </span>
                            </div>
                            <div className="agenda-metric-chip recess">
                              <span className="agenda-metric-label">Attention Recess</span>
                              <span className="agenda-metric-val">
                                {msg.dailyPlan.totalBreakMinutes ||
                                  msg.dailyPlan.planItems?.filter(it => it.isRestorativeBreak).reduce((acc, it) => acc + (it.durationMinutes || 0), 0) ||
                                  0}m
                              </span>
                            </div>
                            {msg.dailyPlan.hasConflictsResolved && (
                              <div className="agenda-metric-chip buffer">
                                <span className="agenda-metric-label">Conflict Guard</span>
                                <span className="agenda-metric-val">10m Spacing Auto-Applied</span>
                              </div>
                            )}
                          </div>

                          <div className="ai-agenda-timeline">
                            {msg.dailyPlan.planItems?.map((item, itIdx) => (
                              <div
                                key={itIdx}
                                className={`ai-agenda-timeline-item ${item.isRestorativeBreak ? 'recess-block' : 'focus-block'}`}
                              >
                                <div className="timeline-time-badge">
                                  <span>{item.scheduledStartTime || 'Flexible'}</span>
                                  {item.scheduledEndTime ? (
                                    <>
                                      <span className="time-sep">-</span>
                                      <span>{item.scheduledEndTime}</span>
                                    </>
                                  ) : null}
                                </div>

                                <div className="timeline-content-card">
                                  <div className="timeline-card-header">
                                    <div className="timeline-card-title-group">
                                      {item.isRestorativeBreak ? (
                                        <span className="badge-tag green small">🌱 RECOVERY</span>
                                      ) : (
                                        <span className={`badge-tag small ${
                                          item.energyWindow === 'DEEP_FOCUS' ? 'coral' :
                                          item.energyWindow === 'STRATEGIC_REVIEW' ? 'amber' : 'blue'
                                        }`}>
                                          {(item.energyWindow || 'TACTICAL_SPRINT').replace(/_/g, ' ')}
                                        </span>
                                      )}
                                      <span className="timeline-mission-title">{item.missionTitle}</span>
                                    </div>

                                    <div className="timeline-duration-badge">
                                      <span className="duration-mins">{item.durationMinutes}m</span>
                                      {item.originalEstimatedMinutes && item.originalEstimatedMinutes !== item.durationMinutes ? (
                                        <span className="duration-scaled" title="Calibrated for historical estimation bias">
                                          (scaled from {item.originalEstimatedMinutes}m)
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>

                                  {item.goalTitle && !item.isRestorativeBreak && (
                                    <div className="timeline-goal-caption">
                                      <span>Goal: {item.goalTitle}</span>
                                    </div>
                                  )}

                                  {!item.isRestorativeBreak && (
                                    <div className="timeline-card-actions">
                                      <button
                                        className="ai-arm-sprint-btn"
                                        onClick={() => handleArmMissionAsSession(item.missionTitle, item.durationMinutes)}
                                        title="Arm Immediate Focus Sprint with Sentinel Shield"
                                      >
                                        <span>Start now</span>
                                        <Icon name="arrow-up-right" size={12} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="ai-agenda-footer">
                            <button
                              className={`btn primary ai-commit-agenda-btn ${msg.committed ? 'committed' : ''}`}
                              disabled={msg.committing || msg.committed}
                              onClick={() => handleCommitDailyPlan(msg.dailyPlan!, index, msg.suggestionId)}
                              aria-label="Commit all agenda items into today's focus schedule"
                            >
                              {msg.committed
                                ? '✅ Agenda Committed to Today’s Schedule'
                                : msg.committing
                                ? 'Scheduling Focus Sessions...'
                                : '⚡ Commit Agenda to Today’s Schedule'}
                            </button>
                          </div>
                        </div>
                      )}

                      {msg.missions && msg.missions.length > 0 && !msg.dailyPlan && (
                        <div className="ai-cards-container" role="region" aria-label="Actionable AI proposal cards">
                          {msg.suggestionId && (
                            <div className="ai-card-header-bar">
                              <span className="ai-card-header-title">
                                🎯 Action Proposal • {msg.missions.length} tactical missions
                              </span>
                              {msg.committed ? (
                                <span className="badge-tag green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  ✓ Added to Backlog
                                </span>
                              ) : (
                                <button
                                  className="btn primary small ai-commit-all-btn"
                                  disabled={msg.committing}
                                  onClick={() => handleCommitChatSuggestion(msg.suggestionId!, index)}
                                  aria-label="Approve and commit all proposed missions into goal backlog"
                                  title="Atomically approve and save all proposed missions into your goal backlog"
                                >
                                  {msg.committing ? 'Saving to Database...' : '⚡ Approve & Add All to Backlog'}
                                </button>
                              )}
                            </div>
                          )}

                          <div className="ai-cards-row">
                            {msg.missions.map((m, mIdx) => (
                              <div key={mIdx} className="ai-mission-card" role="group" aria-label={`Mission: ${m.title}`}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, marginRight: 12 }}>
                                  <span style={{ fontWeight: 600 }}>{m.title}</span>
                                  {m.description && (
                                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{m.description}</span>
                                  )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                  <span className="badge-tag blue">{m.estimatedMinutes}m</span>
                                  {msg.suggestionId && !msg.committed && (
                                    <button
                                      className="btn ghost small ai-commit-single-btn"
                                      disabled={msg.committing}
                                      onClick={() => handleCommitChatSuggestion(msg.suggestionId!, index, m)}
                                      title="Add this mission to backlog"
                                      aria-label={`Add ${m.title} to goal backlog`}
                                    >
                                      + Backlog
                                    </button>
                                  )}
                                  <button
                                    className="ai-arm-sprint-btn"
                                    onClick={() => handleArmMissionAsSession(m.title, m.estimatedMinutes)}
                                    title="Arm Focus Session with Shield"
                                    aria-label={`Start focus sprint for ${m.title}`}
                                  >
                                    <span>Start focus</span>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {msg.debriefAnalysis && (
                        <div className="ai-debrief-card" role="region" aria-label="Session Debrief Analysis">
                          <div className="ai-debrief-header">
                            <div className="ai-debrief-title-row">
                              <span className="badge-tag coral">
                                <span className="debrief-pulse-dot" /> SPRINT DEBRIEF
                              </span>
                              <span className={`badge-tag ${
                                msg.debriefAnalysis.velocityAssessment === 'PEAK_EXECUTION_FLOW'
                                  ? 'green'
                                  : msg.debriefAnalysis.velocityAssessment === 'COGNITIVE_RECOVERY_REQUIRED'
                                  ? 'red'
                                  : msg.debriefAnalysis.velocityAssessment === 'PACING_CALIBRATION_NEEDED'
                                  ? 'amber'
                                  : 'blue'
                              }`}>
                                {msg.debriefAnalysis.velocityAssessment.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <h4 className="ai-debrief-session-name">{msg.debriefAnalysis.sessionName}</h4>
                          </div>

                          <div className="ai-debrief-metrics-grid">
                            <div className="ai-debrief-metric-box">
                              <span className="debrief-metric-label">Planned</span>
                              <span className="debrief-metric-val">{msg.debriefAnalysis.plannedMinutes}m</span>
                            </div>
                            <div className="ai-debrief-metric-box">
                              <span className="debrief-metric-label">Actual</span>
                              <span className="debrief-metric-val">{msg.debriefAnalysis.actualMinutes}m</span>
                            </div>
                            <div className="ai-debrief-metric-box">
                              <span className="debrief-metric-label">Estimation</span>
                              <span className="debrief-metric-val">{msg.debriefAnalysis.estimationAccuracyPct.toFixed(0)}%</span>
                            </div>
                            {msg.debriefAnalysis.completionQuality && (
                              <div className="ai-debrief-metric-box">
                                <span className="debrief-metric-label">Quality</span>
                                <span className="debrief-metric-val">⭐ {msg.debriefAnalysis.completionQuality}/5</span>
                              </div>
                            )}
                          </div>

                          {msg.debriefAnalysis.accomplishment && (
                            <div className="ai-debrief-section">
                              <span className="ai-debrief-section-title">Outcome Achieved</span>
                              <p className="ai-debrief-text">{msg.debriefAnalysis.accomplishment}</p>
                            </div>
                          )}

                          {msg.debriefAnalysis.reflectionNote && (
                            <div className="ai-debrief-section">
                              <span className="ai-debrief-section-title">Sprint Reflection</span>
                              <p className="ai-debrief-text font-italic">"{msg.debriefAnalysis.reflectionNote}"</p>
                            </div>
                          )}

                          <div className="ai-debrief-critique-box">
                            <div className="ai-debrief-critique-header">
                              <Icon name="target" size={13} />
                              <span>Tactical Pacing Critique</span>
                            </div>
                            <p className="ai-debrief-text">{msg.debriefAnalysis.tacticalCritique}</p>
                          </div>

                          <div className="ai-debrief-recommendation-box">
                            <div className="ai-debrief-recommendation-header">
                              <Icon name="zap" size={13} />
                              <span>Next Sprint Recommendation</span>
                            </div>
                            <p className="ai-debrief-text">{msg.debriefAnalysis.nextSprintRecommendation}</p>
                          </div>

                          {msg.debriefAnalysis.suggestedNextSteps && msg.debriefAnalysis.suggestedNextSteps.length > 0 && (
                            <div className="ai-debrief-actions">
                              <span className="ai-debrief-actions-title">Recommended Execution Actions:</span>
                              <div className="ai-recovery-options-row">
                                {msg.debriefAnalysis.suggestedNextSteps.map((opt, oIdx) => (
                                  <button
                                    key={oIdx}
                                    className="recovery-action-chip"
                                    onClick={() => handleRecoveryActionClick(opt)}
                                    title={opt.suggestedAction}
                                  >
                                    <span className="chip-label">{opt.label}</span>
                                    <span className="chip-sub">{opt.suggestedAction}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {msg.sessionRecovery && (
                        <div className="ai-recovery-card" role="region" aria-label="Cognitive Recovery Protocol">
                          <div className="ai-recovery-header">
                            <span className="badge-tag amber">
                              🛡️ COGNITIVE RECOVERY WORKFLOW
                            </span>
                            {msg.sessionRecovery.sessionName && (
                              <span className="ai-recovery-session-tag">
                                {msg.sessionRecovery.sessionName}
                              </span>
                            )}
                          </div>

                          <p className="ai-recovery-diagnostic">
                            {msg.sessionRecovery.diagnosticMessage}
                          </p>

                          <div className="ai-recovery-options-grid">
                            {msg.sessionRecovery.recoveryOptions?.map((opt, oIdx) => (
                              <div key={oIdx} className="ai-recovery-option-card">
                                <div className="recovery-option-info">
                                  <span className="recovery-option-title">{opt.label}</span>
                                  <span className="recovery-option-desc">{opt.suggestedAction}</span>
                                </div>
                                <button
                                  className="ai-arm-sprint-btn"
                                  onClick={() => handleRecoveryActionClick(opt)}
                                  title={`Activate ${opt.label}`}
                                >
                                  <span>Activate</span>
                                  <Icon name="arrow-up-right" size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {aiLoading && (
                    <div className="ai-bubble assistant" style={{ fontStyle: 'italic' }}>
                      EONPAI formulating response...
                    </div>
                  )}
                </div>
              </div>

              {/* Floating Scroll to Bottom Button */}
              {showScrollBottomBtn && (
                <button
                  className="ai-scroll-bottom-btn"
                  onClick={handleScrollToBottom}
                  aria-label="Scroll to latest"
                  title="Scroll to latest"
                >
                  ↓
                </button>
              )}

              <div className="ai-chat-input-bar">
                <input
                  type="text"
                  className="ai-input-field"
                  placeholder="Ask EONPAI anything (e.g. 'plan my sprints', 'guide me', 'split my objective')..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAiSend()}
                />
                <button className="ai-send-btn" onClick={() => handleAiSend()}>
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Goals & Missions */}
        {activeTab === 'Goals & Missions' && (
          <div className="bento-grid">
            {/* Section 1: Strategic Objectives Header */}
            <div className="deck-section-header">
              <div className="deck-section-title">
                <Icon name="goals" size={18} />
                <span>Strategic Objectives & Targets</span>
              </div>
              <button
                className="btn-timer primary"
                style={{ padding: '9px 18px', fontSize: 14 }}
                onClick={() => setIsCreatingGoal(true)}
                data-tutorial="new-goal"
              >
                <Icon name="plus" size={14} />
                <span>New Strategic Goal</span>
              </button>
            </div>

            {/* AI Decomposition Result Banner */}
            {aiDecompResult && (
              <div className="ai-decomp-banner">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name="sparkle" size={18} />
                    <span style={{ fontWeight: 800, fontSize: 16 }}>
                      AI Deconstruction: {aiDecompResult.goalTitle}
                    </span>
                  </div>
                  <button
                    className="sidebar-toggle-btn"
                    onClick={() => setAiDecompResult(null)}
                    title="Dismiss"
                  >
                    <Icon name="close" size={14} />
                  </button>
                </div>
                <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '8px 0 12px', lineHeight: 1.5 }}>
                  {aiDecompResult.analysis}
                </p>

                <div className="decomp-items-grid">
                  {aiDecompResult.proposedMissions.map((pm, idx) => (
                    <div key={idx} className="decomp-mission-box">
                      <div>
                        <div className="decomp-title">{pm.title}</div>
                        <div className="decomp-desc">{pm.description}</div>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginTop: 10,
                        }}
                      >
                        <span className="badge-tag blue">{pm.estimatedMinutes}m</span>
                        <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 700 }}>
                          Sprint #{idx + 1}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button
                    className="btn-timer secondary"
                    onClick={() => setAiDecompResult(null)}
                  >
                    Discard
                  </button>
                  <button
                    className="btn-timer primary"
                    onClick={handleCommitAiMissions}
                    data-tutorial="commit-missions"
                  >
                    <Icon name="check" size={14} />
                    <span>Commit {aiDecompResult.proposedMissions.length} Missions to Live Deck</span>
                  </button>
                </div>
              </div>
            )}

            {/* Goals Cards Grid */}
            <div className="goals-grid">
              {goals.length === 0 ? (
                <div
                  className="bento-card"
                  style={{ gridColumn: 'span 12', padding: 32, textAlign: 'center' }}
                >
                  <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 12 }}>
                    No strategic goals initialized yet. Create your first objective or decompose a target.
                  </p>
                  <button className="btn-timer primary" onClick={() => setIsCreatingGoal(true)}>
                    <Icon name="plus" size={14} />
                    <span>Create High-Level Goal</span>
                  </button>
                </div>
              ) : (
                goals.map((g) => {
                  const goalMissions = missions.filter((m) => m.goalId === g.id)
                  const completedCount = goalMissions.filter(
                    (m) => m.status === 'COMPLETED',
                  ).length
                  const progressPct =
                    goalMissions.length > 0
                      ? Math.round((completedCount / goalMissions.length) * 100)
                      : 0

                  return (
                    <div key={g.id} className="goal-card-item">
                      <div className="goal-top-row">
                        <span className="goal-item-title">{g.title}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className={`badge-tag ${g.status === 'ACTIVE' ? 'green' : g.status === 'COMPLETED' ? 'purple' : 'blue'}`}>
                            {g.status}
                          </span>
                          <button
                            className="btn-icon-edit"
                            title="Edit Strategic Goal"
                            onClick={() => openEditGoalModal(g)}
                          >
                            <Icon name="edit" size={13} />
                          </button>
                          <button
                            className="btn-icon-delete"
                            title="Delete Strategic Goal"
                            onClick={() => handleDeleteGoal(g.id, g.title)}
                          >
                            <Icon name="trash" size={13} />
                          </button>
                        </div>
                      </div>
                      {g.description && <p className="goal-item-desc">{g.description}</p>}

                      <div style={{ margin: '4px 0' }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: 13,
                            color: 'var(--text-3)',
                            marginBottom: 4,
                          }}
                        >
                          <span>
                            Missions: {completedCount}/{goalMissions.length}
                          </span>
                          <span style={{ fontWeight: 700 }}>{progressPct}%</span>
                        </div>
                        <div className="goal-progress-bar-bg">
                          <div
                            className="goal-progress-bar-fill"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>

                      <div className="goal-card-footer">
                        <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
                          Target: {g.targetDate ? g.targetDate : 'Open'}
                        </span>
                        <button
                          className="btn-ai-deconstruct"
                          onClick={() => handleDeconstructGoal(g.id)}
                          disabled={decomposingGoalId === g.id}
                          data-tutorial="decompose-goal"
                        >
                          <Icon name="sparkle" size={13} />
                          <span>
                            {decomposingGoalId === g.id ? 'Deconstructing...' : 'Eonpai Deconstruct'}
                          </span>
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Section 2: Tactical Missions Deck */}
            <div className="deck-section-header" style={{ marginTop: 12 }} data-tutorial="missions-queue">
              <div className="deck-section-title">
                <Icon name="target" size={18} />
                <span>Missions</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  className="btn-timer secondary"
                  style={{ padding: '6px 12px', fontSize: 13 }}
                  onClick={() => {
                    if (goals.length === 0) {
                      alert('Please create a Strategic Goal first before adding a Mission.')
                      return
                    }
                    if (!quickMissionGoalId && goals.length > 0) {
                      setQuickMissionGoalId(goals[0].id)
                    }
                    setIsCreatingQuickMission(true)
                  }}
                >
                  <Icon name="plus" size={13} />
                  <span>New Mission</span>
                </button>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['ALL', 'PENDING', 'COMPLETED'] as const).map((filter) => (
                    <button
                      key={filter}
                      className={`filter-chip ${missionsFilter === filter ? 'active' : ''}`}
                      onClick={() => setMissionsFilter(filter)}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="missions-list-container">
              {missions
                .filter((m) => {
                  if (missionsFilter === 'PENDING') return m.status !== 'COMPLETED'
                  if (missionsFilter === 'COMPLETED') return m.status === 'COMPLETED'
                  return true
                })
                .map((m) => {
                  const parentGoal = goals.find((g) => g.id === m.goalId)
                  const isDone = m.status === 'COMPLETED'

                  return (
                    <div
                      key={m.id}
                      className={`mission-deck-row ${isDone ? 'completed' : ''}`}
                    >
                      <div className="mission-deck-left">
                        <button
                          className={`mission-check-btn ${isDone ? 'checked' : ''}`}
                          onClick={() => !isDone && handleToggleMissionComplete(m.id)}
                          title={isDone ? 'Mission Completed' : 'Mark as Completed'}
                        >
                          {isDone && <Icon name="check" size={14} />}
                        </button>
                        <div className="mission-deck-meta">
                          <div
                            className="mission-deck-title"
                            style={{ textDecoration: isDone ? 'line-through' : 'none' }}
                          >
                            {m.title}
                          </div>
                          <div className="mission-deck-sub">
                            {parentGoal && <span>Target: {parentGoal.title}</span>}
                            <span>• {m.estimatedMinutes || 25}m estimated</span>
                            <span>• {m.scheduledDate}</span>
                            <span className={`badge-tag ${isDone ? 'purple' : m.status === 'IN_PROGRESS' ? 'green' : 'blue'}`} style={{ fontSize: 10, padding: '1px 6px' }}>
                              {m.status}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {!isDone && (
                          <button
                            className="btn-timer secondary"
                            style={{ padding: '8px 16px', fontSize: 13 }}
                            onClick={() => {
                              setSelectedDuration(m.estimatedMinutes || 25)
                              setSessionIntention(m.title)
                              setActiveTab('Focus Engine')
                            }}
                          >
                            <Icon name="play" size={12} />
                            <span>Start focus</span>
                          </button>
                        )}
                        <button
                          className="btn-icon-edit"
                          title="Edit Tactical Mission"
                          onClick={() => openEditMissionModal(m)}
                        >
                          <Icon name="edit" size={14} />
                        </button>
                        <button
                          className="btn-icon-delete"
                          title="Delete Tactical Mission"
                          onClick={() => handleDeleteMission(m.id, m.title)}
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* Tab 5: Schedule View (C-002) */}
        {activeTab === 'Schedule' && (
          <div className="schedule-container">
            {/* Top Toolbar */}
            <div className="schedule-top-toolbar">
              <div className="schedule-nav-group">
                <button
                  type="button"
                  className="schedule-nav-btn"
                  onClick={() => setScheduleWeekOffset((prev) => prev - 1)}
                  title="Previous Week"
                >
                  <Icon name="chevron-left" size={14} />
                  <span>Prev Week</span>
                </button>
                <button
                  type="button"
                  className="schedule-nav-btn"
                  onClick={() => {
                    setScheduleWeekOffset(0)
                    setSelectedScheduleDate(new Date().toISOString().split('T')[0])
                  }}
                  title="Return to Current Day"
                >
                  <span>Current Day</span>
                </button>
                <button
                  type="button"
                  className="schedule-nav-btn"
                  onClick={() => setScheduleWeekOffset((prev) => prev + 1)}
                  title="Next Week"
                >
                  <span>Next Week</span>
                  <Icon name="chevron-right" size={14} />
                </button>
                <span className="schedule-week-range-label">
                  {scheduleWeekDays[0].monthName} {scheduleWeekDays[0].dayNum} — {scheduleWeekDays[6].monthName} {scheduleWeekDays[6].dayNum}
                </span>
              </div>

              <button
                type="button"
                className="schedule-btn-book"
                onClick={() => handleOpenBookingModal()}
                data-tutorial="schedule-book-btn"
              >
                <Icon name="plus" size={14} />
                <span>Book Focus Sprint</span>
              </button>
            </div>

            {/* 7-Day Horizontal Strip */}
            <div className="schedule-week-strip">
              {scheduleWeekDays.map((d) => {
                const isSelected = d.dateStr === selectedScheduleDate
                return (
                  <div
                    key={d.dateStr}
                    className={`schedule-day-tile ${isSelected ? 'selected' : ''} ${d.isToday ? 'is-today' : ''}`}
                    onClick={() => setSelectedScheduleDate(d.dateStr)}
                  >
                    {d.isToday && <div className="schedule-today-pill" title="Today" />}
                    <span className="schedule-day-name">{d.dayName}</span>
                    <span className="schedule-day-number">{d.dayNum}</span>
                    <span className="schedule-day-badge">
                      {d.sessionCount === 1 ? '1 Sprint' : `${d.sessionCount} Sprints`}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Day Agenda Board */}
            <div className="schedule-agenda-board">
              <div className="schedule-agenda-header">
                <div className="schedule-agenda-title-group">
                  <h2>
                    {new Date(selectedScheduleDate + 'T00:00:00Z').toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      timeZone: 'UTC',
                    })}
                  </h2>
                  <p>
                    {selectedDaySessions.length} session{selectedDaySessions.length === 1 ? '' : 's'} recorded for this date
                  </p>
                </div>

                <div className="schedule-filter-tabs">
                  {(['ALL', 'PENDING', 'COMPLETED'] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      className={`schedule-filter-btn ${scheduleFilter === filter ? 'active' : ''}`}
                      onClick={() => setScheduleFilter(filter)}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {selectedDaySessions.length > 0 ? (
                <div className="schedule-session-list">
                  {selectedDaySessions.map((session) => {
                    const scheduledTime = session.scheduledAt
                      ? new Date(session.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : session.startedAt
                      ? new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : 'Flexible Slot'

                    return (
                      <div
                        key={session.id}
                        className={`schedule-session-item status-${session.status}`}
                      >
                        <div className="schedule-session-left">
                          <div className="schedule-time-badge">
                            <span>{scheduledTime}</span>
                          </div>

                          <div className="schedule-session-info">
                            <div className="schedule-session-title-row">
                              <span className="schedule-session-title">{session.name}</span>
                              <span className={`schedule-status-pill ${session.status}`}>
                                {session.status}
                              </span>
                            </div>

                            <div className="schedule-session-meta">
                              <div className="schedule-session-meta-item">
                                <Icon name="clock" size={12} />
                                <span>{session.durationMinutes}m Duration</span>
                              </div>
                              {session.intention && (
                                <div className="schedule-session-meta-item">
                                  <span>• Intention: {session.intention}</span>
                                </div>
                              )}
                              {session.result?.accomplishment && (
                                <div className="schedule-session-meta-item" style={{ color: '#34C759' }}>
                                  <span>• Accomplished: {session.result.accomplishment}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="schedule-session-actions">
                          {session.status === 'SCHEDULED' && (
                            <>
                              <button
                                type="button"
                                className="schedule-btn-engage"
                                onClick={() => handleStartFromSchedule(session.id)}
                              >
                                <Icon name="play" size={13} />
                                <span>Engage Now</span>
                              </button>
                              <button
                                type="button"
                                className="schedule-btn-cancel"
                                onClick={() => handleCancelFromSchedule(session.id)}
                              >
                                Cancel
                              </button>
                            </>
                          )}

                          {(session.status === 'ACTIVE' || session.status === 'PAUSED') && (
                            <button
                              type="button"
                              className="schedule-btn-engage"
                              onClick={() => setActiveTab('Focus Engine')}
                            >
                              <span>Open focus</span>
                            </button>
                          )}

                          <button
                            type="button"
                            className="btn-icon-delete"
                            title="Delete Session"
                            onClick={() => handleDeleteSession(session.id)}
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="schedule-empty-box">
                  <div className="schedule-empty-icon"><Icon name="schedule" size={36} /></div>
                  <h3 className="schedule-empty-title">No Execution Blocks Scheduled</h3>
                  <p className="schedule-empty-desc">
                    Your cognitive capacity for this day is currently unallocated. Pre-commit to a focus block to protect your calendar and arm the Rust Shield.
                  </p>
                  <div className="schedule-empty-actions">
                    <button
                      type="button"
                      className="schedule-btn-book"
                      onClick={() => handleOpenBookingModal(selectedScheduleDate, 25, 'Classic Pomodoro')}
                    >
                      <Icon name="plus" size={14} />
                      <span>Book Sprint for {selectedScheduleDate}</span>
                    </button>
                    <button
                      type="button"
                      className="schedule-quick-btn"
                      onClick={() => handleOpenBookingModal(selectedScheduleDate, 50, 'Deep Work Sprint')}
                    >
                      50m Deep Work Preset
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==========================================================================
            C-027 DEVICE TASK MANAGER VIEW
            ========================================================================== */}
        {activeTab === 'Task Manager' && (
          <div className="task-manager-view">
            {/* Top Telemetry Grid */}
            <div className="tm-telemetry-grid">
              {/* CPU Metric Card */}
              <div className="tm-metric-card">
                <div className="tm-metric-top">
                  <span className="tm-metric-label">CPU LOAD</span>
                  <div className="tm-metric-icon">
                    <Icon name="focus" size={16} />
                  </div>
                </div>
                <div>
                  <div className="tm-metric-val">
                    {deviceSnapshot ? `${deviceSnapshot.systemInfo.systemCpuLoad.toFixed(1)}%` : '0%'}
                  </div>
                  <div className="tm-metric-sub">
                    {deviceSnapshot?.systemInfo.availableProcessors ?? 4} Hardware Threads Active
                  </div>
                  <div className="tm-bar-track">
                    <div
                      className="tm-bar-fill terracotta"
                      style={{
                        width: `${Math.min(100, Math.max(5, deviceSnapshot?.systemInfo.systemCpuLoad ?? 0))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Memory Metric Card */}
              <div className="tm-metric-card">
                <div className="tm-metric-top">
                  <span className="tm-metric-label">MEMORY USAGE</span>
                  <div className="tm-metric-icon">
                    <Icon name="apps" size={16} />
                  </div>
                </div>
                <div>
                  <div className="tm-metric-val">
                    {deviceSnapshot
                      ? `${(
                          (deviceSnapshot.systemInfo.totalMemoryBytes -
                            deviceSnapshot.systemInfo.freeMemoryBytes) /
                          (1024 * 1024 * 1024)
                        ).toFixed(1)} GB`
                      : '0 GB'}
                  </div>
                  <div className="tm-metric-sub">
                    {deviceSnapshot
                      ? `of ${(deviceSnapshot.systemInfo.totalMemoryBytes / (1024 * 1024 * 1024)).toFixed(1)} GB Physical RAM`
                      : 'Allocating'}
                  </div>
                  <div className="tm-bar-track">
                    <div
                      className="tm-bar-fill emerald"
                      style={{
                        width: deviceSnapshot
                          ? `${Math.round(
                              ((deviceSnapshot.systemInfo.totalMemoryBytes -
                                deviceSnapshot.systemInfo.freeMemoryBytes) /
                                deviceSnapshot.systemInfo.totalMemoryBytes) *
                                100,
                            )}%`
                          : '30%',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Process Count Metric Card */}
              <div className="tm-metric-card">
                <div className="tm-metric-top">
                  <span className="tm-metric-label">ACTIVE PROCESSES</span>
                  <div className="tm-metric-icon">
                    <Icon name="schedule" size={16} />
                  </div>
                </div>
                <div>
                  <div className="tm-metric-val">
                    {deviceSnapshot ? deviceSnapshot.systemInfo.processCount : '...'}
                  </div>
                  <div className="tm-metric-sub">
                    {deviceSnapshot?.processes.length ?? 0} Inspected in Viewport
                  </div>
                  <div className="tm-bar-track">
                    <div className="tm-bar-fill emerald" style={{ width: '100%' }} />
                  </div>
                </div>
              </div>

              {/* Sentinel Active Status Card */}
              <div className="tm-metric-card">
                <div className="tm-metric-top">
                  <span className="tm-metric-label">SHINPO SENTINEL</span>
                  <div className={`sentinel-radar-container ${sentinelStatus?.status === 'ACTIVE_DEFENSE' ? 'active-pulse' : ''}`}>
                    <div className="sentinel-radar-core" />
                    <div className="sentinel-radar-ring" />
                  </div>
                </div>
                <div>
                  <div
                    className="tm-metric-val"
                    style={{
                      fontSize: 18,
                      color: sentinelStatus?.status === 'ACTIVE_DEFENSE' ? 'var(--accent-coral, #FF4D5E)' : 'var(--accent-emerald)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span>{sentinelStatus ? sentinelStatus.status.replace('_', ' ') : 'ACTIVE DEFENSE'}</span>
                    <button
                      type="button"
                      className="sentinel-mode-badge"
                      title={sentinelStatus?.isPolicyLocked ? "Administrative Policy Gate Active: Click to request Emergency Override" : "Click to toggle mode: STRICT -> AUDIT_ONLY -> CONTAINMENT"}
                      onClick={handleToggleSentinelMode}
                    >
                      {sentinelStatus?.enforcementMode ?? 'STRICT'}
                    </button>
                    {sentinelStatus?.isPolicyLocked && (
                      <span className="sentinel-policy-locked-badge" title="Administrative Policy Gate Active: Mode locked during active focus sprint">
                        <Icon name="lock" size={11} />
                        <span>POLICY LOCKED</span>
                      </span>
                    )}
                  </div>
                  <div className="tm-metric-sub">
                    {sentinelStatus?.activeFocusSessionName
                      ? `Shielding: "${sentinelStatus.activeFocusSessionName}"`
                      : `${sentinelStatus?.totalInterceptedToday ?? 0} Distractions Intercepted Today`}
                  </div>
                  <div className="tm-bar-track">
                    <div
                      className={`tm-bar-fill ${sentinelStatus?.status === 'ACTIVE_DEFENSE' ? 'coral' : 'emerald'}`}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Notification Toast if present */}
            {tmToast && (
              <div
                style={{
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--accent-terracotta)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 18px',
                  color: 'var(--text-1)',
                  fontWeight: 600,
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <Icon name="sparkle" size={16} />
                <span>{tmToast}</span>
              </div>
            )}

            {/* Controls Bar */}
            <div className="tm-controls-card">
              <div className="tm-search-box">
                <Icon name="search" size={15} />
                <input
                  type="text"
                  className="tm-search-input"
                  placeholder="Filter processes by name, PID, or executable path..."
                  value={tmSearch}
                  onChange={(e) => {
                    setTmSearch(e.target.value)
                  }}
                />
              </div>

              <div className="tm-policy-filters">
                {(['ALL', 'ALLOWED', 'BLOCKED', 'PROTECTED'] as const).map((pol) => (
                  <button
                    key={pol}
                    type="button"
                    className={`tm-filter-chip ${tmPolicy === pol ? 'active' : ''}`}
                    onClick={() => {
                      setTmPolicy(pol)
                    }}
                  >
                    {pol}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="emergency-override-btn"
                onClick={() => {
                  setOverrideError(null)
                  setShowOverrideModal(true)
                }}
                title="Open Administrative Policy Gate to authorize emergency enforcement override"
              >
                <Icon name="shield" size={14} />
                <span>Emergency Override</span>
              </button>

              <button
                type="button"
                className="tm-refresh-btn btn-spring"
                onClick={handleSentinelSweep}
                disabled={sentinelSweeping}
                style={{
                  background: 'rgba(255, 77, 94, 0.12)',
                  borderColor: 'rgba(255, 77, 94, 0.35)',
                  color: 'var(--accent-coral, #FF4D5E)',
                }}
                title="Execute immediate distraction process sweep and containment"
              >
                <Icon name="sparkle" size={14} />
                <span>{sentinelSweeping ? 'Sweeping...' : '⚡ Sweep Distractions'}</span>
              </button>

              <button
                type="button"
                className="tm-refresh-btn btn-spring"
                onClick={() => setShowAddRuleModal(true)}
                title="Add new distraction application to quarantine blacklist"
              >
                <Icon name="plus" size={14} />
                <span>Block App</span>
              </button>

              <button
                type="button"
                className="tm-refresh-btn btn-spring"
                onClick={() => setTmRefreshKey((key) => key + 1)}
                disabled={tmLoading}
              >
                <Icon name="refresh" size={14} />
                <span>{tmLoading ? 'Scanning...' : 'Refresh Telemetry'}</span>
              </button>
            </div>

            {/* Sentinel Policy Rules & Live Quarantine Feed */}
            <div className="sentinel-panel">
              <div className="sentinel-panel-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon name="focus" size={16} />
                  <h3 className="sentinel-panel-title">Active Sentinel Rules & Quarantine Telemetry</h3>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  {sentinelRules.length} Custom Rules • Mode: <strong>{sentinelStatus?.enforcementMode ?? 'STRICT'}</strong>
                </div>
              </div>

              {/* Rules list */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.05em', marginBottom: 8 }}>
                  TARGETED DISTRACTION APPS & BLACKLIST
                </div>
                <div className="sentinel-rules-list">
                  {sentinelRules.length > 0 ? (
                    sentinelRules.map((rule) => (
                      <span key={rule.id} className={`sentinel-rule-chip ${rule.policyType.toLowerCase()}`}>
                        <span>{rule.policyType === 'BLOCKED' ? '🚫' : '✓'} {rule.processNamePattern}</span>
                        {rule.isCustom && (
                          sentinelStatus?.isPolicyLocked && rule.policyType === 'BLOCKED' ? (
                            <span
                              className="sentinel-rule-locked-indicator"
                              title="Locked by Administrative Policy Gate during active sprint. Click for policy info."
                              onClick={() => {
                                setTmToast('Administrative Policy Gate: Distraction rules are locked during active sprints. Use Emergency Override.')
                                setTimeout(() => setTmToast(null), 4000)
                              }}
                            >
                              <Icon name="lock" size={11} />
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="sentinel-rule-del-btn"
                              onClick={() => handleDeleteSentinelRule(rule.id, rule.processNamePattern)}
                              title="Remove rule"
                            >
                              ×
                            </button>
                          )
                        )}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      Default heuristics active (discord, steam, spotify, telegram, games, etc.)
                    </span>
                  )}
                </div>
              </div>

              {/* Recent Quarantines if any */}
              {sentinelStatus?.recentQuarantines && sentinelStatus.recentQuarantines.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.05em', marginBottom: 8 }}>
                    RECENT INTERCEPTION AUDIT LOG
                  </div>
                  <div className="sentinel-audit-timeline">
                    {sentinelStatus.recentQuarantines.map((item) => (
                      <div key={item.id} className="sentinel-audit-item">
                        <div className="sentinel-audit-left">
                          <span className="sentinel-audit-badge">{item.policyAction}</span>
                          <strong style={{ color: 'var(--text-1)' }}>{item.processName}</strong>
                          <span style={{ color: 'var(--text-3)' }}>(PID {item.pid})</span>
                        </div>
                        <div style={{ color: 'var(--text-2)', fontSize: 11 }}>
                          {item.reason}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sentinel Administrative Tamper Resistance & Audit Section */}
              <div className="sentinel-tamper-section">
                <div
                  className="sentinel-tamper-header"
                >
                  <div className="sentinel-tamper-title">
                    <Icon name="shield" size={15} />
                    <span>ADMINISTRATIVE AUDIT & TAMPER RESISTANCE FEED</span>
                    <span
                      className={`sentinel-tamper-badge-count ${
                        tamperEvents.length === 0 ? 'clean' : 'alert'
                      }`}
                    >
                      {tamperEvents.length === 0
                        ? '✓ Policy Secure'
                        : `⚠️ ${tamperEvents.length} Security Event${tamperEvents.length > 1 ? 's' : ''}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-expanded={tamperEventsExpanded}
                    onClick={() => setTamperEventsExpanded((prev) => !prev)}
                    title="Toggle administrative tamper audit events"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-3)',
                      cursor: 'pointer',
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span>{tamperEventsExpanded ? 'Collapse' : 'Expand Audit Log'}</span>
                    <Icon name={tamperEventsExpanded ? 'chevron' : 'chevron-right'} size={12} />
                  </button>
                </div>

                {tamperEventsExpanded && (
                  <div className="sentinel-tamper-timeline">
                    {tamperEventsLoading ? (
                      <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 0' }}>
                        Loading tamper audit logs...
                      </div>
                    ) : tamperEvents.length === 0 ? (
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--accent-emerald)',
                          padding: '10px 12px',
                          background: 'rgba(46, 213, 115, 0.05)',
                          borderRadius: 'var(--radius-sm, 8px)',
                          border: '1px solid rgba(46, 213, 115, 0.15)',
                        }}
                      >
                        ✓ Zero tamper attempts detected. Administrative policy boundary is intact and enforcing strictly.
                      </div>
                    ) : (
                      tamperEvents.map((evt) => (
                        <div key={evt.id} className="sentinel-tamper-item">
                          <div className="sentinel-tamper-item-top">
                            <div className="sentinel-tamper-item-left">
                              <span
                                className={`sentinel-severity-badge ${evt.severity.toLowerCase()}`}
                              >
                                {evt.severity}
                              </span>
                              <strong style={{ color: 'var(--text-1)' }}>
                                {evt.eventType.replace(/_/g, ' ')}
                              </strong>
                              <span style={{ color: 'var(--text-3)', fontSize: 11 }}>
                                [{evt.enforcementMode}]
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                              {new Date(evt.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </div>
                          </div>
                          {evt.justification && (
                            <div className="sentinel-tamper-justification">
                              <strong>Justification:</strong> {evt.justification}
                            </div>
                          )}
                          {evt.details && (
                            <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
                              {evt.details}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Add Rule Modal */}
            {showAddRuleModal && (
              <div className="quick-modal-overlay" onClick={() => setShowAddRuleModal(false)}>
                <div className="quick-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
                  <div className="quick-modal-header">
                    <h3 className="quick-modal-title">Block Application with Sentinel</h3>
                    <button type="button" className="quick-modal-close" onClick={() => setShowAddRuleModal(false)}>×</button>
                  </div>
                  <form onSubmit={handleAddSentinelRule} className="quick-modal-body">
                    <div className="quick-form-group">
                      <label className="quick-form-label">PROCESS NAME OR EXECUTABLE PATTERN</label>
                      <input
                        type="text"
                        className="quick-form-input"
                        placeholder="e.g. slack, minecraft, obs, brave"
                        value={newRulePattern}
                        onChange={(e) => setNewRulePattern(e.target.value)}
                        autoFocus
                        required
                      />
                      <span style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                        System core processes (systemd, shinpo, bash) are protected and cannot be quarantined.
                      </span>
                    </div>

                    <div className="quick-form-group">
                      <label className="quick-form-label">POLICY ACTION</label>
                      <select
                        className="quick-form-input"
                        value={newRuleType}
                        onChange={(e) => setNewRuleType(e.target.value as 'BLOCKED' | 'ALLOWED')}
                      >
                        <option value="BLOCKED">BLOCKED (Quarantine during active sprint)</option>
                        <option value="ALLOWED">ALLOWED (Whitelist / Bypass)</option>
                      </select>
                    </div>

                    <div className="quick-modal-actions">
                      <button
                        type="button"
                        className="quick-btn-cancel"
                        onClick={() => setShowAddRuleModal(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="quick-btn-submit"
                        disabled={!newRulePattern.trim()}
                      >
                        Add Policy Rule
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Administrative Policy Gate - Emergency Override Modal */}
            {showOverrideModal && (
              <div
                className="quick-modal-overlay"
                onClick={() => {
                  if (!overrideLoading) setShowOverrideModal(false)
                }}
              >
                <div
                  className="quick-modal-card"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    maxWidth: 500,
                    borderTop: '3px solid var(--accent-coral, #FF4D5E)',
                  }}
                >
                  <div className="quick-modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon name="shield" size={18} />
                      <h3 className="quick-modal-title" style={{ color: 'var(--accent-coral, #FF4D5E)' }}>
                        Administrative Policy Gate
                      </h3>
                    </div>
                    <button
                      type="button"
                      className="quick-modal-close"
                      onClick={() => {
                        if (!overrideLoading) setShowOverrideModal(false)
                      }}
                      disabled={overrideLoading}
                    >
                      ×
                    </button>
                  </div>

                  <form onSubmit={handleEmergencyOverrideSubmit} className="quick-modal-body">
                    <div className="override-modal-warning">
                      <strong>
                        <Icon name="lock" size={14} />
                        SPRINT ENFORCEMENT CONTAINMENT ACTIVE
                      </strong>
                      <span>
                        An active focus sprint is currently bound to strict distraction policy.
                        Disarming or downgrading Sentinel requires administrator password authentication and a mandatory logged justification for tamper-resistance audit integrity.
                      </span>
                    </div>

                    {overrideError && (
                      <div className="override-error-banner">
                        ⚠️ {overrideError}
                      </div>
                    )}

                    <div className="quick-form-group">
                      <label className="quick-form-label">DESIRED ENFORCEMENT MODE</label>
                      <select
                        className="quick-form-input"
                        value={overrideTargetMode}
                        onChange={(e) =>
                          setOverrideTargetMode(e.target.value as 'CONTAINMENT' | 'AUDIT_ONLY')
                        }
                        disabled={overrideLoading}
                      >
                        <option value="CONTAINMENT">
                          CONTAINMENT (Allow launch with warning logs)
                        </option>
                        <option value="AUDIT_ONLY">
                          AUDIT_ONLY (Passive telemetry monitoring only)
                        </option>
                      </select>
                    </div>

                    <div className="quick-form-group">
                      <label className="quick-form-label">ADMINISTRATIVE PASSWORD</label>
                      <input
                        type="password"
                        className="quick-form-input"
                        placeholder="Enter your administrative account password..."
                        value={overridePassword}
                        onChange={(e) => setOverridePassword(e.target.value)}
                        required
                        disabled={overrideLoading}
                        autoFocus
                      />
                    </div>

                    <div className="quick-form-group">
                      <label className="quick-form-label">
                        OVERRIDE JUSTIFICATION (MIN. 15 CHARACTERS)
                      </label>
                      <textarea
                        className="quick-form-input"
                        rows={3}
                        style={{ resize: 'vertical', minHeight: 70 }}
                        placeholder="State clear operational reason for breaking sprint policy (e.g. Urgent production release hotfix deployment)..."
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        required
                        disabled={overrideLoading}
                      />
                      <div
                        className={`override-char-counter ${
                          overrideReason.trim().length >= 15 ? 'valid' : 'invalid'
                        }`}
                      >
                        {overrideReason.trim().length} / 15 chars min
                      </div>
                    </div>

                    <div className="quick-modal-actions">
                      <button
                        type="button"
                        className="quick-btn-cancel"
                        onClick={() => setShowOverrideModal(false)}
                        disabled={overrideLoading}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="quick-btn-submit"
                        disabled={
                          overrideLoading ||
                          !overridePassword ||
                          overrideReason.trim().length < 15
                        }
                        style={{
                          background:
                            overrideReason.trim().length >= 15 && overridePassword
                              ? 'linear-gradient(135deg, #FF4D5E 0%, #D92B3E 100%)'
                              : undefined,
                          borderColor: '#FF4D5E',
                        }}
                      >
                        {overrideLoading ? 'Authenticating...' : 'Authorize & Execute Override'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Process Table Card */}
            <div className="tm-table-card">
              <div className="tm-table-header">
                <div>
                  <h3 className="tm-table-title">Live Process Table</h3>
                  <span className="tm-table-count">
                    Showing {deviceSnapshot?.processes.length ?? 0} processes on {deviceSnapshot?.systemInfo.deviceName || 'Local Device'}
                  </span>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="tm-table">
                  <thead>
                    <tr>
                      <th style={{ width: 80 }}>PID</th>
                      <th>Process / Application</th>
                      <th style={{ width: 110 }}>CPU (%)</th>
                      <th style={{ width: 130 }}>Memory</th>
                      <th style={{ width: 140 }}>Policy Status</th>
                      <th style={{ width: 130, textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deviceSnapshot && deviceSnapshot.processes.length > 0 ? (
                      deviceSnapshot.processes.map((proc: ProcessInfo, idx: number) => (
                        <tr key={proc.pid} className="proc-row-stagger" style={{ animationDelay: `${Math.min(idx * 0.02, 0.4)}s` }}>
                          <td>
                            <span className="tm-pid-badge">{proc.pid}</span>
                          </td>
                          <td>
                            <div className="tm-proc-name">
                              <span>{proc.name}</span>
                            </div>
                            {proc.executablePath && (
                              <div className="tm-proc-path" title={proc.executablePath}>
                                {proc.executablePath}
                              </div>
                            )}
                          </td>
                          <td>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                              {proc.cpuPercent > 0 ? `${proc.cpuPercent.toFixed(1)}%` : '< 0.1%'}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                              {proc.memoryBytes > 0
                                ? proc.memoryBytes > 1024 * 1024 * 1024
                                  ? `${(proc.memoryBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
                                  : `${Math.round(proc.memoryBytes / (1024 * 1024))} MB`
                                : '--'}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`tm-policy-badge ${
                                proc.shinpoPolicyState === 'ALLOWED'
                                  ? 'allowed'
                                  : proc.shinpoPolicyState === 'BLOCKED'
                                  ? 'blocked'
                                  : 'protected'
                              }`}
                            >
                              {proc.shinpoPolicyState === 'ALLOWED' && 'Allowed'}
                              {proc.shinpoPolicyState === 'BLOCKED' && 'Blocked'}
                              {proc.shinpoPolicyState === 'PROTECTED' && 'Protected'}
                              {proc.shinpoPolicyState === 'UNKNOWN' && 'Monitored'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {proc.canControl && proc.shinpoPolicyState !== 'PROTECTED' ? (
                              <button
                                type="button"
                                className="tm-btn-terminate btn-spring"
                                onClick={() => handleTerminateProcess(proc)}
                              >
                                Terminate
                              </button>
                            ) : (
                              <span className="tm-protected-label">
                                Protected
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: 36, color: 'var(--text-3)' }}>
                          {tmLoading ? 'Enumerating device processes...' : 'No matching processes found.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================================================
            C-003 ANALYTICS TAB VIEW
            ========================================================================== */}
        {activeTab === 'Analytics' && (
          <div className="analytics-view">
            {/* Top Metrics Row */}
            <div className="analytics-metrics-grid">
              {/* Metric 1: Focus Minutes & Hours */}
              <div className="analytics-card">
                <div className="tm-metric-top">
                  <span className="tm-metric-label">FOCUS TIME</span>
                  <div className="tm-metric-icon">
                    <Icon name="clock" size={16} />
                  </div>
                </div>
                <div className="tm-metric-val">
                  {analyticsData ? `${analyticsData.summary.totalFocusMinutes}m` : '0m'}
                </div>
                <div className="tm-metric-sub">
                  {analyticsData
                    ? `${(analyticsData.summary.totalFocusMinutes / 60).toFixed(1)} Hours Total Execution`
                    : 'Awaiting sessions'}
                </div>
              </div>

              {/* Metric 2: Sessions Completed */}
              <div className="analytics-card">
                <div className="tm-metric-top">
                  <span className="tm-metric-label">COMPLETION RATE</span>
                  <div className="tm-metric-icon">
                    <Icon name="check" size={16} />
                  </div>
                </div>
                <div className="tm-metric-val" style={{ color: 'var(--accent-emerald)' }}>
                  {analyticsData ? `${analyticsData.summary.completionRate}%` : '100%'}
                </div>
                <div className="tm-metric-sub">
                  {analyticsData
                    ? `${analyticsData.summary.sessionsCompleted} completed of ${
                        analyticsData.summary.sessionsCompleted + analyticsData.summary.sessionsStarted
                      } sessions`
                    : '100% target conversion'}
                </div>
              </div>

              {/* Metric 3: Strategic Missions */}
              <div className="analytics-card">
                <div className="tm-metric-top">
                  <span className="tm-metric-label">TARGET MISSIONS</span>
                  <div className="tm-metric-icon">
                    <Icon name="target" size={16} />
                  </div>
                </div>
                <div className="tm-metric-val">
                  {analyticsData
                    ? `${analyticsData.summary.missionsCompleted} / ${analyticsData.summary.missionsTotal}`
                    : '0 / 0'}
                </div>
                <div className="tm-metric-sub">
                  Strategic targets achieved
                </div>
              </div>

              {/* Metric 4: Average Quality & Streak */}
              <div className="analytics-card">
                <div className="tm-metric-top">
                  <span className="tm-metric-label">MOMENTUM & QUALITY</span>
                  <div className="tm-metric-icon">
                    <Icon name="sparkle" size={16} />
                  </div>
                </div>
                <div className="tm-metric-val" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{analyticsData ? analyticsData.summary.avgQuality.toFixed(1) : '5.0'}</span>
                  <span style={{ fontSize: 18, color: 'var(--accent-amber)' }}>★</span>
                </div>
                <div className="tm-metric-sub">
                  {analyticsData?.summary.currentStreak ?? 3}-Day Execution Streak
                </div>
              </div>
            </div>

            {/* 7-Day Velocity Interactive Bar Chart */}
            <div className="analytics-velocity-card">
              <div className="analytics-card-header">
                <div>
                  <h3 className="tm-table-title">7-Day Focus Velocity</h3>
                  <span className="tm-table-count">Daily deep-work minutes completed</span>
                </div>
                <button
                  type="button"
                  className="tm-refresh-btn btn-spring"
                  onClick={loadAnalytics}
                  disabled={analyticsLoading}
                >
                  <Icon name="refresh" size={14} />
                  <span>{analyticsLoading ? 'Calculating...' : 'Sync Velocity'}</span>
                </button>
              </div>

              <div className="analytics-chart-container">
                {analyticsData && analyticsData.weeklyVelocity.length > 0 ? (
                  (() => {
                    const maxMins = Math.max(...analyticsData.weeklyVelocity.map((v: DailyFocusVelocity) => v.focusMinutes), 60)
                    return analyticsData.weeklyVelocity.map((day: DailyFocusVelocity) => {
                      const pct = Math.max(day.focusMinutes > 0 ? 8 : 2, Math.round((day.focusMinutes / maxMins) * 100))
                      return (
                        <div key={day.date} className="analytics-bar-col">
                          <div className="analytics-bar-tooltip">
                            {day.focusMinutes}m • {day.completedCount} sessions
                          </div>
                          <div
                            className="analytics-bar bar-animated"
                            style={{
                              height: `${pct}%`,
                              background:
                                day.focusMinutes > 0
                                  ? 'linear-gradient(180deg, #FF9060 0%, #FF7A45 100%)'
                                  : 'var(--surface-hover)',
                            }}
                          />
                          <span className="analytics-day-label">{day.dayName}</span>
                        </div>
                      )
                    })
                  })()
                ) : (
                  <div style={{ width: '100%', textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>
                    Loading velocity metrics...
                  </div>
                )}
              </div>
            </div>

            {/* Recent Debrief Reflections Stream */}
            <div className="analytics-velocity-card">
              <div className="analytics-card-header">
                <div>
                  <h3 className="tm-table-title">Recent Session Debriefs</h3>
                  <span className="tm-table-count">Qualitative reflections & execution telemetry</span>
                </div>
              </div>

              <div className="analytics-debrief-list">
                {analyticsData && analyticsData.recentDebriefs.length > 0 ? (
                  analyticsData.recentDebriefs.map((deb: RecentDebrief) => (
                    <div key={deb.sessionId} className="analytics-debrief-card">
                      <div className="analytics-debrief-top">
                        <div className="analytics-debrief-title">{deb.sessionName}</div>
                        <div className="analytics-debrief-stars">
                          {Array.from({ length: deb.quality }).map((_, i) => (
                            <span key={i}>⭐</span>
                          ))}
                          <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 6 }}>
                            ({deb.durationMinutes}m)
                          </span>
                        </div>
                      </div>
                      {deb.accomplishment && (
                        <div style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 600 }}>
                          Output: {deb.accomplishment}
                        </div>
                      )}
                      {deb.reflectionNote && (
                        <div className="analytics-debrief-note">
                          "{deb.reflectionNote}"
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)' }}>
                    No debriefs recorded yet. Complete a focus session to review qualitative telemetry here.
                  </div>
                )}
              </div>
            </div>
          </div>
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
                Active telemetry streaming into SHINPO core. Switch to Dashboard, Goals, or Focus Engine for real-time controls.
              </p>
            </div>
          )}
      </main>

      {/* Post-Session Reflection Modal */}
      {completingSessionId && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3 className="modal-title">Session Debrief & Reflection</h3>
            <p className="modal-sub">
              Log your qualitative execution telemetry to calibrate future recommendations.
            </p>

            <form onSubmit={handleCompleteSubmit}>
              <div className="star-rating-row">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    type="button"
                    key={star}
                    className={`star-btn ${star <= completionQuality ? 'active' : ''}`}
                    onClick={() => setCompletionQuality(star)}
                  >
                    ⭐
                  </button>
                ))}
              </div>

              <input
                type="text"
                className="modal-field"
                placeholder="What concrete outcome was achieved?"
                value={accomplishment}
                onChange={(e) => setAccomplishment(e.target.value)}
                required
              />

              <textarea
                className="modal-field"
                rows={3}
                placeholder="Reflection notes: Any friction, distractions, or insights?"
                value={reflectionNotes}
                onChange={(e) => setReflectionNotes(e.target.value)}
              />

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center', marginTop: 18, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-timer secondary"
                  onClick={() => setCompletingSessionId(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-timer primary">
                  Record Outcome
                </button>
                <button
                  type="button"
                  className="btn-timer debrief-ai-btn"
                  onClick={(e) => handleCompleteSubmit(e, true)}
                  title="Save session debrief and trigger cognitive analysis with EONPAI"
                >
                  <Icon name="zap" size={13} />
                  <span>Record & Debrief with EONPAI ⚡</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Goal Modal */}
      {isCreatingGoal && (
        <div className="modal-overlay" onClick={() => setIsCreatingGoal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Define Strategic Objective</h3>
            <p className="modal-sub">
              Set a high-level outcome boundary. You can then let the AI partition it into actionable sprints.
            </p>

            <form onSubmit={handleCreateGoal}>
              <input
                type="text"
                placeholder="Goal Title (e.g. Master Distributed Systems)..."
                value={newGoalTitle}
                onChange={(e) => setNewGoalTitle(e.target.value)}
                className="modal-field"
                required
                autoFocus
              />

              <textarea
                placeholder="Outcome Definition / Measurable boundary (optional)..."
                value={newGoalDesc}
                onChange={(e) => setNewGoalDesc(e.target.value)}
                className="modal-field"
                rows={3}
              />

              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--text-3)',
                    marginBottom: 6,
                  }}
                >
                  Target Horizon Date
                </label>
                <input
                  type="date"
                  value={newGoalDate}
                  onChange={(e) => setNewGoalDate(e.target.value)}
                  className="modal-field"
                  style={{ marginBottom: 0 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn-timer secondary"
                  onClick={() => setIsCreatingGoal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-timer primary">
                  <Icon name="plus" size={14} />
                  <span>Establish Objective</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Goal Modal */}
      {editingGoal && (
        <div className="modal-overlay" onClick={() => setEditingGoal(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Edit Strategic Objective</h3>
            <p className="modal-sub">
              Modify the objective boundary, target horizon date, or lifecycle status.
            </p>

            <form onSubmit={handleUpdateGoalSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
                  Goal Title
                </label>
                <input
                  type="text"
                  value={editGoalTitle}
                  onChange={(e) => setEditGoalTitle(e.target.value)}
                  className="modal-field"
                  required
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
                  Outcome Definition / Boundary
                </label>
                <textarea
                  value={editGoalDesc}
                  onChange={(e) => setEditGoalDesc(e.target.value)}
                  className="modal-field"
                  rows={3}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
                    Target Horizon Date
                  </label>
                  <input
                    type="date"
                    value={editGoalTargetDate}
                    onChange={(e) => setEditGoalTargetDate(e.target.value)}
                    className="modal-field"
                    style={{ marginBottom: 0 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
                    Lifecycle Status
                  </label>
                  <select
                    className="modal-field"
                    style={{ marginBottom: 0 }}
                    value={editGoalStatus}
                    onChange={(e) => setEditGoalStatus(e.target.value)}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PAUSED">PAUSED</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn-timer secondary"
                  onClick={() => setEditingGoal(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-timer primary">
                  <Icon name="check" size={14} />
                  <span>Update Objective</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Mission Modal */}
      {editingMission && (
        <div className="modal-overlay" onClick={() => setEditingMission(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Edit Tactical Mission</h3>
            <p className="modal-sub">
              Update task scope, parent strategic goal, execution estimate, or state.
            </p>

            <form onSubmit={handleUpdateMissionSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
                  Target Strategic Goal
                </label>
                <select
                  className="modal-field"
                  style={{ marginBottom: 0 }}
                  value={editMissionGoalId ?? ''}
                  onChange={(e) => setEditMissionGoalId(Number(e.target.value))}
                  required
                >
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
                  Mission Title
                </label>
                <input
                  type="text"
                  value={editMissionTitle}
                  onChange={(e) => setEditMissionTitle(e.target.value)}
                  className="modal-field"
                  required
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
                  Mission Notes / Scope
                </label>
                <textarea
                  value={editMissionDesc}
                  onChange={(e) => setEditMissionDesc(e.target.value)}
                  className="modal-field"
                  rows={2}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
                    Scheduled Date
                  </label>
                  <input
                    type="date"
                    value={editMissionDate}
                    onChange={(e) => setEditMissionDate(e.target.value)}
                    className="modal-field"
                    style={{ marginBottom: 0 }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
                    Est. Minutes
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={480}
                    value={editMissionMinutes}
                    onChange={(e) => setEditMissionMinutes(Number(e.target.value))}
                    className="modal-field"
                    style={{ marginBottom: 0 }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
                    Status
                  </label>
                  <select
                    className="modal-field"
                    style={{ marginBottom: 0 }}
                    value={editMissionStatus}
                    onChange={(e) => setEditMissionStatus(e.target.value)}
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="IN_PROGRESS">IN PROGRESS</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn-timer secondary"
                  onClick={() => setEditingMission(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-timer primary">
                  <Icon name="check" size={14} />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Book Focus Sprint Modal (C-002) */}
      {isBookingSession && (
        <div className="modal-overlay" onClick={() => setIsBookingSession(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h3 className="modal-title">Book Temporal Focus Sprint</h3>
            <p className="modal-sub">
              Reserve a dedicated execution block on your timeline. The Rust shield will activate automatically when this block engages.
            </p>

            <form onSubmit={handleConfirmBookSession}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
                  Target Mission (Optional)
                </label>
                <select
                  className="modal-field"
                  value={bookMissionId ?? ''}
                  onChange={(e) => {
                    const id = e.target.value ? Number(e.target.value) : null
                    setBookMissionId(id)
                    const m = missions.find((item) => item.id === id)
                    if (m) {
                      setBookName(m.title)
                      setBookIntention(m.title)
                      if (m.estimatedMinutes) setBookDuration(m.estimatedMinutes)
                    }
                  }}
                >
                  <option value="">-- Ad-hoc / Standalone Execution Block --</option>
                  {missions
                    .filter((m) => m.status !== 'COMPLETED')
                    .map((m) => {
                      const g = goals.find((item) => item.id === m.goalId)
                      return (
                        <option key={m.id} value={m.id}>
                          {m.title} {g ? `(Goal: ${g.title})` : ''}
                        </option>
                      )
                    })}
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
                  Sprint Title / Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Deep Work Sprint / Refactoring Module..."
                  value={bookName}
                  onChange={(e) => setBookName(e.target.value)}
                  className="modal-field"
                  required
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
                  Execution Intention / Boundary
                </label>
                <input
                  type="text"
                  placeholder="What concrete output will be delivered?"
                  value={bookIntention}
                  onChange={(e) => setBookIntention(e.target.value)}
                  className="modal-field"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
                    Execution Date
                  </label>
                  <input
                    type="date"
                    value={bookDate}
                    onChange={(e) => setBookDate(e.target.value)}
                    className="modal-field"
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
                    Scheduled Time
                  </label>
                  <input
                    type="time"
                    value={bookTime}
                    onChange={(e) => setBookTime(e.target.value)}
                    className="modal-field"
                  />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
                  Execution Protocol Plan (Optional)
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  {pomodoroPlans.map((plan) => (
                    <button
                      type="button"
                      key={plan.name}
                      className={`auth-tab-btn ${bookPlanName === plan.name ? 'active' : ''}`}
                      style={{ padding: '6px 12px', fontSize: 12 }}
                      onClick={() => {
                        setBookPlanName(plan.name)
                        setBookDuration(plan.totalMinutes)
                        if (!bookName) setBookName(plan.name)
                      }}
                    >
                      {plan.name} ({plan.totalMinutes}m)
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`auth-tab-btn ${bookPlanName === null ? 'active' : ''}`}
                    style={{ padding: '6px 12px', fontSize: 12 }}
                    onClick={() => setBookPlanName(null)}
                  >
                    Custom Single Block
                  </button>
                </div>

                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
                  Duration Preset ({bookDuration} min)
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  {[15, 25, 30, 45, 50, 60, 90, 120].map((mins) => (
                    <button
                      type="button"
                      key={mins}
                      className={`auth-tab-btn ${bookDuration === mins ? 'active' : ''}`}
                      style={{ padding: '6px 12px', fontSize: 12 }}
                      onClick={() => setBookDuration(mins)}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
                <button
                  type="button"
                  className="btn-timer secondary"
                  onClick={() => setIsBookingSession(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-timer primary">
                  <Icon name="check" size={14} />
                  <span>Confirm Schedule</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {/* SHINPO Interactive Custom Cursor */}
      <CustomCursor />
    </div>
  )
}

export default App