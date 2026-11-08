import React, { useState, useMemo, useCallback } from 'react'
import { Box, Typography, Tooltip } from '@mui/material'
import type { Goal, Mission } from '../../api/goalsAndMissions'
import type { FocusSession } from '../../api/focusSessions'
import type { AnalyticsDashboardResponse } from '../../api/analytics'
import type { ProgressResponse } from '../../api/progress'
import type { SentinelStatus, SentinelWarningItem } from '../../api/device'
import type { AppView } from '../../types/navigation'
import type { AuthUser } from '../../api/auth'
import { AuroraCard } from '../components/AuroraCard'
import { Icon } from '../../components/common/Icon'
import { LiveClock } from '../../components/common/LiveClock'
import { formatTimerDigits } from '../../utils/focusTimer'

export interface AuroraDashboardViewProps {
  currentUser?: AuthUser | null
  missions: Mission[]
  goals: Goal[]
  sessions: FocusSession[]
  activeSession?: FocusSession | null
  sentinelStatus?: SentinelStatus | null
  analyticsData?: AnalyticsDashboardResponse | null
  progress?: ProgressResponse | null
  setActiveTab: (tab: AppView) => void
  handleArmMissionAsSession: (title: string, duration?: number) => void
  handleToggleMissionComplete: (id: number) => void
  handleDeleteMission?: (id: number, title: string) => void
  handleStartFromSchedule: (id: number) => void
  setIsCreatingQuickMission: (creating: boolean) => void
  setQuickMissionGoalId?: (goalId: number | null) => void
  nextActionMission?: Mission | null
  handleEngageNextAction?: () => void
  pendingWarning?: SentinelWarningItem | null
  activeGraceWarning?: SentinelWarningItem | null
  graceSecondsLeft?: number
  timerSeconds?: number
  handlePause?: (id: number) => void
  handleResume?: (id: number) => void
  setCompletingSessionId?: (id: number | null) => void
  topSearchQuery?: string
  setTopSearchQuery?: (query: string) => void
  isDarkMode?: boolean
  onNavigateToTasks?: (filter: 'ALL' | 'PENDING' | 'COMPLETED') => void
  onOpenAchievements?: () => void
}

import { trackMicrokitPointer } from '../../components/microkit/pointerGlow'
import { DashboardInsights } from '../../components/dashboard/DashboardInsights'
import { getDashboardTaskState } from '../../utils/dashboardTaskState'
import { formatCount } from '../../utils/pluralize'

import {
  getTodayScheduleSessions,
  getSessionSecondaryInfo,
  isMissionInFocusSession,
} from '../../utils/scheduleHelpers'

export const AuroraDashboardView: React.FC<AuroraDashboardViewProps> = ({
  currentUser,
  missions = [],
  goals = [],
  sessions = [],
  activeSession,
  analyticsData,
  progress: _progress,
  setActiveTab,
  onNavigateToTasks,
  handleArmMissionAsSession,
  handleToggleMissionComplete,
  handleDeleteMission,
  handleStartFromSchedule,
  setIsCreatingQuickMission,
  setQuickMissionGoalId,
  nextActionMission,
  handleEngageNextAction,
  pendingWarning,
  activeGraceWarning,
  graceSecondsLeft = 0,
  timerSeconds = 0,
  handlePause = () => { },
  handleResume = () => { },
  setCompletingSessionId = () => { },
  topSearchQuery = '',
  setTopSearchQuery,
  isDarkMode = true,
}) => {
  const [inspectingMission, setInspectingMission] = useState<Mission | null>(null)

  // 1. Goal lookup
  const goalMap = useMemo(() => {
    const map = new Map<number, Goal>()
    goals.forEach((g) => map.set(g.id, g))
    return map
  }, [goals])

  // 1.5 Symmetrical sorted schedule sessions
  const sortedScheduleSessions = useMemo(() => {
    return getTodayScheduleSessions(sessions, activeSession)
  }, [sessions, activeSession])

  // 2. Metrics calculation matching V1 exact formulas
  const totalMissionsCount = missions.length
  const completedMissionsCount = missions.filter((m) => m.status === 'COMPLETED').length
  const completedSessionsCount = sessions.filter((s) => s.status === 'COMPLETED').length
  const dashboardTaskState = getDashboardTaskState(missions)
  const velocityRate = totalMissionsCount > 0
    ? Math.round((completedMissionsCount / totalMissionsCount) * 100)
    : (analyticsData?.summary?.completionRate ? Math.round(analyticsData.summary.completionRate) : 0)

  const totalFocusMinutes = analyticsData?.summary?.totalFocusMinutes ??
    sessions.filter((s) => s.status === 'COMPLETED').reduce((acc, s) => acc + (s.durationMinutes || 0), 0)

  const focusTimeLabel = totalFocusMinutes >= 60
    ? `${Math.floor(totalFocusMinutes / 60)}h ${totalFocusMinutes % 60}m`
    : `${totalFocusMinutes}m`

  const hour = new Date().getHours()
  const greetingTime = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // 3. Search and split missions into V1 Kanban lanes: In Progress, Ready, Completed
  const q = (topSearchQuery || '').trim().toLowerCase()
  const searchFilter = useCallback((m: Mission) => {
    if (!q) return true
    return m.title.toLowerCase().includes(q) || (m.description && m.description.toLowerCase().includes(q))
  }, [q])

  const inProgM = useMemo(() => {
    return missions.filter((m) => {
      if (!searchFilter(m)) return false
      if (activeSession) {
        if (isMissionInFocusSession(m, activeSession)) return true
      }
      return m.status === 'IN_PROGRESS'
    })
  }, [missions, activeSession, searchFilter])

  const compM = useMemo(() => {
    return missions.filter((m) => m.status === 'COMPLETED' && searchFilter(m))
  }, [missions, searchFilter])

  const inProgIds = useMemo(() => new Set(inProgM.map((m) => m.id)), [inProgM])

  const pendM = useMemo(() => {
    return missions.filter((m) => m.status !== 'COMPLETED' && !inProgIds.has(m.id) && searchFilter(m))
  }, [missions, inProgIds, searchFilter])

  const displayInProgress = inProgM.length > 0 ? inProgM : (activeSession && pendM.length > 0 ? [pendM[0]] : [])
  const displayPending = displayInProgress.length > 0 && pendM.length > 0 && displayInProgress[0].id === pendM[0].id
    ? pendM.slice(1)
    : pendM

  const completedGoalIds = useMemo(
    () => new Set(goals.filter((goal) => goal.status === 'COMPLETED').map((goal) => goal.id)),
    [goals],
  )
  const firstActionableMission = missions.find(
    (mission) => mission.status !== 'COMPLETED' && !completedGoalIds.has(mission.goalId),
  ) || null

  // 4. Primary Featured Action Task
  const primaryActionTask = activeSession
    ? null
    : (nextActionMission || (displayPending.find((mission) => !completedGoalIds.has(mission.goalId)) || firstActionableMission))
  const primaryActionGoal = primaryActionTask ? goalMap.get(primaryActionTask.goalId) : null

  // 5. Render individual task card for the Kanban columns
  const renderTaskCard = (task: Mission) => {
    const parentGoal = goalMap.get(task.goalId)
    const isDone = task.status === 'COMPLETED'
    const isActive = isMissionInFocusSession(task, activeSession)

    return (
      <Box
        key={task.id}
        className="aurora-card-interactive aurora-tilt-lift"
        onClick={() => setInspectingMission(task)}
        sx={{
          p: '12px 14px',
          borderRadius: '10px',
          background: isDarkMode ? 'var(--brand-baltic-blue)' : '#ffffff',
          border: `1px solid ${isActive
            ? 'var(--brand-primary)'
            : isDone
              ? isDarkMode ? 'color-mix(in srgb, var(--brand-highlight) 20.0%, transparent)' : 'color-mix(in srgb, var(--brand-highlight) 25.0%, transparent)'
              : isDarkMode ? 'rgba(255,255,255, 0.08)' : 'color-mix(in srgb, var(--brand-highlight) 12.0%, transparent)'
            }`,
          boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0, 0.25)' : '0 2px 8px color-mix(in srgb, var(--brand-highlight) 4.0%, transparent)',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          cursor: 'pointer',
          transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        title="Click to view task details"
      >
        {/* Top row: Checkbox + Title */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.2 }}>
          <Box
            component="button"
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleToggleMissionComplete(task.id)
            }}
            sx={{
              width: 22,
              height: 22,
              minWidth: 22,
              borderRadius: '7px',
              border: `1.5px solid ${isDone ? 'var(--brand-primary)' : isDarkMode ? 'rgba(255,255,255, 0.2)' : '#a8a8a8'}`,
              background: isDone ? 'var(--brand-primary)' : 'transparent',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              p: 0,
              mt: 0.2,
              transition: 'all 0.15s ease',
              '&:hover': {
                borderColor: 'var(--brand-primary)',
              },
            }}
            title={isDone ? 'Completed (click to reopen)' : 'Mark task complete'}
            aria-label={isDone ? 'Completed' : 'Mark task complete'}
          >
            {isDone && <Icon name="check" size={13} />}
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{
                fontWeight: 600,
                fontSize: 14.5,
                lineHeight: 1.4,
                color: isDone ? 'text.secondary' : 'text.primary',
                textDecoration: isDone ? 'line-through' : 'none',
                wordBreak: 'break-word',
              }}
            >
              {task.title}
            </Typography>
          </Box>
        </Box>

        {/* Task description snippet if available */}
        {task.description && (
          <Typography
            sx={{
              color: 'text.secondary',
              fontSize: 13,
              lineHeight: 1.45,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              pl: 3.8,
            }}
          >
            {task.description}
          </Typography>
        )}

        {/* Bottom context row: Goal tag + Duration pill */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pt: 0.8,
            pl: 3.8,
            borderTop: `1px solid ${isDarkMode ? 'rgba(255,255,255, 0.05)' : 'color-mix(in srgb, var(--brand-highlight) 6.0%, transparent)'}`,
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          {parentGoal ? (
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.6,
                px: 1,
                py: 0.2,
                borderRadius: '6px',
                background: isDarkMode ? 'rgba(255,255,255, 0.06)' : 'color-mix(in srgb, var(--brand-highlight) 8.0%, transparent)',
                color: isDarkMode ? 'text.secondary' : 'var(--brand-primary)',
                fontSize: 12,
                fontWeight: 600,
                maxWidth: 160,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                '& > span': { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
              }}
              title={`Goal: ${parentGoal.title}`}
            >
              <Icon name="target" size={11} />
              <span>{parentGoal.title}</span>
            </Box>
          ) : (
            <span />
          )}

          <Box
            sx={{
              fontSize: 12,
              fontWeight: 700,
              px: 1,
              py: 0.2,
              borderRadius: '999px',
              background: isDone
                ? isDarkMode ? 'color-mix(in srgb, var(--brand-highlight) 16.0%, transparent)' : '#f1f1f1'
                : isDarkMode ? 'color-mix(in srgb, var(--brand-primary) 16.0%, transparent)' : '#d6d6d6',
              color: isDone ? 'var(--brand-primary)' : 'var(--brand-primary)',
              border: `1px solid ${isDone ? 'color-mix(in srgb, var(--brand-highlight) 30.0%, transparent)' : 'color-mix(in srgb, var(--brand-primary) 30.0%, transparent)'}`,
            }}
          >
            {isDone ? 'Done' : `${task.estimatedMinutes || 25}m`}
          </Box>
        </Box>
      </Box>
    )
  }

  return (
    <Box
      className="shinpo-dashboard"
      sx={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        gap: '14px',
        width: '100%',
        maxWidth: { xs: 1600, xl: 1680 },
        margin: '0 auto',
        pb: 4,
      }}
    >
      {/* =========================================================================
          1. DASHBOARD HEADER BAR: Greeting + Sentinel Pill + New Task + Live Clock
          ========================================================================= */}
      <Box
        className="dashboard-header-bar"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2.5,
          flexWrap: 'wrap',
          pt: 0.5,
          pb: 0.5,
        }}
        role="region"
        aria-label="Dashboard Overview"
      >
        {/* Left greeting block + actions */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              fontSize: { xs: 24, md: 28 },
              letterSpacing: '-0.03em',
              color: 'text.primary',
              lineHeight: 1.2,
            }}
          >
            Dashboard
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', fontSize: 15 }}>
            {greetingTime}, {currentUser?.username || 'EONX'} · Your focus. Your progress. All in one place.
          </Typography>

        </Box>

        {/* Right Live Clock Widget */}
        <Box sx={{ flexShrink: 0 }}>
          <LiveClock />
        </Box>
      </Box>

      {/* =========================================================================
          2. PERFORMANCE SUMMARY METRICS: 4 Symmetrical Balanced Cards
          ========================================================================= */}
      <Box
        className="dashboard-metrics-grid"
        onPointerMove={trackMicrokitPointer}
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(4, minmax(0, 1fr))',
          },
          gridAutoRows: '1fr',
          gap: '16px', // Exact V1 metrics grid gap
          width: '100%',
        }}
        aria-label="Performance Metrics"
      >
        {/* Metric 1: Active Goals */}
        <AuroraCard
          data-microkit-glow
          className="dashboard-metric-card microkit-glide-card"
          tiltVariant="lift"
          glass
          noPadding
          onClick={() => setActiveTab('Analytics')}
          sx={{
            p: '20px 22px',
            height: '100%',
            minHeight: 112,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 1.2,
          }}
          title="View focus activity"
          role="button"
          aria-label={`View focus activity: ${focusTimeLabel} focused`}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              setActiveTab('Analytics')
            }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography noWrap sx={{ minWidth: 0, fontSize: 13, fontWeight: 700, color: 'text.secondary' }}>
              Focus Time
            </Typography>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                background: 'color-mix(in srgb, var(--brand-highlight) 14.0%, transparent)',
                color: 'var(--brand-primary)',
                border: '1px solid color-mix(in srgb, var(--brand-highlight) 30.0%, transparent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="clock" size={17} />
            </Box>
          </Box>
          <Typography
            sx={{
              fontSize: 32,
              fontWeight: 800,
              color: 'text.primary',
              letterSpacing: '-0.03em',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.15,
            }}
          >
            {focusTimeLabel}
          </Typography>
          <Typography sx={{ fontSize: 13.5, color: 'text.secondary', fontWeight: 500 }}>
            Total focus time
          </Typography>
        </AuroraCard>

        {/* Metric 2: Focus Logged */}
        <AuroraCard
          data-microkit-glow
          className="dashboard-metric-card microkit-glide-card"
          tiltVariant="lift"
          glass
          noPadding
          onClick={() => setActiveTab('Goals & Missions')}
          sx={{
            p: '20px 22px',
            height: '100%',
            minHeight: 112,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 1.2,
          }}
          title="View tasks and goals"
          role="button"
          aria-label={`View tasks: ${completedMissionsCount} of ${totalMissionsCount} completed`}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              setActiveTab('Goals & Missions')
            }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography noWrap sx={{ minWidth: 0, fontSize: 13, fontWeight: 700, color: 'text.secondary' }}>
              Tasks Completed
            </Typography>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                background: 'color-mix(in srgb, var(--brand-highlight) 14.0%, transparent)',
                color: 'var(--brand-primary)',
                border: '1px solid color-mix(in srgb, var(--brand-highlight) 30.0%, transparent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="focus" size={17} />
            </Box>
          </Box>
          <Typography
            sx={{
              fontSize: 32,
              fontWeight: 800,
              color: 'text.primary',
              letterSpacing: '-0.03em',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.15,
            }}
          >
            {completedMissionsCount} / {totalMissionsCount}
          </Typography>
          <Typography sx={{ fontSize: 13.5, color: 'text.secondary', fontWeight: 500 }}>
            {velocityRate}% completion rate
          </Typography>
        </AuroraCard>

        {/* Metric 3: Tasks in Queue */}
        <AuroraCard
          data-microkit-glow
          className="dashboard-metric-card microkit-glide-card"
          tiltVariant="lift"
          glass
          noPadding
          data-tutorial="metric-completion"
          onClick={() => setActiveTab('Schedule')}
          sx={{
            p: '20px 22px',
            height: '100%',
            minHeight: 112,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 1.2,
          }}
          title="View scheduled sessions"
          role="button"
          aria-label={`${sortedScheduleSessions.length} scheduled sessions today`}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              setActiveTab('Schedule')
            }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography noWrap sx={{ minWidth: 0, fontSize: 13, fontWeight: 700, color: 'text.secondary' }}>
              Planned sessions
            </Typography>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                background: 'color-mix(in srgb, var(--brand-highlight) 14.0%, transparent)',
                color: 'var(--brand-primary)',
                border: '1px solid color-mix(in srgb, var(--brand-highlight) 30.0%, transparent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="quests" size={17} />
            </Box>
          </Box>
          <Typography
            sx={{
              fontSize: 32,
              fontWeight: 800,
              color: 'text.primary',
              letterSpacing: '-0.03em',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.15,
            }}
          >
            {sortedScheduleSessions.length}
          </Typography>
          <Typography sx={{ fontSize: 13.5, color: 'text.secondary', fontWeight: 500 }}>
            Scheduled for today
          </Typography>
        </AuroraCard>

        {/* Metric 4: Task Completion Rate */}
        <AuroraCard
          data-microkit-glow
          className="dashboard-metric-card microkit-glide-card"
          tiltVariant="lift"
          glass
          noPadding
          sx={{
            p: '20px 22px',
            height: '100%',
            minHeight: 112,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 1.2,
          }}
          onClick={() => setActiveTab('Goals & Missions')}
          title="View open tasks"
          role="button"
          aria-label={`${dashboardTaskState.remaining} open tasks`}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              setActiveTab('Goals & Missions')
            }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography noWrap sx={{ minWidth: 0, fontSize: 13, fontWeight: 700, color: 'text.secondary' }}>
              Open tasks
            </Typography>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                background: 'color-mix(in srgb, var(--brand-primary) 14.0%, transparent)',
                color: 'var(--brand-primary)',
                border: '1px solid color-mix(in srgb, var(--brand-primary) 30.0%, transparent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="check-circle" size={17} />
            </Box>
          </Box>
          <Typography
            sx={{
              fontSize: 32,
              fontWeight: 800,
              color: 'text.primary',
              letterSpacing: '-0.03em',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.15,
            }}
          >
            {dashboardTaskState.remaining}
          </Typography>
          <Typography sx={{ fontSize: 13.5, color: 'text.secondary', fontWeight: 500 }}>
            {dashboardTaskState.total - dashboardTaskState.remaining} of {dashboardTaskState.total} completed
          </Typography>
        </AuroraCard>
      </Box>

      {/* =========================================================================
          3. COCKPIT GRID: Priority Hero Card (1.2fr) + Today's Schedule Card (1fr)
          ========================================================================= */}
      <Box
        className="dashboard-cockpit-grid"
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            lg: 'minmax(0, 1.2fr) minmax(0, 1fr)',
            xl: 'minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 0.9fr)',
          },
          gap: { xs: '18px', xl: '24px' },
          width: '100%',
          alignItems: 'stretch',
        }}
        aria-label="Dashboard"
      >
        {/* Left: Priority Hero Card */}
        <AuroraCard
          className={`priority-hero-card ${activeSession ? 'is-live' : 'is-ready'}`}
          tiltVariant="none"
          glass
          noPadding
          data-tutorial="cockpit-priority"
          sx={{
            p: '20px 22px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '100%',
            gap: 2,
          }}
          aria-label="Today's Priority"
        >
          {activeSession ? (
            /* Active Focus Sprint mode */
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Box
                    className={`priority-status-pill ${activeSession.status === 'PAUSED' ? 'is-paused' : 'is-live'}`}
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.8,
                      px: 1.4,
                      py: 0.5,
                      borderRadius: '999px',
                      background: activeSession.status === 'PAUSED'
                        ? 'var(--accent-yellow-subtle)'
                        : 'var(--brand-coral-subtle)',
                      color: activeSession.status === 'PAUSED'
                        ? 'var(--accent-yellow)'
                        : 'var(--brand-coral)',
                      border: activeSession.status === 'PAUSED'
                        ? '1px solid var(--accent-yellow-border)'
                        : '1px solid var(--brand-coral-border)',
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    <Box
                      aria-hidden="true"
                      sx={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        bgcolor: activeSession.status === 'PAUSED'
                          ? 'var(--accent-yellow)'
                          : 'var(--brand-coral)',
                        boxShadow: 'none',
                      }}
                    />
                    <span>{activeSession.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE FOCUS SPRINT'}</span>
                  </Box>

                  {activeGraceWarning && (
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.6,
                        px: 1.2,
                        py: 0.4,
                        borderRadius: '999px',
                        background: 'color-mix(in srgb, var(--brand-highlight) 15.0%, transparent)',
                        color: 'var(--brand-primary)',
                        border: '1px solid color-mix(in srgb, var(--brand-highlight) 30.0%, transparent)',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      <Icon name="clock" size={12} />
                      <span>Grace: {formatTimerDigits(graceSecondsLeft)} ({activeGraceWarning.processName})</span>
                    </Box>
                  )}

                  {pendingWarning && (
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        px: 1.2,
                        py: 0.4,
                        borderRadius: '999px',
                        background: 'color-mix(in srgb, var(--brand-primary) 15.0%, transparent)',
                        color: 'var(--brand-primary)',
                        border: '1px solid color-mix(in srgb, var(--brand-primary) 30.0%, transparent)',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      <span>Tamper Alert</span>
                    </Box>
                  )}
                </Box>

                <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'text.secondary' }}>
                  {activeSession.durationMinutes || 25}m Sprint
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                <Typography
                  className="priority-session-name"
                  variant="h5"
                  sx={{ fontWeight: 800, color: 'text.primary', lineHeight: 1.3 }}
                >
                  {activeSession.name}
                </Typography>
                {activeSession.intention && (
                  <Typography
                    className="priority-session-intention"
                    variant="body1"
                    sx={{ color: 'text.secondary', lineHeight: 1.5 }}
                  >
                    {activeSession.intention}
                  </Typography>
                )}
              </Box>

              {/* Timer Display */}
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, my: 0.5 }}>
                <Typography
                  className="priority-timer"
                  sx={{
                    fontSize: 42,
                    fontWeight: 900,
                    fontFamily: 'var(--font-family)',
                    letterSpacing: '-0.05em',
                    lineHeight: 1,
                    color: 'text.primary',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatTimerDigits(timerSeconds)}
                </Typography>
                <Typography sx={{ fontSize: 13, color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase' }}>
                  remaining
                </Typography>
              </Box>

              {/* Progress bar */}
              <Box sx={{ width: '100%', height: 7, borderRadius: 999, bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'color-mix(in srgb, var(--brand-primary) 10.0%, transparent)', overflow: 'hidden' }}>
                <Box
                  sx={{
                    height: '100%',
                    width: '100%',
                    transform: `scaleX(${Math.max(0, Math.min(1, (1 - timerSeconds / ((activeSession.durationMinutes || 25) * 60))))})`,
                    transformOrigin: 'left',
                    background: 'linear-gradient(90deg, var(--brand-coral), var(--accent-cyan))',
                    borderRadius: 999,
                    transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
              </Box>

              {/* Sprint action buttons */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mt: 0.5 }}>
                {activeSession.status === 'ACTIVE' && (
                  <button
                    className="aurora-btn-secondary"
                    onClick={() => handlePause(activeSession.id)}
                    title="Pause focus session"
                  >
                    <Icon name="pause" size={13} />
                    <span>Pause</span>
                  </button>
                )}
                {activeSession.status === 'PAUSED' && (
                  <button
                    className="aurora-btn-primary"
                    onClick={() => handleResume(activeSession.id)}
                    title="Resume focus session"
                  >
                    <Icon name="play" size={13} />
                    <span>Resume</span>
                  </button>
                )}
                <button
                  className="aurora-btn-primary"
                  onClick={() => setCompletingSessionId(activeSession.id)}
                  title="Complete and record summary"
                >
                  <Icon name="check" size={13} />
                  <span>Complete & Summarize</span>
                </button>
              </Box>
            </Box>
          ) : (
            /* Idle Priority Task Mode */
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
                <Box
                  className="priority-status-pill is-ready"
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.8,
                    px: 1.4,
                    py: 0.5,
                    borderRadius: '999px',
                    background: 'var(--brand-coral-subtle)',
                    color: 'var(--brand-coral)',
                    border: '1px solid var(--brand-coral-border)',
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  <Icon name="target" size={12} />
                  <span>Today's Priority</span>
                </Box>

                {primaryActionTask && (
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, fontSize: 13, fontWeight: 700, color: 'text.secondary' }}>
                    <Icon name="clock" size={12} />
                    <span>{primaryActionTask.estimatedMinutes || 25}m estimated</span>
                  </Box>
                )}
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {primaryActionTask ? (
                  <>
                    <Typography
                      variant="h5"
                      sx={{
                        fontWeight: 800,
                        fontSize: 22,
                        color: 'text.primary',
                        lineHeight: 1.3,
                        letterSpacing: '-0.02em',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {primaryActionTask.title}
                    </Typography>

                    <Typography
                      variant="body1"
                      sx={{
                        fontSize: 15,
                        color: 'text.secondary',
                        lineHeight: 1.5,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {primaryActionTask.description ||
                        'Ready for focused execution. Block distraction apps and start your timer.'}
                    </Typography>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5, flexWrap: 'wrap' }}>
                      <Box
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.6,
                          px: 1.2,
                          py: 0.4,
                          borderRadius: '8px',
                          background: isDarkMode ? 'rgba(255,255,255, 0.06)' : 'color-mix(in srgb, var(--brand-highlight) 8.0%, transparent)',
                          border: `1px solid ${isDarkMode ? 'rgba(255,255,255, 0.1)' : 'color-mix(in srgb, var(--brand-highlight) 16.0%, transparent)'}`,
                          color: 'text.primary',
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        <Icon name="target" size={12} />
                        <span>Goal: {primaryActionGoal?.title || 'Execution System'}</span>
                      </Box>
                      <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                        Scheduled for today
                      </Typography>
                    </Box>
                  </>
                ) : (
                  <>
                    <Typography variant="h5" sx={{ fontWeight: 800, fontSize: 22, color: 'text.primary' }}>
                      {dashboardTaskState.state === 'EMPTY' ? 'Nothing planned yet' : activeSession ? 'Focus session in progress' : dashboardTaskState.state === 'IN_PROGRESS' ? 'Open tasks need attention' : 'All planned tasks complete'}
                    </Typography>
                    <Typography variant="body1" sx={{ fontSize: 15, color: 'text.secondary' }}>
                      {dashboardTaskState.state === 'EMPTY'
                        ? 'Add a task to start planning your next step.'
                        : activeSession
                          ? `You have ${formatCount(dashboardTaskState.remaining, 'open task')}. Return to your current Focus session when you are ready.`
                          : dashboardTaskState.state === 'IN_PROGRESS'
                            ? `${formatCount(dashboardTaskState.remaining, 'task')} of ${dashboardTaskState.total} remain open. Review them in Goals & Tasks.`
                            : 'You have completed every task in your workspace.'}
                    </Typography>
                  </>
                )}
              </Box>

              {/* Action buttons row */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mt: 1 }}>
                {primaryActionTask ? (
                  <button
                    className="aurora-btn-primary microkit-pointer-glow"
                    data-microkit-glow
                    onPointerMove={trackMicrokitPointer}
                    onClick={() => {
                      if (handleEngageNextAction) {
                        handleEngageNextAction()
                      } else if (primaryActionTask) {
                        handleArmMissionAsSession(primaryActionTask.title, primaryActionTask.estimatedMinutes || undefined)
                      }
                    }}
                    title="Start focus session on this task"
                  >
                    <Icon name="play" size={14} />
                    <span>Start Focus Session</span>
                  </button>
                ) : (
                  <button
                    className="aurora-btn-primary"
                    onClick={() => {
                      if (goals.length > 0 && setQuickMissionGoalId) {
                        setQuickMissionGoalId(goals[0].id)
                      }
                      setIsCreatingQuickMission(true)
                    }}
                    title="Add new task"
                  >
                    <Icon name="plus" size={14} />
                    <span>Add New Task</span>
                  </button>
                )}

                <button
                  className="aurora-btn-secondary"
                  onClick={() => setActiveTab('Goals & Missions')}
                  title="Open Goals & Tasks"
                >
                  <span>View All Tasks</span>
                </button>
              </Box>
            </Box>
          )}
        </AuroraCard>

        {/* Right: Today's Schedule Card */}
        <AuroraCard
          className="schedule-card"
          tiltVariant="none"
          glass
          noPadding
          data-tutorial="todays-schedule-card"
          sx={{
            p: '20px 22px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            height: '100%',
            gap: 2,
          }}
          aria-label="Today's Schedule"
        >
          {/* Card Header: Icon + Title + Arrow to Schedule */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  background: 'var(--accent-blue-subtle)',
                  color: 'var(--color-primary)',
                  border: '1px solid var(--accent-blue-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="schedule" size={16} />
              </Box>
              <Typography variant="h6" sx={{ fontSize: 16.5, fontWeight: 700, color: 'text.primary' }}>
                Today's Schedule
              </Typography>
            </Box>

            <Tooltip title="Open Schedule">
              <Box
                component="button"
                onClick={() => setActiveTab('Schedule')}
                sx={{
                  background: 'transparent',
                  border: `1px solid ${isDarkMode ? 'rgba(255,255,255, 0.12)' : 'color-mix(in srgb, var(--brand-highlight) 20.0%, transparent)'}`,
                  borderRadius: '8px',
                  p: 0.6,
                  color: 'text.secondary',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    color: 'text.primary',
                    borderColor: 'var(--brand-primary)',
                  },
                }}
              >
                <Icon name="arrow-up-right" size={14} />
              </Box>
            </Tooltip>
          </Box>

          {/* Card Body: Renders sorted sessions with 3-column CSS Grid geometry */}
          <Box
            className="schedule-card-body"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              flex: 1,
              justifyContent: sortedScheduleSessions.length <= 1 ? 'center' : 'flex-start',
            }}
          >
            {sortedScheduleSessions.length > 0 ? (
              sortedScheduleSessions.slice(0, 4).map((s, idx) => {
                const isActive = s.status === 'ACTIVE' || s.status === 'PAUSED' || (activeSession && activeSession.id === s.id)
                const isDone = s.status === 'COMPLETED'
                const canStart = s.status === 'SCHEDULED' && !activeSession
                const secondaryInfo = getSessionSecondaryInfo(s)

                return (
                  <Box
                    key={s.id}
                    className="aurora-card-interactive aurora-tilt-lift"
                    onClick={() => {
                      if (canStart) void handleStartFromSchedule(s.id)
                    }}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '28px minmax(0, 1fr) 64px',
                      alignItems: 'center',
                      gap: 1.5,
                      p: '10px 14px',
                      borderRadius: '10px',
                      background: 'var(--surface-subtle)',
                      border: '1px solid var(--border)',
                      cursor: canStart ? 'pointer' : 'default',
                      transition: 'all 0.15s ease',
                    }}
                    title={`${s.name} — ${secondaryInfo}${canStart ? ' • Click to start' : ''}`}
                  >
                    {/* Fixed-width Col 1: Index / Status Box */}
                    <Box
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: '6px',
                        background: isDone
                          ? isDarkMode ? 'color-mix(in srgb, var(--brand-highlight) 16.0%, transparent)' : '#f1f1f1'
                          : s.status === 'PAUSED'
                            ? isDarkMode ? 'color-mix(in srgb, var(--brand-highlight) 16.0%, transparent)' : '#f5f5f5'
                            : isActive
                              ? isDarkMode ? 'color-mix(in srgb, var(--brand-highlight) 16.0%, transparent)' : '#dddddd'
                              : isDarkMode ? 'var(--brand-baltic-blue)' : '#ffffff',
                        border: `1px solid ${isDone
                          ? 'color-mix(in srgb, var(--brand-highlight) 30.0%, transparent)'
                          : s.status === 'PAUSED'
                            ? 'color-mix(in srgb, var(--brand-highlight) 35.0%, transparent)'
                            : isActive
                              ? 'color-mix(in srgb, var(--brand-highlight) 35.0%, transparent)'
                              : isDarkMode ? 'rgba(255,255,255, 0.1)' : 'color-mix(in srgb, var(--brand-highlight) 16.0%, transparent)'
                          }`,
                        color: isDone || s.status === 'PAUSED' || isActive
                          ? isDarkMode ? 'var(--brand-primary)' : 'var(--brand-deep)'
                          : 'text.secondary',
                        fontSize: 13,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isDone ? <Icon name="check" size={12} /> : s.status === 'PAUSED' ? <Icon name="pause" size={12} /> : isActive ? <Icon name="play" size={12} /> : idx + 1}
                    </Box>

                    {/* Flexible Col 2: Title + Distinct Secondary Details */}
                    <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.2 }}>
                      <Typography
                        sx={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: 'text.primary',
                          lineHeight: 1.35,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={s.name}
                      >
                        {s.name}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: 13,
                          color: 'text.secondary',
                          lineHeight: 1.25,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={secondaryInfo}
                      >
                        {secondaryInfo}
                      </Typography>
                    </Box>

                    {/* Fixed-width Col 3: Outcome / Action Badge */}
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: 64, minWidth: 0 }}>
                      <Box
                        sx={{
                          width: '100%',
                          textAlign: 'center',
                          px: 0.8,
                          py: 0.4,
                          borderRadius: '999px',
                          fontSize: 12,
                          fontWeight: 700,
                          background: isDone
                            ? isDarkMode ? 'color-mix(in srgb, var(--brand-highlight) 16.0%, transparent)' : '#f1f1f1'
                            : s.status === 'PAUSED'
                              ? isDarkMode ? 'color-mix(in srgb, var(--brand-highlight) 16.0%, transparent)' : '#f5f5f5'
                              : isActive
                                ? isDarkMode ? 'color-mix(in srgb, var(--brand-highlight) 16.0%, transparent)' : '#dddddd'
                                : isDarkMode ? 'color-mix(in srgb, var(--brand-highlight) 14.0%, transparent)' : '#e4e4e4',
                          color: 'var(--color-primary)',
                          border: `1px solid ${isDone
                            ? 'color-mix(in srgb, var(--brand-highlight) 30.0%, transparent)'
                            : s.status === 'PAUSED'
                              ? 'color-mix(in srgb, var(--brand-highlight) 35.0%, transparent)'
                              : isActive
                                ? 'color-mix(in srgb, var(--brand-highlight) 30.0%, transparent)'
                                : 'color-mix(in srgb, var(--brand-highlight) 28.0%, transparent)'
                            }`,
                          whiteSpace: 'nowrap',
                          boxSizing: 'border-box',
                        }}
                      >
                        {isDone ? 'Done' : s.status === 'PAUSED' ? 'Paused' : isActive ? 'Active' : `${s.durationMinutes}m`}
                      </Box>
                    </Box>
                  </Box>
                )
              })
            ) : (
              /* Compact empty state without excessive vertical whitespace */
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  py: 3,
                  textAlign: 'center',
                }}
              >
                <Icon name="schedule" size={24} />
                <Typography sx={{ color: 'text.secondary', fontSize: 13.5 }}>
                  No scheduled sessions today
                </Typography>
                <button
                  className="aurora-btn-secondary"
                  onClick={() => setActiveTab('Schedule')}
                  style={{ fontSize: '13px', padding: '6px 14px', borderRadius: '8px' }}
                >
                  + Schedule Focus Block
                </button>
              </Box>
            )}

            {/* Bottom Card Footer: Symmetrical anchor eliminating dead space */}
            <Box
              sx={{
                mt: 'auto',
                pt: 1.5,
                borderTop: `1px solid ${isDarkMode ? 'rgba(255,255,255, 0.07)' : 'color-mix(in srgb, var(--brand-highlight) 10.0%, transparent)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                flexWrap: 'wrap',
              }}
            >
              <Typography sx={{ fontSize: 13, color: 'text.secondary', fontWeight: 500 }}>
                {sortedScheduleSessions.length > 0 ? `${sortedScheduleSessions.length} total today` : 'Ready to plan'}
              </Typography>
              {sortedScheduleSessions.length > 0 && (
                <Box
                  component="button"
                  onClick={() => setActiveTab('Schedule')}
                  sx={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-primary)',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    p: 0,
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  + Schedule Focus Block
                </Box>
              )}
            </Box>
          </Box>
        </AuroraCard>

        <AuroraCard className="dashboard-rewards-summary" glass noPadding tiltVariant="none">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.3, height: '100%', p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Typography sx={{ fontSize: 15, fontWeight: 750 }}>Rewards &amp; Progress</Typography>
              <button type="button" className="dashboard-insight-link" onClick={() => setActiveTab('Rewards')}>
                View Rewards <Icon name="arrow-up-right" size={13} />
              </button>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ display: 'grid', placeItems: 'center', width: 44, height: 44, flex: '0 0 auto', borderRadius: 2, bgcolor: 'color-mix(in srgb, var(--brand-primary) 18%, transparent)', color: 'var(--brand-primary)' }}>
                <Icon name="target" size={22} />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                  <Typography sx={{ color: 'text.secondary', fontSize: 12.5, fontWeight: 650 }}>
                    {_progress ? `Level ${_progress.level} • ${_progress.levelTitle || 'Novice'}` : 'Execution Progress'}
                  </Typography>
                  {_progress && (
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-primary)' }}>
                      {_progress.totalProgress} XP
                    </Typography>
                  )}
                </Box>
                <Typography noWrap sx={{ fontSize: 15.5, fontWeight: 750 }}>
                  {totalMissionsCount > 0 ? `${completedMissionsCount} of ${totalMissionsCount} tasks complete` : 'Ready to begin work'}
                </Typography>
                <Typography sx={{ color: 'text.secondary', fontSize: 12 }}>
                  {totalMissionsCount > 0
                    ? `${goals.filter((goal) => goal.status.toUpperCase() !== 'COMPLETED').length} active goals · ${completedSessionsCount} focus sessions`
                    : 'Create your first goal & task to build progress'}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: _progress?.streak ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', gap: 1, p: 1.1, borderRadius: 1.5, bgcolor: 'color-mix(in srgb, var(--brand-primary) 6%, transparent)', border: '1px solid var(--border)' }}>
              <Box>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600 }}>Active Goals</Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 750 }}>{goals.filter((goal) => goal.status.toUpperCase() !== 'COMPLETED').length}</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600 }}>Focus Sessions</Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 750 }}>{completedSessionsCount}</Typography>
              </Box>
              {_progress?.streak && (
                <Box data-testid="dashboard-streak-tile">
                  <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600 }}>Streak</Typography>
                  <Typography sx={{ fontSize: 14, fontWeight: 750, color: _progress.streak.currentStreak > 0 ? 'var(--accent-orange, #f97316)' : 'inherit' }}>
                    {_progress.streak.currentStreak}d
                  </Typography>
                </Box>
              )}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, pt: 0.6, borderTop: '1px solid var(--border)' }}>
              <Typography sx={{ color: 'text.secondary', fontSize: 12.5, flexShrink: 0 }}>Next Milestone</Typography>
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand-primary)', textAlign: 'right', wordBreak: 'break-word' }}>
                First Step (0/1 tasks)
              </Typography>
            </Box>

            <Box sx={{ mt: 'auto', pt: 0.8, pb: 0.5 }}>
              <Box sx={{ height: 6, overflow: 'hidden', borderRadius: 99, bgcolor: 'color-mix(in srgb, var(--brand-primary) 16%, transparent)' }}>
                <Box sx={{ width: `${totalMissionsCount ? Math.min(100, Math.round((completedMissionsCount / totalMissionsCount) * 100)) : 0}%`, height: '100%', borderRadius: 'inherit', bgcolor: 'var(--brand-primary)' }} />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.8 }}>
                <Typography sx={{ color: 'text.secondary', fontSize: 11.5, fontWeight: 500 }}>
                  {totalMissionsCount > 0 ? `${Math.round((completedMissionsCount / totalMissionsCount) * 100)}% complete` : '0% complete'}
                </Typography>
                <Typography sx={{ color: 'text.secondary', fontSize: 11.5, fontWeight: 500 }}>
                  {totalMissionsCount > 0 ? `${totalMissionsCount - completedMissionsCount} open tasks` : '0 open tasks'}
                </Typography>
              </Box>
            </Box>
          </Box>
        </AuroraCard>
      </Box>

      {/* =========================================================================
          4. FULL-WIDTH TASKS BOARD: 3 Kanban Lanes (In Progress, Ready, Completed)
          ========================================================================= */}
      <Box
        className="flight-deck-board-panel"
        id="aurora-tasks-board"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          width: '100%',
          mt: 0.5,
        }}
        aria-label="Tasks Board"
      >
        {/* Header: Title + Summary Pills + Add Task Button */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography variant="h5" sx={{ fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em', color: 'text.primary' }}>
              Tasks Board
            </Typography>

            <Box
              sx={{
                px: 1.5,
                py: 0.4,
                borderRadius: '999px',
                background: isDarkMode ? 'color-mix(in srgb, var(--brand-highlight) 16.0%, transparent)' : '#e9e9e9',
                color: isDarkMode ? 'var(--brand-primary)' : 'var(--brand-primary)',
                border: '1px solid color-mix(in srgb, var(--brand-highlight) 30.0%, transparent)',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {displayInProgress.length + displayPending.length} in progress & ready
            </Box>

            <Box
              sx={{
                px: 1.5,
                py: 0.4,
                borderRadius: '999px',
                background: isDarkMode ? 'color-mix(in srgb, var(--brand-highlight) 16.0%, transparent)' : '#f1f1f1',
                color: isDarkMode ? 'var(--brand-primary)' : 'var(--brand-primary)',
                border: '1px solid color-mix(in srgb, var(--brand-highlight) 30.0%, transparent)',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {compM.length} completed
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {topSearchQuery && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  fontSize: 13,
                  color: 'text.secondary',
                  background: isDarkMode ? 'rgba(255,255,255, 0.05)' : 'rgba(0,0,0, 0.04)',
                  px: 1.4,
                  py: 0.5,
                  borderRadius: '8px',
                }}
              >
                <span>Filtering: "{topSearchQuery}"</span>
                <button
                  onClick={() => setTopSearchQuery?.('')}
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', padding: 0 }}
                  title="Clear filter"
                  aria-label="Clear filter"
                >
                  <Icon name="close" size={13} />
                </button>
              </Box>
            )}

            <button
              className="aurora-btn-primary"
              onClick={() => {
                if (goals.length > 0 && setQuickMissionGoalId) {
                  setQuickMissionGoalId(goals[0].id)
                }
                setIsCreatingQuickMission(true)
              }}
              style={{ padding: '8px 18px', fontSize: '13.5px' }}
              title="Add a new task"
            >
              <Icon name="plus" size={13} />
              <span>Add Task</span>
            </button>
          </Box>
        </Box>

        {/* 3-Column Kanban Grid */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
            gap: '20px', // Exact V1 board gap
            width: '100%',
            alignItems: 'stretch',
          }}
        >
          {/* Column 1: In Progress */}
          <AuroraCard
            tiltVariant="none"
            glass
            noPadding
            sx={{
              p: '18px 20px',
              minHeight: 180,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                pb: 1.5,
                mb: 2,
                borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255, 0.08)' : 'color-mix(in srgb, var(--brand-highlight) 12.0%, transparent)'}`,
                flexShrink: 0,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: 'var(--brand-primary)',
                    boxShadow: 'none',
                  }}
                />
                <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'text.primary' }}>
                  In Progress
                </Typography>
              </Box>
              <Box
                sx={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  px: 1.2,
                  py: 0.2,
                  borderRadius: '999px',
                  background: isDarkMode ? 'rgba(255,255,255, 0.06)' : 'color-mix(in srgb, var(--brand-highlight) 8.0%, transparent)',
                  color: 'text.secondary',
                }}
              >
                {displayInProgress.length}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2, flex: 1 }}>
              {displayInProgress.length > 0 ? (
                <>
                  {displayInProgress.slice(0, 3).map((t) => renderTaskCard(t))}
                  {displayInProgress.length > 3 && (
                    <Box
                      component="button"
                      type="button"
                      onClick={() => onNavigateToTasks ? onNavigateToTasks('PENDING') : setActiveTab('Goals & Missions')}
                      sx={{
                        mt: 1,
                        py: 1,
                        px: 1.5,
                        width: '100%',
                        borderRadius: '8px',
                        border: isDarkMode ? '1px dashed rgba(255,255,255, 0.16)' : '1px dashed color-mix(in srgb, var(--brand-highlight) 28.0%, transparent)',
                        background: isDarkMode ? 'rgba(255,255,255, 0.03)' : 'color-mix(in srgb, var(--brand-highlight) 4.0%, transparent)',
                        color: isDarkMode ? 'var(--brand-primary)' : 'var(--brand-primary)',
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          background: isDarkMode ? 'color-mix(in srgb, var(--brand-highlight) 12.0%, transparent)' : 'color-mix(in srgb, var(--brand-highlight) 8.0%, transparent)',
                          borderColor: 'var(--color-primary)',
                        },
                      }}
                    >
                      View {displayInProgress.length - 3} remaining {displayInProgress.length - 3 === 1 ? 'task' : 'tasks'} →
                    </Box>
                  )}
                </>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 3, my: 'auto', textAlign: 'center', gap: 1, flex: 1 }}>
                  <Box sx={{ width: 36, height: 36, borderRadius: '50%', background: isDarkMode ? 'rgba(255,255,255, 0.05)' : 'color-mix(in srgb, var(--brand-highlight) 8.0%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary', mb: 0.5 }}>
                    <Icon name="clock" size={16} />
                  </Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary' }}>
                    No active focus session
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', maxWidth: 240, lineHeight: 1.45 }}>
                    Select a ready task below or start your priority session.
                  </Typography>
                  {displayPending.length > 0 && (
                    <button
                      className="aurora-btn-secondary"
                      onClick={() => handleArmMissionAsSession(displayPending[0].title, displayPending[0].estimatedMinutes || 25)}
                      style={{ fontSize: '12px', padding: '6px 14px', marginTop: 8 }}
                    >
                      Start Next Focus Session
                    </button>
                  )}
                </Box>
              )}
            </Box>
          </AuroraCard>

          {/* Column 2: Ready */}
          <AuroraCard
            tiltVariant="none"
            glass
            noPadding
            sx={{
              p: '18px 20px',
              minHeight: 180,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                pb: 1.5,
                mb: 2,
                borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255, 0.08)' : 'color-mix(in srgb, var(--brand-highlight) 12.0%, transparent)'}`,
                flexShrink: 0,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: 'var(--brand-primary)',
                    boxShadow: 'none',
                  }}
                />
                <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'text.primary' }}>
                  Ready
                </Typography>
              </Box>
              <Box
                sx={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  px: 1.2,
                  py: 0.2,
                  borderRadius: '999px',
                  background: isDarkMode ? 'rgba(255,255,255, 0.06)' : 'color-mix(in srgb, var(--brand-highlight) 8.0%, transparent)',
                  color: 'text.secondary',
                }}
              >
                {displayPending.length}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2, flex: 1 }}>
              {displayPending.length > 0 ? (
                <>
                  {displayPending.slice(0, 3).map((t) => renderTaskCard(t))}
                  {displayPending.length > 3 && (
                    <Box
                      component="button"
                      type="button"
                      onClick={() => onNavigateToTasks ? onNavigateToTasks('PENDING') : setActiveTab('Goals & Missions')}
                      sx={{
                        mt: 1,
                        py: 1,
                        px: 1.5,
                        width: '100%',
                        borderRadius: '8px',
                        border: isDarkMode ? '1px dashed rgba(255,255,255, 0.16)' : '1px dashed color-mix(in srgb, var(--brand-highlight) 28.0%, transparent)',
                        background: isDarkMode ? 'rgba(255,255,255, 0.03)' : 'color-mix(in srgb, var(--brand-highlight) 4.0%, transparent)',
                        color: isDarkMode ? 'var(--brand-primary)' : 'var(--brand-primary)',
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          background: isDarkMode ? 'color-mix(in srgb, var(--brand-highlight) 12.0%, transparent)' : 'color-mix(in srgb, var(--brand-highlight) 8.0%, transparent)',
                          borderColor: 'var(--brand-primary)',
                        },
                      }}
                    >
                      View {displayPending.length - 3} remaining {displayPending.length - 3 === 1 ? 'task' : 'tasks'} →
                    </Box>
                  )}
                </>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 3, my: 'auto', textAlign: 'center', gap: 1, flex: 1 }}>
                  <Box sx={{ width: 36, height: 36, borderRadius: '50%', background: isDarkMode ? 'rgba(255,255,255, 0.05)' : 'color-mix(in srgb, var(--brand-highlight) 8.0%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary', mb: 0.5 }}>
                    <Icon name="target" size={16} />
                  </Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary' }}>
                    No tasks queued
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', maxWidth: 240, lineHeight: 1.45 }}>
                    Create a task to plan your next session.
                  </Typography>
                </Box>
              )}
            </Box>
          </AuroraCard>

          {/* Column 3: Completed */}
          <AuroraCard
            tiltVariant="none"
            glass
            noPadding
            data-tutorial="completed-column"
            sx={{
              p: '18px 20px',
              minHeight: 180,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                pb: 1.5,
                mb: 2,
                borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255, 0.08)' : 'color-mix(in srgb, var(--brand-highlight) 12.0%, transparent)'}`,
                flexShrink: 0,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: 'var(--brand-primary)',
                    boxShadow: 'none',
                  }}
                />
                <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'text.primary' }}>
                  Completed
                </Typography>
              </Box>
              <Box
                sx={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  px: 1.2,
                  py: 0.2,
                  borderRadius: '999px',
                  background: isDarkMode ? 'rgba(255,255,255, 0.06)' : 'color-mix(in srgb, var(--brand-highlight) 8.0%, transparent)',
                  color: 'text.secondary',
                }}
              >
                {compM.length}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2, flex: 1 }}>
              {compM.length > 0 ? (
                <>
                  {compM.slice(0, 3).map((t) => renderTaskCard(t))}
                  {compM.length > 3 && (
                    <Box
                      component="button"
                      type="button"
                      onClick={() => onNavigateToTasks ? onNavigateToTasks('COMPLETED') : setActiveTab('Goals & Missions')}
                      sx={{
                        mt: 1,
                        py: 1,
                        px: 1.5,
                        width: '100%',
                        borderRadius: '8px',
                        border: isDarkMode ? '1px dashed rgba(255,255,255, 0.16)' : '1px dashed color-mix(in srgb, var(--brand-highlight) 28.0%, transparent)',
                        background: isDarkMode ? 'rgba(255,255,255, 0.03)' : 'color-mix(in srgb, var(--brand-highlight) 4.0%, transparent)',
                        color: isDarkMode ? 'var(--brand-primary)' : 'var(--brand-primary)',
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          background: isDarkMode ? 'color-mix(in srgb, var(--brand-highlight) 12.0%, transparent)' : 'color-mix(in srgb, var(--brand-highlight) 8.0%, transparent)',
                          borderColor: 'var(--brand-primary)',
                        },
                      }}
                    >
                      View {compM.length - 3} remaining {compM.length - 3 === 1 ? 'task' : 'tasks'} →
                    </Box>
                  )}
                </>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 3, my: 'auto', textAlign: 'center', gap: 1, flex: 1 }}>
                  <Box sx={{ width: 36, height: 36, borderRadius: '50%', background: isDarkMode ? 'rgba(255,255,255, 0.05)' : 'color-mix(in srgb, var(--brand-highlight) 8.0%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary', mb: 0.5 }}>
                    <Icon name="check-circle" size={16} />
                  </Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary' }}>
                    No completed tasks yet
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', maxWidth: 240, lineHeight: 1.45 }}>
                    Finished tasks from your focus sessions will be logged here.
                  </Typography>
                </Box>
              )}
            </Box>
          </AuroraCard>

        </Box>
        <DashboardInsights analyticsData={analyticsData} setActiveTab={setActiveTab} showRecentSessions />
      </Box>

      {/* Task Details Modal */}
      {inspectingMission && (
        <Box
          onClick={() => setInspectingMission(null)}
          sx={{
            position: 'fixed',
            inset: 0,
            bgcolor: 'rgba(0,0,0, 0.65)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1300,
            p: 2,
          }}
        >
          <Box
            onClick={(e) => e.stopPropagation()}
            className="aurora-glass"
            sx={{
              width: '100%',
              maxWidth: 540,
              borderRadius: '20px',
              p: 3.5,
              display: 'flex',
              flexDirection: 'column',
              gap: 2.5,
              boxShadow: '0 24px 60px rgba(0,0,0, 0.6)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span className="aurora-badge purple">TASK DETAILS</span>
                <span className="aurora-badge blue">{inspectingMission.estimatedMinutes || 25}m Session</span>
              </Box>
              <button
                onClick={() => setInspectingMission(null)}
                style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: 4 }}
                title="Close"
              >
                <Icon name="close" size={16} />
              </button>
            </Box>

            <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary' }}>
              {inspectingMission.title}
            </Typography>

            {inspectingMission.description && (
              <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                {inspectingMission.description}
              </Typography>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 2, borderTop: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'color-mix(in srgb, var(--brand-primary) 12.0%, transparent)'}` }}>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <button
                  className="aurora-btn-primary"
                  onClick={() => {
                    handleArmMissionAsSession(inspectingMission.title, inspectingMission.estimatedMinutes || 25)
                    setInspectingMission(null)
                  }}
                >
                  <Icon name="play" size={14} />
                  <span>Start Focus</span>
                </button>
                <button
                  className="aurora-btn-secondary"
                  onClick={() => {
                    handleToggleMissionComplete(inspectingMission.id)
                    setInspectingMission(null)
                  }}
                >
                  <Icon name="check" size={14} />
                  <span>{inspectingMission.status === 'COMPLETED' ? 'Reopen' : 'Complete'}</span>
                </button>
              </Box>

              {handleDeleteMission && (
                <button
                  className="aurora-btn-ghost"
                  onClick={() => {
                    handleDeleteMission(inspectingMission.id, inspectingMission.title)
                    setInspectingMission(null)
                  }}
                  style={{ color: 'var(--brand-primary)' }}
                >
                  <Icon name="trash" size={14} />
                  <span>Delete</span>
                </button>
              )}
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  )
}
