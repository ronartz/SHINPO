import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import {
  completeFocusSession,
  createFocusSession,
  getFocusSessions,
  pauseFocusSession,
  resumeFocusSession,
  startFocusSession,
} from './api/focusSessions'

import type { FocusSession } from './api/focusSessions'

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

type Theme = 'light' | 'dark'
type TimeFormat = '12h' | '24h'

type IconName =
  | 'dashboard'
  | 'quests'
  | 'schedule'
  | 'goals'
  | 'analytics'
  | 'focus'
  | 'apps'
  | 'journal'
  | 'rewards'
  | 'settings'
  | 'search'
  | 'bell'
  | 'moon'
  | 'sun'
  | 'chevron'
  | 'play'
  | 'pause'
  | 'check'
  | 'plus'
  | 'target'
  | 'clock'
  | 'xp'
  | 'close'

const USER_ID = 28

const durationPresets = [15, 30, 60, 90]

const navigation: { label: string; icon: IconName }[] = [
  { label: 'Dashboard', icon: 'dashboard' },
  { label: 'Quests', icon: 'quests' },
  { label: 'Schedule', icon: 'schedule' },
  { label: 'Goals', icon: 'goals' },
  { label: 'Analytics', icon: 'analytics' },
  { label: 'Focus Mode', icon: 'focus' },
  { label: 'App Control', icon: 'apps' },
  { label: 'Journal', icon: 'journal' },
  { label: 'Rewards', icon: 'rewards' },
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
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  switch (name) {
    case 'dashboard':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      )

    case 'quests':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="m8.5 12 2.3 2.3 4.8-5" />
        </svg>
      )

    case 'schedule':
      return (
        <svg {...common}>
          <rect x="3.5" y="5" width="17" height="15" rx="2" />
          <path d="M7.5 3v4M16.5 3v4M3.5 9h17" />
        </svg>
      )

    case 'goals':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="4.5" />
          <circle cx="12" cy="12" r="1.5" />
        </svg>
      )

    case 'analytics':
      return (
        <svg {...common}>
          <path d="M4 19V9M10 19V5M16 19v-8M22 19H2" />
        </svg>
      )

    case 'focus':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7v5l3.5 2" />
        </svg>
      )

    case 'apps':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      )

    case 'journal':
      return (
        <svg {...common}>
          <path d="M5 4h13a1 1 0 0 1 1 1v14H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
          <path d="M7 8h8M7 12h8M7 16h5" />
        </svg>
      )

    case 'rewards':
      return (
        <svg {...common}>
          <path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" />
          <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 12v5M8 21h8M10 17h4" />
        </svg>
      )

    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V20h-2.6v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1A1.7 1.7 0 0 0 8 15a1.7 1.7 0 0 0-1.5-1H6v-2.6h.1A1.7 1.7 0 0 0 7.6 10a1.7 1.7 0 0 0-.3-1.9l-.1-.1L9 6.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V5h2.6v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1A1.7 1.7 0 0 0 19.4 10a1.7 1.7 0 0 0 1.5 1h.1v2.6h-.1a1.7 1.7 0 0 0-1.5 1.4Z" />
        </svg>
      )

    case 'search':
      return (
        <svg {...common}>
          <circle cx="10.8" cy="10.8" r="6.8" />
          <path d="m16 16 5 5" />
        </svg>
      )

    case 'bell':
      return (
        <svg {...common}>
          <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
      )

    case 'moon':
      return (
        <svg {...common}>
          <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" />
        </svg>
      )

    case 'sun':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      )

    case 'chevron':
      return (
        <svg {...common}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      )

    case 'play':
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <path d="M8 5.5v13L18.5 12 8 5.5Z" />
        </svg>
      )

    case 'pause':
      return (
        <svg {...common}>
          <path d="M9 6v12M15 6v12" />
        </svg>
      )

    case 'check':
      return (
        <svg {...common}>
          <path d="m5 12 4.2 4.2L19 6.5" />
        </svg>
      )

    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      )

    case 'target':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="4.5" />
          <circle cx="12" cy="12" r="1" />
        </svg>
      )

    case 'clock':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7v5l3 2" />
        </svg>
      )

    case 'xp':
      return (
        <svg {...common}>
          <path d="m12 3 2.1 5.2L20 10l-5.2 2.1L12 17l-2.1-4.9L5 10l4.9-1.8L12 3Z" />
          <path d="m19 17 .7 1.8L21.5 19l-1.8.7L19 21l-.7-1.3-1.8-.7 1.8-.2L19 17Z" />
        </svg>
      )

    case 'close':
      return (
        <svg {...common}>
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      )

    default:
      return null
  }
}

function getGreeting() {
  const hour = new Date().getHours()

  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'

  return 'Good evening'
}

function formatDate() {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date())
}

function formatTime(format: TimeFormat) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: format === '12h',
  }).format(new Date())
}

function statusLabel(status: FocusSession['status']) {
  return status.toLowerCase()
}

function App() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [sessions, setSessions] = useState<FocusSession[]>([])

  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [actionId, setActionId] = useState<number | null>(null)

  const [error, setError] = useState<string | null>(null)

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('shinpo.sidebar.collapsed') === 'true'
  })

  const [theme, setTheme] = useState<Theme>(() => {
    return localStorage.getItem('shinpo.theme') === 'dark'
      ? 'dark'
      : 'light'
  })

  const [timeFormat, setTimeFormat] = useState<TimeFormat>(() => {
    return localStorage.getItem('shinpo.time.format') === '24h'
      ? '24h'
      : '12h'
  })

  const [currentTime, setCurrentTime] = useState(() =>
    formatTime(
      localStorage.getItem('shinpo.time.format') === '24h'
        ? '24h'
        : '12h',
    ),
  )

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [activeNavigation, setActiveNavigation] = useState('Dashboard')

  const [name, setName] = useState('')
  const [intention, setIntention] = useState('')
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [customDuration, setCustomDuration] = useState('')

  useEffect(() => {
    localStorage.setItem(
      'shinpo.sidebar.collapsed',
      String(sidebarCollapsed),
    )
  }, [sidebarCollapsed])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('shinpo.theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('shinpo.time.format', timeFormat)
  }, [timeFormat])

  useEffect(() => {
    const update = () => {
      setCurrentTime(formatTime(timeFormat))
    }

    update()

    const timer = window.setInterval(update, 1000)

    return () => window.clearInterval(timer)
  }, [timeFormat])

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        setError(null)

        const [dashboardResponse, sessionsResponse] =
          await Promise.all([
            fetch(`/api/dashboard/${USER_ID}`),
            getFocusSessions(USER_ID),
          ])

        if (!dashboardResponse.ok) {
          const body = await dashboardResponse.json().catch(() => null)

          throw new Error(
            body?.message ??
            `Dashboard request failed with status ${dashboardResponse.status}.`,
          )
        }

        const dashboardData =
          (await dashboardResponse.json()) as Dashboard

        setDashboard(dashboardData)
        setSessions(sessionsResponse)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load SHINPO.',
        )
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [])

  async function handleCreateSession(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!name.trim()) {
      setError('Give the focus session a name.')
      return
    }

    if (!Number.isFinite(durationMinutes) || durationMinutes < 1) {
      setError('Duration must be at least 1 minute.')
      return
    }

    if (durationMinutes > 1440) {
      setError('Maximum custom duration is 1440 minutes.')
      return
    }

    try {
      setCreating(true)
      setError(null)

      const session = await createFocusSession({
        userId: USER_ID,
        name: name.trim(),
        intention: intention.trim() || undefined,
        durationMinutes,
      })

      setSessions((current) => [session, ...current])

      setName('')
      setIntention('')
      setDurationMinutes(60)
      setCustomDuration('')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to create focus session.',
      )
    } finally {
      setCreating(false)
    }
  }

  async function handleSessionAction(
    session: FocusSession,
    action: 'start' | 'pause' | 'resume' | 'complete',
  ) {
    try {
      setActionId(session.id)
      setError(null)

      let updatedSession: FocusSession

      switch (action) {
        case 'start':
          updatedSession = await startFocusSession(session.id, USER_ID)
          break

        case 'pause':
          updatedSession = await pauseFocusSession(session.id, USER_ID)
          break

        case 'resume':
          updatedSession = await resumeFocusSession(session.id, USER_ID)
          break

        case 'complete':
          updatedSession = await completeFocusSession(
            session.id,
            USER_ID,
          )
          break
      }

      setSessions((current) =>
        current.map((currentSession) =>
          currentSession.id === updatedSession.id
            ? updatedSession
            : currentSession,
        ),
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Focus session action failed.',
      )
    } finally {
      setActionId(null)
    }
  }

  const completedSessions = useMemo(
    () =>
      sessions.filter(
        (session) => session.status === 'COMPLETED',
      ).length,
    [sessions],
  )

  const activeSessions = useMemo(
    () =>
      sessions.filter(
        (session) =>
          session.status === 'ACTIVE' ||
          session.status === 'PAUSED',
      ).length,
    [sessions],
  )

  const scheduledSessions = useMemo(
    () =>
      sessions.filter(
        (session) => session.status === 'SCHEDULED',
      ).length,
    [sessions],
  )

  const trackedMinutes = useMemo(
    () =>
      sessions.reduce(
        (total, session) =>
          total + session.durationMinutes,
        0,
      ),
    [sessions],
  )

  const completedMinutes = useMemo(
    () =>
      sessions
        .filter(
          (session) => session.status === 'COMPLETED',
        )
        .reduce(
          (total, session) =>
            total + session.durationMinutes,
          0,
        ),
    [sessions],
  )

  const completionRate = useMemo(() => {
    if (trackedMinutes === 0) {
      return 0
    }

    return Math.min(
      100,
      Math.round(
        (completedMinutes / trackedMinutes) * 100,
      ),
    )
  }, [trackedMinutes, completedMinutes])

  const latestSession = sessions[0] ?? null

  if (loading) {
    return (
      <main className="loading-screen">
        <div className="loading-logo">
          <span>SHIN</span>
          <b>PO</b>
        </div>

        <div className="loading-line" />

        <span>
          Initializing your execution system...
        </span>
      </main>
    )
  }

  if (!dashboard) {
    return (
      <main className="fatal-screen">
        <div className="fatal-card">
          <div className="brand-small">SHINPO</div>

          <div className="fatal-code">
            SYSTEM / LOAD FAILURE
          </div>

          <h1>Unable to load SHINPO.</h1>

          <p>
            {error ??
              'The dashboard could not be loaded.'}
          </p>

          <button
            type="button"
            className="primary-button compact"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </main>
    )
  }

  const username = dashboard.user.username
  const initials = username.slice(0, 1).toUpperCase()

  return (
    <main
      className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''
        }`}
    >
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand-block">
            <div className="brand-wordmark">
              <span>SHIN</span>
              <b>PO</b>
            </div>

            <div className="brand-japanese">進歩</div>

            <div className="brand-caption">
              BUILD A BETTER YOU.
            </div>
          </div>

          <button
            type="button"
            className="sidebar-toggle"
            aria-label={
              sidebarCollapsed
                ? 'Expand sidebar'
                : 'Collapse sidebar'
            }
            onClick={() =>
              setSidebarCollapsed((value) => !value)
            }
          >
            <Icon name="chevron" size={15} />
          </button>
        </div>

        <nav
          className="sidebar-nav"
          aria-label="Main navigation"
        >
          {navigation.map((item) => (
            <button
              type="button"
              key={item.label}
              className={`nav-item ${activeNavigation === item.label
                ? 'active'
                : ''
                }`}
              title={
                sidebarCollapsed
                  ? item.label
                  : undefined
              }
              onClick={() =>
                setActiveNavigation(item.label)
              }
            >
              <span className="nav-icon">
                <Icon name={item.icon} size={17} />
              </span>

              <span className="nav-label">
                {item.label}
              </span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            type="button"
            className={`nav-item ${settingsOpen ? 'active' : ''
              }`}
            title={
              sidebarCollapsed
                ? 'Settings'
                : undefined
            }
            onClick={() =>
              setSettingsOpen((value) => !value)
            }
          >
            <span className="nav-icon">
              <Icon name="settings" size={17} />
            </span>

            <span className="nav-label">
              Settings
            </span>
          </button>

          <div className="sidebar-motto">
            <span>Discipline today.</span>
            <strong>Freedom tomorrow.</strong>
          </div>
        </div>
      </aside>

      <section className="app-content">
        <header className="topbar">
          <div className="search-box">
            <Icon name="search" size={16} />

            <input
              type="search"
              placeholder="Search quests, goals, apps..."
              aria-label="Search"
            />
          </div>

          <div className="topbar-right">
            <button
              type="button"
              className="circle-button notification-button"
              aria-label="Notifications"
            >
              <Icon name="bell" size={17} />
              <span />
            </button>

            <div className="date-display">
              <strong>{formatDate()}</strong>
              <span>{currentTime}</span>
            </div>

            <button
              type="button"
              className="profile-button"
              onClick={() =>
                setSettingsOpen((value) => !value)
              }
            >
              <span className="profile-avatar">
                {initials}
              </span>

              <span className="profile-copy">
                <strong>{username}</strong>
                <small>Keep Going.</small>
              </span>

              <Icon name="chevron" size={13} />
            </button>

            <button
              type="button"
              className="circle-button"
              aria-label={
                theme === 'dark'
                  ? 'Switch to light mode'
                  : 'Switch to dark mode'
              }
              title={
                theme === 'dark'
                  ? 'Switch to light mode'
                  : 'Switch to dark mode'
              }
              onClick={() =>
                setTheme((value) =>
                  value === 'dark'
                    ? 'light'
                    : 'dark',
                )
              }
            >
              <Icon
                name={
                  theme === 'dark'
                    ? 'sun'
                    : 'moon'
                }
                size={17}
              />
            </button>
          </div>
        </header>

        <div className="page">
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>

              <button
                type="button"
                aria-label="Dismiss error"
                onClick={() => setError(null)}
              >
                <Icon name="close" size={15} />
              </button>
            </div>
          )}

          {activeNavigation !== 'Dashboard' ? (
            <section className="module-placeholder">
              <div className="module-icon">
                <Icon
                  name={
                    navigation.find(
                      (item) =>
                        item.label ===
                        activeNavigation,
                    )?.icon ?? 'dashboard'
                  }
                  size={28}
                />
              </div>

              <div className="eyebrow">
                SHINPO MODULE
              </div>

              <h1>{activeNavigation}</h1>

              <p>
                This module is part of the SHINPO
                execution system. Its backend slice
                will be connected when that feature
                reaches its implementation phase.
              </p>
            </section>
          ) : (
            <>
              <section className="hero">
                <div className="hero-copy">
                  <div className="eyebrow">
                    DASHBOARD / EXECUTION SYSTEM
                  </div>

                  <h1>
                    {getGreeting()},{' '}
                    <span>{username}</span>
                  </h1>

                  <p>
                    Here's what needs your
                    attention today.
                  </p>

                  <div className="system-status">
                    <span className="status-pulse" />
                    System ready
                  </div>
                </div>

                <div className="hero-orb">
                  <div className="orb-ring orb-ring-one" />
                  <div className="orb-ring orb-ring-two" />

                  <div className="orb-core">
                    <small>PROGRESS</small>
                    <strong>
                      {dashboard.progress.total}
                    </strong>
                    <span>events</span>
                  </div>
                </div>
              </section>

              <section className="stats-grid">
                <article className="stat-card">
                  <div className="stat-icon blue">
                    <Icon
                      name="quests"
                      size={18}
                    />
                  </div>

                  <div className="stat-content">
                    <span>MISSIONS</span>

                    <strong>
                      {dashboard.missions.total}
                    </strong>

                    <small>
                      {
                        dashboard.missions
                          .completed
                      }{' '}
                      completed ·{' '}
                      {
                        dashboard.missions
                          .pending
                      }{' '}
                      pending
                    </small>
                  </div>
                </article>

                <article className="stat-card">
                  <div className="stat-icon purple">
                    <Icon
                      name="target"
                      size={18}
                    />
                  </div>

                  <div className="stat-content">
                    <span>GOALS</span>

                    <strong>
                      {dashboard.goals.length}
                    </strong>

                    <small>
                      Active direction in your
                      system
                    </small>
                  </div>
                </article>

                <article className="stat-card">
                  <div className="stat-icon red">
                    <Icon
                      name="clock"
                      size={18}
                    />
                  </div>

                  <div className="stat-content">
                    <span>FOCUS SESSIONS</span>

                    <strong>
                      {sessions.length}
                    </strong>

                    <small>
                      {activeSessions} active ·{' '}
                      {completedSessions}{' '}
                      completed
                    </small>
                  </div>
                </article>

                <article className="stat-card progress-stat">
                  <div className="stat-icon gradient">
                    <Icon name="xp" size={18} />
                  </div>

                  <div className="stat-content">
                    <span>PROGRESS</span>

                    <strong>
                      {dashboard.progress.total}
                    </strong>

                    <small>
                      Recorded progress events
                    </small>
                  </div>
                </article>
              </section>

              <section className="workspace-grid">
                <article className="panel create-panel">
                  <div className="panel-heading">
                    <div>
                      <div className="eyebrow">
                        NEW SESSION
                      </div>

                      <h2>
                        Create Focus Session
                      </h2>

                      <p>
                        Turn intention into a
                        bounded execution block.
                      </p>
                    </div>

                    <div className="signal">
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>

                  <form
                    onSubmit={
                      handleCreateSession
                    }
                  >
                    <label>
                      Session name

                      <input
                        value={name}
                        onChange={(event) =>
                          setName(
                            event.target.value,
                          )
                        }
                        placeholder="e.g. NumPy Deep Work"
                        maxLength={150}
                        disabled={creating}
                      />
                    </label>

                    <label>
                      Intention

                      <textarea
                        value={intention}
                        onChange={(event) =>
                          setIntention(
                            event.target.value,
                          )
                        }
                        placeholder="What do you want to accomplish?"
                        rows={4}
                        disabled={creating}
                      />
                    </label>

                    <div className="field-label">
                      Duration
                    </div>

                    <div className="duration-grid">
                      {durationPresets.map(
                        (duration) => (
                          <button
                            type="button"
                            key={duration}
                            className={
                              durationMinutes ===
                                duration &&
                                customDuration === ''
                                ? 'duration active'
                                : 'duration'
                            }
                            onClick={() => {
                              setDurationMinutes(
                                duration,
                              )
                              setCustomDuration(
                                '',
                              )
                            }}
                            disabled={creating}
                          >
                            {duration}m
                          </button>
                        ),
                      )}

                      <button
                        type="button"
                        className={
                          customDuration !== ''
                            ? 'duration custom-duration-button active'
                            : 'duration custom-duration-button'
                        }
                        onClick={() => {
                          if (
                            customDuration ===
                            ''
                          ) {
                            setCustomDuration(
                              String(
                                durationMinutes,
                              ),
                            )
                          }
                        }}
                        disabled={creating}
                      >
                        Custom
                      </button>
                    </div>

                    {customDuration !== '' && (
                      <div className="custom-duration-row">
                        <div className="custom-duration-input">
                          <input
                            type="number"
                            min="1"
                            max="1440"
                            value={
                              customDuration
                            }
                            onChange={(event) => {
                              const value =
                                event.target
                                  .value

                              setCustomDuration(
                                value,
                              )

                              const parsed =
                                Number(value)

                              if (
                                Number.isFinite(
                                  parsed,
                                ) &&
                                parsed >= 1 &&
                                parsed <= 1440
                              ) {
                                setDurationMinutes(
                                  parsed,
                                )
                              }
                            }}
                            disabled={creating}
                            autoFocus
                            aria-label="Custom duration in minutes"
                          />

                          <span>
                            minutes
                          </span>
                        </div>

                        <span className="custom-duration-hint">
                          Set any duration from 1
                          to 1440 minutes.
                        </span>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="primary-button"
                      disabled={creating}
                    >
                      <span>
                        {creating
                          ? 'Creating...'
                          : 'Create Focus Session'}
                      </span>

                      <Icon
                        name="chevron"
                        size={14}
                      />
                    </button>
                  </form>
                </article>

                <article className="panel sessions-panel">
                  <div className="panel-heading">
                    <div>
                      <div className="eyebrow">
                        EXECUTION
                      </div>

                      <h2>
                        Your Focus Sessions
                      </h2>

                      <p>
                        Recent execution state
                        from SHINPO.
                      </p>
                    </div>

                    <span className="panel-count">
                      {sessions.length} total
                    </span>
                  </div>

                  {sessions.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">
                        <Icon
                          name="focus"
                          size={22}
                        />
                      </div>

                      <strong>
                        No focus sessions yet.
                      </strong>

                      <span>
                        Create your first bounded
                        execution block.
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="session-list">
                        {sessions.map((session) => {
                          const busy =
                            actionId ===
                            session.id

                          return (
                            <article
                              className={`session-card status-${statusLabel(
                                session.status,
                              )}`}
                              key={
                                session.id
                              }
                            >
                              <div className="session-state" />

                              <div className="session-body">
                                <div className="session-main">
                                  <div className="session-title">
                                    <h3>
                                      {
                                        session.name
                                      }
                                    </h3>

                                    <span className="session-status">
                                      {statusLabel(
                                        session.status,
                                      )}
                                    </span>
                                  </div>

                                  <p>
                                    {session.intention ||
                                      'No intention provided.'}
                                  </p>

                                  <small>
                                    {
                                      session.durationMinutes
                                    }{' '}
                                    minutes
                                  </small>
                                </div>

                                <div className="session-actions">
                                  {session.status ===
                                    'SCHEDULED' && (
                                      <button
                                        type="button"
                                        className="action primary"
                                        disabled={
                                          busy
                                        }
                                        onClick={() =>
                                          void handleSessionAction(
                                            session,
                                            'start',
                                          )
                                        }
                                      >
                                        <Icon
                                          name="play"
                                          size={11}
                                        />
                                        Start
                                      </button>
                                    )}

                                  {session.status ===
                                    'ACTIVE' && (
                                      <>
                                        <button
                                          type="button"
                                          className="action"
                                          disabled={
                                            busy
                                          }
                                          onClick={() =>
                                            void handleSessionAction(
                                              session,
                                              'pause',
                                            )
                                          }
                                        >
                                          <Icon
                                            name="pause"
                                            size={11}
                                          />
                                          Pause
                                        </button>

                                        <button
                                          type="button"
                                          className="action complete"
                                          disabled={
                                            busy
                                          }
                                          onClick={() =>
                                            void handleSessionAction(
                                              session,
                                              'complete',
                                            )
                                          }
                                        >
                                          <Icon
                                            name="check"
                                            size={11}
                                          />
                                          Complete
                                        </button>
                                      </>
                                    )}

                                  {session.status ===
                                    'PAUSED' && (
                                      <>
                                        <button
                                          type="button"
                                          className="action primary"
                                          disabled={
                                            busy
                                          }
                                          onClick={() =>
                                            void handleSessionAction(
                                              session,
                                              'resume',
                                            )
                                          }
                                        >
                                          <Icon
                                            name="play"
                                            size={11}
                                          />
                                          Resume
                                        </button>

                                        <button
                                          type="button"
                                          className="action complete"
                                          disabled={
                                            busy
                                          }
                                          onClick={() =>
                                            void handleSessionAction(
                                              session,
                                              'complete',
                                            )
                                          }
                                        >
                                          <Icon
                                            name="check"
                                            size={11}
                                          />
                                          Complete
                                        </button>
                                      </>
                                    )}

                                  {session.status ===
                                    'COMPLETED' && (
                                      <span className="completed-mark">
                                        <Icon
                                          name="check"
                                          size={13}
                                        />
                                        Done
                                      </span>
                                    )}
                                </div>
                              </div>
                            </article>
                          )
                        })}
                      </div>

                      <div className="focus-command">
                        <div className="focus-command-header">
                          <div>
                            <div className="eyebrow">
                              FOCUS COMMAND CENTER
                            </div>

                            <h3>
                              Execution overview
                            </h3>
                          </div>

                          <div className="focus-command-state">
                            <span
                              className={
                                activeSessions > 0
                                  ? 'state-dot live'
                                  : 'state-dot'
                              }
                            />

                            {activeSessions > 0
                              ? 'Session active'
                              : 'System ready'}
                          </div>
                        </div>

                        <div className="focus-metrics">
                          <div className="focus-metric">
                            <span>
                              TRACKED TIME
                            </span>

                            <strong>
                              {trackedMinutes >= 60
                                ? `${Math.floor(
                                  trackedMinutes / 60,
                                )}h ${trackedMinutes % 60
                                }m`
                                : `${trackedMinutes}m`}
                            </strong>

                            <small>
                              Across all sessions
                            </small>
                          </div>

                          <div className="focus-metric">
                            <span>
                              COMPLETED
                            </span>

                            <strong>
                              {completedMinutes >= 60
                                ? `${Math.floor(
                                  completedMinutes / 60,
                                )}h ${completedMinutes % 60
                                }m`
                                : `${completedMinutes}m`}
                            </strong>

                            <small>
                              Actual completed blocks
                            </small>
                          </div>

                          <div className="focus-metric">
                            <span>ACTIVE</span>

                            <strong>
                              {activeSessions}
                            </strong>

                            <small>
                              {scheduledSessions}{' '}
                              scheduled
                            </small>
                          </div>

                          <div className="focus-metric">
                            <span>
                              COMPLETION
                            </span>

                            <strong>
                              {completionRate}%
                            </strong>

                            <small>
                              Completed / tracked
                            </small>
                          </div>
                        </div>

                        <div className="focus-progress">
                          <div className="focus-progress-top">
                            <span>
                              Execution progress
                            </span>

                            <strong>
                              {completedMinutes} /{' '}
                              {trackedMinutes} min
                            </strong>
                          </div>

                          <div className="focus-progress-track">
                            <span
                              style={{
                                width: `${completionRate}%`,
                              }}
                            />
                          </div>
                        </div>

                        <div className="focus-bottom">
                          <div className="execution-principle">
                            <div className="principle-icon">
                              <Icon
                                name="target"
                                size={15}
                              />
                            </div>

                            <div>
                              <strong>
                                One session. One
                                intention.
                              </strong>

                              <span>
                                SHINPO turns planned
                                time into bounded
                                execution.
                              </span>
                            </div>
                          </div>

                          {latestSession && (
                            <div className="latest-session">
                              <span>
                                LATEST
                              </span>

                              <strong>
                                {
                                  latestSession.name
                                }
                              </strong>

                              <small>
                                {statusLabel(
                                  latestSession.status,
                                )}
                              </small>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </article>
              </section>

              <section className="panel goals-panel">
                <div className="panel-heading">
                  <div>
                    <div className="eyebrow">
                      DIRECTION
                    </div>

                    <h2>Goals</h2>

                    <p>
                      Your current direction and
                      the work attached to it.
                    </p>
                  </div>

                  <span className="panel-count">
                    {dashboard.goals.length}{' '}
                    active
                  </span>
                </div>

                {dashboard.goals.length === 0 ? (
                  <div className="empty-goals">
                    No goals have been created yet.
                  </div>
                ) : (
                  <div className="goal-list">
                    {dashboard.goals.map(
                      (goal) => (
                        <article
                          className="goal-row"
                          key={goal.id}
                        >
                          <div className="goal-icon">
                            <Icon
                              name="target"
                              size={17}
                            />
                          </div>

                          <div className="goal-info">
                            <strong>
                              {goal.title}
                            </strong>

                            <span>
                              {goal.status.toLowerCase()}
                            </span>
                          </div>

                          <div className="goal-track">
                            <span />
                          </div>

                          <div className="goal-percent">
                            48%
                          </div>
                        </article>
                      ),
                    )}
                  </div>
                )}
              </section>

              <footer className="product-loop">
                <span>GOAL</span>
                <i />
                <span>MISSION</span>
                <i />
                <span>SCHEDULE</span>
                <i />
                <strong>FOCUS SESSION</strong>
                <i />
                <span>ENFORCEMENT</span>
                <i />
                <span>EXECUTION</span>
                <i />
                <span>RESULT</span>
                <i />
                <span>PROGRESS</span>
                <i />
                <span>ANALYTICS</span>
                <i />
                <span>IMPROVEMENT</span>
                <i />
                <strong>NEXT ACTION</strong>
              </footer>
            </>
          )}
        </div>

        {settingsOpen && (
          <div className="settings-popover">
            <div className="settings-header">
              <div>
                <div className="eyebrow">
                  PREFERENCES
                </div>

                <h3>SHINPO Settings</h3>
              </div>

              <button
                type="button"
                className="settings-close"
                onClick={() =>
                  setSettingsOpen(false)
                }
                aria-label="Close settings"
              >
                <Icon
                  name="close"
                  size={15}
                />
              </button>
            </div>

            <div className="setting-row">
              <div>
                <strong>Appearance</strong>

                <span>
                  Choose your workspace theme.
                </span>
              </div>

              <div className="segmented">
                <button
                  type="button"
                  className={
                    theme === 'light'
                      ? 'selected'
                      : ''
                  }
                  onClick={() =>
                    setTheme('light')
                  }
                >
                  Light
                </button>

                <button
                  type="button"
                  className={
                    theme === 'dark'
                      ? 'selected'
                      : ''
                  }
                  onClick={() =>
                    setTheme('dark')
                  }
                >
                  Dark
                </button>
              </div>
            </div>

            <div className="setting-row">
              <div>
                <strong>Time format</strong>

                <span>
                  Used by the SHINPO clock.
                </span>
              </div>

              <div className="segmented">
                <button
                  type="button"
                  className={
                    timeFormat === '12h'
                      ? 'selected'
                      : ''
                  }
                  onClick={() =>
                    setTimeFormat('12h')
                  }
                >
                  12h
                </button>

                <button
                  type="button"
                  className={
                    timeFormat === '24h'
                      ? 'selected'
                      : ''
                  }
                  onClick={() =>
                    setTimeFormat('24h')
                  }
                >
                  24h
                </button>
              </div>
            </div>

            <div className="setting-row">
              <div>
                <strong>Sidebar</strong>

                <span>
                  Control navigation density.
                </span>
              </div>

              <button
                type="button"
                className="setting-action"
                onClick={() =>
                  setSidebarCollapsed(
                    (value) => !value,
                  )
                }
              >
                {sidebarCollapsed
                  ? 'Expand'
                  : 'Collapse'}
              </button>
            </div>

            <div className="settings-note">
              <Icon
                name="focus"
                size={14}
              />

              <span>
                SHINPO is being built as a Windows
                + Linux execution client. OS-level
                App Control will be provided by the
                platform agent, not by
                browser-only tricks.
              </span>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

export default App