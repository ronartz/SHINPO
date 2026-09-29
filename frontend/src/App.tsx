import { useEffect, useMemo, useState } from 'react'
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
import { decomposeGoal, sendAiChat } from './api/ai'
import type { GoalDecomposition, ProposedMission } from './api/ai'
import {
  completeMission,
  createGoal,
  createMission,
  deleteGoal,
  deleteMission,
  getGoals,
  getMissions,
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
import { ShinpoLogo } from './components/ShinpoLogo'

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
  | 'search'

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
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
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
    { role: 'user' | 'assistant'; text: string; missions?: ProposedMission[] }[]
  >([
    {
      role: 'assistant',
      text: 'SHINPO Strategic AI ready. Direct me with a prompt like "plan my day", "break down my goals", or "guide me".',
    },
  ])
  const [chatInput, setChatInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  // Goals & Missions Deck State
  const [goals, setGoals] = useState<Goal[]>([])
  const [missions, setMissions] = useState<Mission[]>([])
  const [isCreatingGoal, setIsCreatingGoal] = useState(false)
  const [newGoalTitle, setNewGoalTitle] = useState('')
  const [newGoalDesc, setNewGoalDesc] = useState('')
  const [newGoalDate, setNewGoalDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
  )
  const [decomposingGoalId, setDecomposingGoalId] = useState<number | null>(null)
  const [aiDecompResult, setAiDecompResult] = useState<GoalDecomposition | null>(null)
  const [missionsFilter, setMissionsFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL')
  const [flightDeckFilter, setFlightDeckFilter] = useState<'ALL' | 'SPRINT' | 'MILESTONES'>('ALL')
  const [topSearchQuery, setTopSearchQuery] = useState('')

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

  const getMissionCategory = (m: Mission) => {
    const goal = goals.find((g) => g.id === m.goalId)
    if (!goal) return 'TASK'
    const title = goal.title.toUpperCase()
    if (title.includes('DISTRIBUTED') || title.includes('ARCH')) return 'ARCH'
    if (title.includes('NEURAL') || title.includes('SIMD') || title.includes('PERF')) return 'PERF'
    if (title.includes('TELEMETRY') || title.includes('FLOW') || title.includes('EXECUTION')) return 'FLOW'
    if (title.includes('DATA') || title.includes('POSTGRES')) return 'DATA'
    if (title.includes('DEEP') || title.includes('PROTOCOL')) return 'CORE'
    const words = goal.title.trim().split(/\s+/)
    return (words[0] || 'TASK').slice(0, 4).toUpperCase()
  }

  const flightDeckMissions = useMemo(() => {
    return missions.filter((m) => {
      if (flightDeckFilter === 'SPRINT' && m.status === 'COMPLETED') return false
      if (flightDeckFilter === 'MILESTONES' && m.status !== 'COMPLETED') return false
      if (topSearchQuery.trim()) {
        const q = topSearchQuery.toLowerCase()
        const matchesTitle = m.title.toLowerCase().includes(q)
        const matchesDesc = (m.description || '').toLowerCase().includes(q)
        return matchesTitle || matchesDesc
      }
      return true
    })
  }, [missions, flightDeckFilter, topSearchQuery])

  const nextActionMission = useMemo(() => {
    return missions.find((m) => m.status !== 'COMPLETED') || null
  }, [missions])

  const nextActionGoal = useMemo(() => {
    if (!nextActionMission) return null
    return goals.find((g) => g.id === nextActionMission.goalId) || null
  }, [nextActionMission, goals])

  const todayCompletedSessions = useMemo(() => {
    return sessions.filter((s) => s.status === 'COMPLETED')
  }, [sessions])

  const todayCompletedMissions = useMemo(() => {
    return missions.filter((m) => m.status === 'COMPLETED')
  }, [missions])

  const todayUpcomingMissions = useMemo(() => {
    return missions.filter((m) => m.status !== 'COMPLETED')
  }, [missions])

  const weekDays = useMemo(() => {
    const now = new Date()
    const currentDayOfWeek = now.getDay() // 0 is Sun, 1 is Mon...
    const distanceToMonday = (currentDayOfWeek + 6) % 7
    const monday = new Date(now)
    monday.setDate(now.getDate() - distanceToMonday)

    const days = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const isToday = d.toDateString() === now.toDateString()
      days.push({
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: d.getDate(),
        dateStr: d.toISOString().split('T')[0],
        isToday,
        hasEvents: isToday && (todayCompletedSessions.length > 0),
      })
    }
    return days
  }, [todayCompletedSessions.length])

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
    fetchCurrentUser().then((user) => {
      if (user) {
        setCurrentUser(user)
        loadData()
      }
    })
  }, [])

  const loadData = async () => {
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
      const s = await getFocusSessions()
      setSessions(s)
    } catch {
      // Keep empty if backend offline
    }

    try {
      const [g, m] = await Promise.all([getGoals(), getMissions()])
      setGoals(g)
      setMissions(m)
    } catch {
      // Keep empty if backend offline
    }
  }

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
      await loadData()
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed')
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
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeconstructGoal = async (goalId: number) => {
    setDecomposingGoalId(goalId)
    try {
      const result = await decomposeGoal(goalId, dashboard?.user.id ?? 1)
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
      setAiDecompResult(null)
      loadData()
    } catch (err) {
      console.error(err)
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
    if (!window.confirm(`Delete tactical mission "${missionTitle}"?`)) {
      return
    }
    try {
      await deleteMission(missionId)
      setMissions((prev) => prev.filter((m) => m.id !== missionId))
      loadData()
    } catch (err) {
      console.error('Failed to delete mission:', err)
      alert('Could not delete mission. Please check server logs.')
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

  useEffect(() => {
    loadData()
  }, [])

  // Timer ticker
  const [timerNow, setTimerNow] = useState(Date.now())
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

  const handleCompleteSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!completingSessionId) return
    const userId = dashboard?.user.id ?? 1
    try {
      const res = await completeFocusSession(
        completingSessionId,
        userId,
        {
          quality: completionQuality,
          accomplishment,
          reflectionNote: reflectionNotes,
        },
      )
      setSessions((prev) => prev.map((s) => (s.id === completingSessionId ? res : s)))
      setCompletingSessionId(null)
      setAccomplishment('')
      setReflectionNotes('')
    } catch (err) {
      console.error(err)
    }
  }

  const handleAiSend = async (messageText?: string) => {
    const prompt = messageText || chatInput
    if (!prompt.trim()) return

    setChatMessages((prev) => [...prev, { role: 'user', text: prompt }])
    if (!messageText) setChatInput('')
    setAiLoading(true)

    try {
      const userId = dashboard?.user.id ?? 1
      const res = await sendAiChat(userId, prompt)
      let missions: ProposedMission[] = []
      if (Array.isArray(res.structuredCard)) {
        missions = res.structuredCard
      } else if (res.structuredCard?.proposedMissions) {
        missions = res.structuredCard.proposedMissions
      } else if (res.structuredCard?.planItems) {
        missions = res.structuredCard.planItems.map((item: any) => ({
          title: item.missionTitle,
          description: `${item.goalTitle} • Priority: ${item.priority}`,
          estimatedMinutes: item.durationMinutes,
        }))
      } else if (res.structuredCard?.missionTitle) {
        missions = [
          {
            title: res.structuredCard.missionTitle,
            description: res.structuredCard.recommendedAction ?? res.structuredCard.rationale ?? '',
            estimatedMinutes: res.structuredCard.estimatedMinutes ?? 25,
          },
        ]
      }

      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: res.reply,
          missions,
        },
      ])
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Tactical guidance: Partition your immediate bottleneck into 15m focus sprints to regain operational flow.',
          missions: [
            {
              title: 'Momentum execution sprint',
              description: 'Clear the highest priority pending item',
              estimatedMinutes: 15,
            },
          ],
        },
      ])
    } finally {
      setAiLoading(false)
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
              AUTHENTICATE
            </button>
            <button
              type="button"
              className={`auth-tab-btn ${authMode === 'REGISTER' ? 'active' : ''}`}
              onClick={() => {
                setAuthMode('REGISTER')
                setAuthError(null)
              }}
            >
              INITIALIZE CADET
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
                  placeholder="cadet@shinpo.local"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="auth-field-group">
              <label className="auth-label">Access Password</label>
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
              {authLoading ? 'VERIFYING CREDENTIALS...' : authMode === 'LOGIN' ? 'ENGAGE SYSTEM' : 'INITIALIZE PROFILE'}
            </button>

            {authMode === 'LOGIN' && (
              <button
                type="button"
                className="auth-quick-fill-btn"
                onClick={handleQuickDemoFill}
              >
                ⚡ Quick Fill (EONX / Dev Seed)
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

        <nav className="sidebar-nav-stack">
          {sidebarExpanded && (
            <div className="sidebar-section-header">
              <span>MAIN MENU</span>
              <Icon name="chevron" size={12} />
            </div>
          )}
          {[
            { id: 'Dashboard', icon: 'dashboard' as IconName, label: 'Dashboard' },
            { id: 'Focus Engine', icon: 'focus' as IconName, label: 'Focus Engine' },
            { id: 'Goals & Missions', icon: 'goals' as IconName, label: 'Goals & Missions' },
            { id: 'Schedule', icon: 'schedule' as IconName, label: 'Schedule', badge: 'New' },
            { id: 'Analytics', icon: 'analytics' as IconName, label: 'Analytics' },
          ].map((item) => (
            <button
              key={item.id}
              className={`sidebar-btn ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
              title={item.label}
              data-tooltip={item.label}
            >
              <Icon name={item.icon} size={18} />
              {sidebarExpanded && <span>{item.label}</span>}
              {sidebarExpanded && item.badge && (
                <span className="sidebar-nav-badge">{item.badge}</span>
              )}
              {sidebarExpanded && activeTab === item.id && (
                <span className="sidebar-active-arrow">↗</span>
              )}
            </button>
          ))}

          {sidebarExpanded && (
            <div className="sidebar-section-header" style={{ marginTop: 14 }}>
              <span>SYSTEM & CONTROLS</span>
              <Icon name="chevron" size={12} />
            </div>
          )}
          {[
            { id: 'AI Assistant', icon: 'sparkle' as IconName, label: 'AI Tactical' },
          ].map((item) => (
            <button
              key={item.id}
              className={`sidebar-btn ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
              title={item.label}
              data-tooltip={item.label}
            >
              <Icon name={item.icon} size={18} />
              {sidebarExpanded && <span>{item.label}</span>}
              {sidebarExpanded && activeTab === item.id && (
                <span className="sidebar-active-arrow">↗</span>
              )}
            </button>
          ))}
        </nav>

        {/* FitPulse Pro Card / Rust Protection Shield Card */}
        {sidebarExpanded && (
          <div className="sidebar-shield-card">
            <div className="shield-icon-badge">
              <Icon name="power" size={16} />
            </div>
            <div className="shield-card-title">Rust Focus Shield</div>
            <div className="shield-card-sub">
              Kernel Sentinel: PID Scan Active. Protects active focus sprints.
            </div>
            <button
              className={`shield-card-btn ${activeSession ? 'active' : ''}`}
              onClick={() => setActiveTab('Focus Engine')}
            >
              {activeSession ? 'Shield Active · Locked' : 'Shield Armed'}
            </button>
          </div>
        )}

        <div className="sidebar-footer">
          <button
            className="sidebar-btn"
            onClick={() => setIsDarkMode(!isDarkMode)}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            data-tooltip={isDarkMode ? 'Light Mode' : 'Dark Mode'}
          >
            <Icon name={isDarkMode ? 'sun' : 'moon'} size={18} />
            {sidebarExpanded && <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={`app-main ${sidebarExpanded ? 'sidebar-expanded' : ''}`}>
        {/* Clean Executive Top Bar — Single Navigation System */}
        <div className="cockpit-top-bar">
          <div className="page-header-info">
            <div className="page-breadcrumb">
              <span className="breadcrumb-root">SHINPO</span>
              <span className="breadcrumb-sep">/</span>
              <span className="breadcrumb-current">{activeTab}</span>
            </div>
            <h1 className="page-heading">
              {activeTab === 'Dashboard' && 'Executive Flight Deck'}
              {activeTab === 'Focus Engine' && 'Autonomous Focus Engine'}
              {activeTab === 'Goals & Missions' && 'Goals & Strategic Targets'}
              {activeTab === 'AI Assistant' && 'AI Tactical Command'}
              {activeTab === 'Schedule' && 'Temporal Execution Schedule'}
              {activeTab === 'Analytics' && 'Operational Velocity & Telemetry'}
            </h1>
          </div>

          {/* Academix / FitPulse Inspired Global Command Search */}
          <div className="top-search-command">
            <Icon name="search" size={15} />
            <input
              type="text"
              className="top-search-input"
              placeholder="Search missions, targets, protocols... (/ to filter)"
              value={topSearchQuery}
              onChange={(e) => setTopSearchQuery(e.target.value)}
            />
            <kbd className="top-search-kbd">⌘K</kbd>
          </div>

          <div className="top-bar-actions">
            <button
              className="action-btn-circle action-btn-add"
              onClick={() => setIsCreatingGoal(true)}
              title="Establish Strategic Objective"
            >
              <Icon name="plus" size={15} />
            </button>
            <div className="status-live-pill">
              <span className="live-dot" />
              <span className="live-text">SYSTEM ONLINE · LEVEL 1 ENFORCEMENT</span>
            </div>
            <button className="action-btn-circle" onClick={loadData} title="Refresh Telemetry">
              <Icon name="refresh" size={15} />
            </button>
            <button className="action-btn-circle has-badge" title="Notifications">
              <Icon name="bell" size={15} />
              <span className="bell-red-dot" />
            </button>
            <div className="profile-avatar-btn" title={`Signed in as ${currentUser.username} (${currentUser.email})`}>
              <div className="avatar-circle">
                {currentUser.username.charAt(0).toUpperCase()}
              </div>
              <span className="profile-name">
                {currentUser.username}
              </span>
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
        {/* Dynamic Tab Render: FitPulse 2-Tier Command Dashboard */}
        {activeTab === 'Dashboard' && (
          <div className="fitpulse-dashboard">
            {/* ROW 1: 8 / 4 ASYMMETRIC SPLIT */}
            <div className="fitpulse-row-upper">
              {/* Card 1 (Span 8): Autonomous Execution Cockpit & Temporal Radar */}
              <div className="fp-card fp-cockpit-card">
                <div className="fp-card-header">
                  <div className="fp-card-title-group">
                    <h2 className="fp-card-title">Autonomous Execution Cockpit</h2>
                  </div>
                  <div className="fp-header-actions">
                    <button className="fp-btn-subtle" onClick={loadData} title="Sync Telemetry">
                      <Icon name="refresh" size={13} />
                      <span>Telemetry Sync</span>
                    </button>
                    <button
                      className="action-btn-circle"
                      style={{ width: 30, height: 30 }}
                      onClick={() => setActiveTab('Focus Engine')}
                      title="Open Focus Engine HUD"
                    >
                      <Icon name="arrow-up-right" size={13} />
                    </button>
                  </div>
                </div>

                <div className="fp-cockpit-subbar">
                  <div className="fp-date-pill-group">
                    <span className="fp-dark-pill">Today</span>
                    <span className="fp-date-label">
                      {new Date().toLocaleDateString('en-US', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="fp-badge-dayview">
                    <Icon name="clock" size={13} />
                    <span>Day View</span>
                  </div>
                </div>

                {/* Focus Execution Controls: Active Running Session or Idle Standby */}
                {activeSession ? (
                  <div className="fp-active-execution">
                    <div className="fp-active-top-row">
                      <div className="fp-timer-display">{formatTimerDigits(timerSeconds)}</div>
                      <div className="fp-session-details">
                        <span className="fp-session-name">{activeSession.name}</span>
                        {activeSession.intention && (
                          <span className="fp-session-target">
                            🎯 Target: <strong>{activeSession.intention}</strong>
                          </span>
                        )}
                        <span className="fp-session-status-badge">
                          <span className="live-dot" />
                          <span>{activeSession.status} • PID SENTINEL ARMED</span>
                        </span>
                      </div>
                      <div className="fp-active-actions">
                        {activeSession.status === 'ACTIVE' && (
                          <button
                            className="btn-timer secondary"
                            onClick={() => handlePause(activeSession.id)}
                          >
                            <Icon name="pause" size={14} />
                            <span>Pause</span>
                          </button>
                        )}
                        {activeSession.status === 'PAUSED' && (
                          <button
                            className="btn-timer primary"
                            onClick={() => handleResume(activeSession.id)}
                          >
                            <Icon name="play" size={14} />
                            <span>Resume</span>
                          </button>
                        )}
                        <button
                          className="btn-timer primary"
                          onClick={() => setCompletingSessionId(activeSession.id)}
                        >
                          <Icon name="check" size={14} />
                          <span>Debrief</span>
                        </button>
                        <button
                          className="btn-timer danger"
                          onClick={() => handleDeleteSession(activeSession.id)}
                          title="Discard & Delete Current Session"
                        >
                          <Icon name="trash" size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="fp-progress-track">
                      <div
                        className="fp-progress-bar"
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
                  </div>
                ) : (
                  <div className="fp-idle-execution">
                    <div className="fp-idle-input-row">
                      <input
                        type="text"
                        className="fp-intention-input"
                        placeholder={
                          nextActionMission
                            ? `Target: ${nextActionMission.title}`
                            : 'Target Intention (e.g. Master Distributed Architecture)...'
                        }
                        value={sessionIntention}
                        onChange={(e) => setSessionIntention(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleStartSession()}
                      />
                      <div className="fp-presets-wrap">
                        {durationPresets.map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            className={`fp-preset-pill ${selectedDuration === mins ? 'active' : ''}`}
                            onClick={() => setSelectedDuration(mins)}
                          >
                            {mins}m
                          </button>
                        ))}
                      </div>
                      <button className="fp-btn-start" onClick={handleStartSession}>
                        <Icon name="play" size={14} />
                        <span>START FOCUS ({selectedDuration}m)</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Temporal Hourly Grid (Timeline) */}
                <div className="fp-temporal-grid">
                  <div className="fp-timeline-hours-track">
                    {[
                      '08:00',
                      '09:00',
                      '10:00',
                      '11:00',
                      '12:00',
                      '13:00',
                      '14:00',
                      '15:00',
                      '16:00',
                      '17:00',
                    ].map((time) => {
                      const isCurrentHour = time === '13:00'
                      return (
                        <div
                          key={time}
                          className={`fp-hour-marker ${isCurrentHour ? 'current-hour' : ''}`}
                        >
                          <span className="fp-hour-label">{time}</span>
                          <div className="fp-hour-line" />
                        </div>
                      )
                    })}
                  </div>

                  {/* Floating Execution Event Pills on the Temporal Grid */}
                  <div className="fp-events-plane">
                    {/* Active Session Event Pill */}
                    {activeSession ? (
                      <div className="fp-event-pill active-pill" style={{ left: '42%', top: '34px' }}>
                        <span className="fp-event-badge red">
                          ▶ {activeSession.durationMinutes || 45}m
                        </span>
                        <span className="fp-event-text">{activeSession.name}</span>
                        <div className="fp-event-mini-actions">
                          <button
                            className="fp-mini-chip"
                            onClick={() => setCompletingSessionId(activeSession.id)}
                            title="Debrief Outcome"
                          >
                            Debrief
                          </button>
                          <button
                            className="fp-mini-chip"
                            onClick={() => handlePause(activeSession.id)}
                            title="Pause"
                          >
                            Pause
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="fp-event-pill standby-pill" style={{ left: '42%', top: '34px' }}>
                        <span className="fp-event-badge red">STANDBY</span>
                        <span className="fp-event-text">Focus Engine Armed</span>
                      </div>
                    )}

                    {/* Completed Sessions */}
                    {todayCompletedSessions.length > 0 ? (
                      todayCompletedSessions.slice(0, 2).map((s, idx) => (
                        <div
                          key={s.id}
                          className="fp-event-pill completed-pill"
                          style={{
                            left: idx === 0 ? '6%' : '72%',
                            top: idx === 0 ? '8px' : '52px',
                          }}
                        >
                          <span className="fp-event-badge dark">✓ {s.durationMinutes}m</span>
                          <span className="fp-event-text">{s.name}</span>
                        </div>
                      ))
                    ) : (
                      <div className="fp-event-pill completed-pill" style={{ left: '6%', top: '8px' }}>
                        <span className="fp-event-badge dark">✓ 25m</span>
                        <span className="fp-event-text">Kernel Architecture Review</span>
                      </div>
                    )}

                    {/* Planned / Recommended Next Target */}
                    {nextActionMission && (
                      <div className="fp-event-pill planned-pill" style={{ left: '26%', top: '72px' }}>
                        <span className="fp-event-badge blue">
                          🎯 {nextActionMission.estimatedMinutes || 25}m
                        </span>
                        <span className="fp-event-text">{nextActionMission.title}</span>
                      </div>
                    )}
                  </div>

                  <div className="fp-grid-footer">
                    <button
                      className="fp-btn-add-item"
                      onClick={() => {
                        if (nextActionMission) {
                          setSessionIntention(nextActionMission.title)
                          setSelectedDuration(nextActionMission.estimatedMinutes || 25)
                        }
                        handleStartSession()
                      }}
                    >
                      <Icon name="plus" size={12} />
                      <span>Add Focus Sprint</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Card 2 (Span 4): Today's Schedule & Mission Queue */}
              <div className="fp-card fp-schedule-card">
                <div className="fp-card-header">
                  <div className="fp-card-title-group">
                    <h2 className="fp-card-title">Today's Schedule</h2>
                  </div>
                  <div className="fp-pill-dropdown">
                    <span>This Week</span>
                    <Icon name="chevron" size={12} />
                  </div>
                </div>

                {/* FitPulse 7-Day Pill Strip */}
                <div className="fp-week-strip">
                  {weekDays.map((d) => (
                    <div
                      key={d.dateStr}
                      className={`fp-day-pill ${d.isToday ? 'active-today' : ''}`}
                      title={`${d.dayName}, ${d.dateStr}`}
                    >
                      <span className="fp-day-num">{d.dayNum}</span>
                      <span className="fp-day-name">{d.dayName}</span>
                    </div>
                  ))}
                </div>

                {/* Schedule Item Rows */}
                <div className="fp-schedule-list">
                  {/* Active Session item if running */}
                  {activeSession && (
                    <div className="fp-schedule-item active">
                      <div className="fp-item-avatar core">CORE</div>
                      <div className="fp-item-info">
                        <div className="fp-item-title">{activeSession.name}</div>
                        <div className="fp-item-sub">
                          Active Now • {formatTimerDigits(timerSeconds)} remaining
                        </div>
                      </div>
                      <div className="fp-item-action-wrap">
                        <button
                          className="fp-item-action-circle running"
                          onClick={() => setCompletingSessionId(activeSession.id)}
                          title="Debrief & Complete"
                        >
                          <Icon name="check" size={12} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Completed sessions */}
                  {todayCompletedSessions.map((s) => (
                    <div key={`sched-s-${s.id}`} className="fp-schedule-item completed">
                      <div className="fp-item-avatar done">DONE</div>
                      <div className="fp-item-info">
                        <div className="fp-item-title line-through">{s.name}</div>
                        <div className="fp-item-sub">
                          {s.durationMinutes}m Deep Work • Logged
                        </div>
                      </div>
                      <div className="fp-item-action-wrap">
                        <div className="fp-item-action-circle done">
                          <Icon name="check" size={12} />
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Completed missions */}
                  {todayCompletedMissions.map((m) => (
                    <div key={`sched-m-done-${m.id}`} className="fp-schedule-item completed">
                      <div className="fp-item-avatar done">DONE</div>
                      <div className="fp-item-info">
                        <div className="fp-item-title line-through">{m.title}</div>
                        <div className="fp-item-sub">
                          {m.estimatedMinutes || 25}m Mission • Completed Today
                        </div>
                      </div>
                      <div className="fp-item-action-wrap">
                        <div className="fp-item-action-circle done">
                          <Icon name="check" size={12} />
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Upcoming Missions */}
                  {todayUpcomingMissions.slice(0, 4).map((m) => {
                    const cat = getMissionCategory(m)
                    return (
                      <div key={`sched-m-${m.id}`} className="fp-schedule-item">
                        <div className={`fp-item-avatar ${cat.toLowerCase()}`}>{cat}</div>
                        <div className="fp-item-info">
                          <div className="fp-item-title">{m.title}</div>
                          <div className="fp-item-sub">
                            {m.estimatedMinutes || 25}m Target • Next in Queue
                          </div>
                        </div>
                        <div className="fp-item-action-wrap">
                          <button
                            className="fp-item-action-circle play"
                            title="Engage Sprint"
                            onClick={() => {
                              setSelectedDuration(m.estimatedMinutes || 25)
                              setSessionIntention(m.title)
                              handleStartSession()
                            }}
                          >
                            <Icon name="play" size={11} />
                          </button>
                        </div>
                      </div>
                    )
                  })}

                  {!activeSession &&
                    todayCompletedSessions.length === 0 &&
                    todayCompletedMissions.length === 0 &&
                    todayUpcomingMissions.length === 0 && (
                      <div className="fp-empty-notice">
                        No schedule events queued today. Create a mission or start focus above!
                      </div>
                    )}
                </div>
              </div>
            </div>

            {/* ROW 2: 4 / 4 / 4 ASYMMETRIC SPLIT */}
            <div className="fitpulse-row-lower">
              {/* Card 3 (Span 4): Performance & Flow */}
              <div className="fp-card fp-perf-card">
                <div className="fp-card-header">
                  <div className="fp-card-title-group">
                    <h2 className="fp-card-title">Performance</h2>
                  </div>
                  <button
                    className="action-btn-circle"
                    style={{ width: 30, height: 30 }}
                    onClick={() => setActiveTab('Analytics')}
                    title="Full Telemetry & Analytics"
                  >
                    <Icon name="arrow-up-right" size={13} />
                  </button>
                </div>

                {/* 3-day switcher pills */}
                <div className="fp-perf-days-row">
                  {weekDays.slice(0, 3).map((d, i) => (
                    <div
                      key={d.dateStr}
                      className={`fp-perf-day-pill ${i === 1 ? 'selected' : ''}`}
                    >
                      <span className="fp-pday-name">{d.dayName}</span>
                      <span className="fp-pday-num">{d.dayNum}</span>
                    </div>
                  ))}
                </div>

                {/* Big Metric Display */}
                <div className="fp-perf-metrics">
                  <div className="fp-perf-stat-main">92%</div>
                  <div className="fp-perf-trend-wrap">
                    <span className="fp-trend-tag positive">+12%</span>
                    <span className="fp-trend-label">Since yesterday</span>
                  </div>
                </div>

                <button
                  className="fp-btn-next-action"
                  onClick={handleEngageNextAction}
                  title={nextActionGoal ? `Strategic Objective: ${nextActionGoal.title}` : 'Engage Focus Sprint'}
                >
                  <Icon name="play" size={12} />
                  <span>Engage Focus Sprint ↗</span>
                </button>

                <div className="fp-perf-cadence-row">
                  <div className="fp-cadence-item">
                    <span className="fp-cadence-val">22.3h</span>
                    <span className="fp-cadence-lbl">Weekly Flow</span>
                  </div>
                  <div className="fp-cadence-item">
                    <span className="fp-cadence-val">3.2h</span>
                    <span className="fp-cadence-lbl">Daily Mean</span>
                  </div>
                  <div className="fp-cadence-item">
                    <span className="fp-cadence-val green">96%</span>
                    <span className="fp-cadence-lbl">Focus Streak</span>
                  </div>
                </div>
              </div>

              {/* Card 4 (Span 4): Strategic Target Goals (Clean & elegant, NO overlapping circle!) */}
              <div className="fp-card fp-goals-card">
                <div className="fp-card-header">
                  <div className="fp-card-title-group">
                    <h2 className="fp-card-title">Strategic Goals</h2>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="action-btn-circle"
                      style={{ width: 30, height: 30 }}
                      onClick={() => setIsCreatingGoal(true)}
                      title="Add Strategic Goal"
                    >
                      <Icon name="plus" size={13} />
                    </button>
                    <button
                      className="action-btn-circle"
                      style={{ width: 30, height: 30 }}
                      onClick={() => setActiveTab('Goals & Missions')}
                      title="Strategic Horizons"
                    >
                      <Icon name="target" size={13} />
                    </button>
                  </div>
                </div>

                <div className="fp-goals-list">
                  {goals.length === 0 ? (
                    <div className="fp-empty-notice">
                      No strategic goals established. Create one to steer your execution horizon.
                    </div>
                  ) : (
                    goals.slice(0, 3).map((g) => {
                      const goalMissions = missions.filter((m) => m.goalId === g.id)
                      const completedCount = goalMissions.filter(
                        (m) => m.status === 'COMPLETED',
                      ).length
                      const totalCount = goalMissions.length
                      const pct =
                        totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

                      return (
                        <div key={g.id} className="fp-goal-card-item">
                          <div className="fp-goal-item-top">
                            <span className="fp-goal-item-title">{g.title}</span>
                            <span className="fp-goal-item-pct">{pct}%</span>
                          </div>
                          <div className="fp-goal-progress-track">
                            <div className="fp-goal-progress-bar" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="fp-goal-item-meta">
                            <span>
                              {completedCount}/{totalCount} Missions
                            </span>
                            <span>Target: {g.targetDate || 'Open Horizon'}</span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                <div className="fp-goals-footer">
                  <button
                    className="fp-btn-link"
                    onClick={() => setActiveTab('Goals & Missions')}
                  >
                    <span>View All Goals & Deconstruct</span>
                    <Icon name="arrow-up-right" size={12} />
                  </button>
                </div>
              </div>

              {/* Card 5 (Span 4): Operational Flight Deck */}
              <div className="fp-card fp-flightdeck-card">
                <div className="fp-card-header">
                  <div className="fp-card-title-group">
                    <h2 className="fp-card-title">Flight Deck Missions</h2>
                  </div>
                  <button
                    className="fp-btn-link-subtle"
                    onClick={() => setActiveTab('Goals & Missions')}
                  >
                    <span>View Details</span>
                    <Icon name="arrow-up-right" size={12} />
                  </button>
                </div>

                {/* Filter Chips */}
                <div className="fp-filter-chips">
                  {(['ALL', 'SPRINT', 'MILESTONES'] as const).map((chip) => (
                    <button
                      key={chip}
                      className={`fp-filter-chip ${flightDeckFilter === chip ? 'active' : ''}`}
                      onClick={() => setFlightDeckFilter(chip)}
                    >
                      {chip === 'ALL' ? 'All' : chip === 'SPRINT' ? 'Sprint' : 'Milestones'}
                    </button>
                  ))}
                </div>

                {/* Mission List */}
                <div className="fp-flightdeck-list">
                  {missions.length === 0 ? (
                    <div className="fp-empty-notice">
                      No missions initialized yet. Establish an objective in Goals & Missions.
                    </div>
                  ) : flightDeckMissions.length === 0 ? (
                    <div className="fp-empty-notice">
                      {flightDeckFilter === 'SPRINT'
                        ? 'All pending sprints completed!'
                        : 'No completed milestones yet.'}
                    </div>
                  ) : (
                    flightDeckMissions.slice(0, 5).map((m) => {
                      const isDone = m.status === 'COMPLETED'
                      const cat = getMissionCategory(m)

                      return (
                        <div key={m.id} className={`fp-mission-row ${isDone ? 'done' : ''}`}>
                          <div className="fp-mission-left">
                            <div className="fp-mission-title-box">
                              <span className={`fp-mission-name ${isDone ? 'line-through' : ''}`}>
                                {m.title}
                              </span>
                              <div className="fp-mission-tags">
                                <span className={`fp-cat-badge ${cat.toLowerCase()}`}>{cat}</span>
                                <span className="fp-time-badge">{m.estimatedMinutes || 25}m</span>
                              </div>
                            </div>
                          </div>
                          <div className="fp-mission-actions">
                            {!isDone && (
                              <button
                                className="fp-action-btn play"
                                title="Engage Focus Sprint"
                                onClick={() => {
                                  setSelectedDuration(m.estimatedMinutes || 25)
                                  setSessionIntention(m.title)
                                  handleStartSession()
                                }}
                              >
                                <Icon name="play" size={11} />
                              </button>
                            )}
                            <button
                              className={`fp-action-btn check ${isDone ? 'active' : ''}`}
                              title={isDone ? 'Completed' : 'Mark Complete (+25 XP)'}
                              onClick={() => handleToggleMissionComplete(m.id)}
                            >
                              <Icon name="check" size={12} />
                            </button>
                            <button
                              className="fp-action-btn delete"
                              title="Delete Mission"
                              onClick={() => handleDeleteMission(m.id, m.title)}
                            >
                              <Icon name="trash" size={12} />
                            </button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Focus Engine */}
        {activeTab === 'Focus Engine' && (
          <div className="bento-grid">
            {/* Running Timer HUD */}
            <div className="bento-card card-timer-hud">
              <div className="card-header-row">
                <div className="card-title-group">
                  <span className="card-title">Focus Engine HUD</span>
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
                    🎯 {activeSession?.intention || sessionIntention}
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
                  <button className="btn-timer primary" onClick={handleStartSession}>
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
                  <span className="card-title">Duration & Plan Architect</span>
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
                  Custom ✎
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
                  <span className="card-title">Focus Sprints Registry</span>
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
                                🎯 {sess.intention}
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

        {/* Tab 3: AI Tactical Assistant */}
        {activeTab === 'AI Assistant' && (
          <div className="ai-bento-container">
            <div className="ai-sidebar-card">
              <div className="card-header-row" style={{ margin: 0 }}>
                <span className="card-title">Tactical Directives</span>
                <Icon name="sparkle" size={18} />
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.5 }}>
                Issue natural commands or trigger direct strategic algorithms to structure your day.
              </p>

              {[
                { label: 'Plan My Execution Day', prompt: 'Plan my day with high-impact sessions' },
                { label: 'Decompose Top Goal', prompt: 'Break down my top goal into actionable steps' },
                { label: 'What is My Next Action?', prompt: 'Guide me on what I should do right now' },
                { label: 'Cognitive Reset / Stuck', prompt: 'I feel stuck and overwhelmed, guide me' },
              ].map((p, idx) => (
                <button
                  key={idx}
                  className="ai-preset-btn"
                  onClick={() => handleAiSend(p.prompt)}
                >
                  <span>{p.label}</span>
                  <Icon name="arrow-up-right" size={14} />
                </button>
              ))}
            </div>

            <div className="ai-chat-card">
              <div className="card-header-row">
                <span className="card-title">AI Command Stream</span>
                <span className="badge-tag green">Neural Ready</span>
              </div>

              <div className="ai-messages-feed">
                {chatMessages.map((msg, index) => (
                  <div key={index} className={`ai-bubble ${msg.role}`}>
                    <div>{msg.text}</div>
                    {msg.missions && msg.missions.length > 0 && (
                      <div className="ai-cards-row">
                        {msg.missions.map((m, mIdx) => (
                          <div key={mIdx} className="ai-mission-card">
                            <span style={{ fontWeight: 600 }}>{m.title}</span>
                            <span className="badge-tag blue">{m.estimatedMinutes}m</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {aiLoading && (
                  <div className="ai-bubble assistant" style={{ fontStyle: 'italic' }}>
                    Formulating tactical response...
                  </div>
                )}
              </div>

              <div className="ai-chat-input-bar">
                <input
                  type="text"
                  className="ai-input-field"
                  placeholder="Ask anything (e.g. 'hi', 'guide me', 'split my objective')..."
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
                          <span className={`badge-tag ${g.status === 'ACTIVE' ? 'green' : 'blue'}`}>
                            {g.status}
                          </span>
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
                        >
                          <Icon name="sparkle" size={13} />
                          <span>
                            {decomposingGoalId === g.id ? 'Deconstructing...' : 'AI Deconstruct'}
                          </span>
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Section 2: Tactical Missions Deck */}
            <div className="deck-section-header" style={{ marginTop: 12 }}>
              <div className="deck-section-title">
                <Icon name="target" size={18} />
                <span>Tactical Mission Queue</span>
              </div>
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
                            {parentGoal && <span>🎯 {parentGoal.title}</span>}
                            <span>• {m.estimatedMinutes || 25}m estimated</span>
                            <span>• {m.scheduledDate}</span>
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
                            <span>Engage Sprint</span>
                          </button>
                        )}
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
                              <span>Open HUD</span>
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
                  <div className="schedule-empty-icon">🗓️</div>
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
                      ⚡ 50m Deep Work Preset
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Other Views (Analytics, etc.) */}
        {activeTab !== 'Dashboard' &&
          activeTab !== 'Focus Engine' &&
          activeTab !== 'Goals & Missions' &&
          activeTab !== 'AI Assistant' &&
          activeTab !== 'Schedule' && (
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

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
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
                  Target Tactical Mission (Optional)
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
    </div>
  )
}

export default App