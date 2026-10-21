import React, { useState, useMemo, useCallback } from 'react'
import { Box, Typography, Tooltip } from '@mui/material'
import type { Goal, Mission } from '../../api/goalsAndMissions'
import type { FocusSession } from '../../api/focusSessions'
import type { AnalyticsDashboardResponse } from '../../api/analytics'
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

import { DailyObjectivesCard } from '../../components/dashboard/DailyObjectivesCard'

import {
  getSortedScheduleSessions,
  getSessionSecondaryInfo,
} from '../../utils/scheduleHelpers'

export const AuroraDashboardView: React.FC<AuroraDashboardViewProps> = ({
  currentUser,
  missions = [],
  goals = [],
  sessions = [],
  activeSession,
  sentinelStatus,
  analyticsData,
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
  onOpenAchievements,
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
    return getSortedScheduleSessions(sessions, activeSession)
  }, [sessions, activeSession])

  // 2. Metrics calculation matching V1 exact formulas
  const totalMissionsCount = missions.length
  const completedMissionsCount = missions.filter((m) => m.status === 'COMPLETED').length
  const velocityRate = totalMissionsCount > 0
    ? Math.round((completedMissionsCount / totalMissionsCount) * 100)
    : (analyticsData?.summary?.completionRate ? Math.round(analyticsData.summary.completionRate) : 0)

  const totalFocusMinutesToday = analyticsData?.summary?.totalFocusMinutes ??
    sessions.filter((s) => s.status === 'COMPLETED').reduce((acc, s) => acc + (s.durationMinutes || 0), 0)

  const completedSessionsCount = analyticsData?.summary?.sessionsCompleted ??
    sessions.filter((s) => s.status === 'COMPLETED').length

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
        const matchesActive =
          m.title.toLowerCase() === activeSession.name.toLowerCase() ||
          (activeSession.intention && m.title.toLowerCase() === activeSession.intention.toLowerCase())
        if (matchesActive) return true
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
    const isActive = activeSession && (
      task.title.toLowerCase() === activeSession.name.toLowerCase() ||
      (activeSession.intention && task.title.toLowerCase() === activeSession.intention.toLowerCase())
    )

    return (
      <Box
        key={task.id}
        className="aurora-card-interactive aurora-tilt-lift"
        onClick={() => setInspectingMission(task)}
        sx={{
          p: '12px 14px',
          borderRadius: '10px',
          background: isDarkMode ? '#192541' : '#FFFFFF',
          border: `1px solid ${isActive
            ? '#FF4D5E'
            : isDone
              ? isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.25)'
              : isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(77, 119, 249, 0.12)'
            }`,
          boxShadow: isDarkMode ? '0 2px 8px rgba(0, 0, 0, 0.25)' : '0 2px 8px rgba(77, 119, 249, 0.04)',
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
              border: `1.5px solid ${isDone ? '#10B981' : isDarkMode ? 'rgba(255, 255, 255, 0.2)' : '#CBD5E1'}`,
              background: isDone ? '#10B981' : 'transparent',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              p: 0,
              mt: 0.2,
              transition: 'all 0.15s ease',
              '&:hover': {
                borderColor: '#10B981',
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
            borderTop: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(77, 119, 249, 0.06)'}`,
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
                background: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(77, 119, 249, 0.08)',
                color: isDarkMode ? 'text.secondary' : '#3563F6',
                fontSize: 12,
                fontWeight: 600,
                maxWidth: 160,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
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
                ? isDarkMode ? 'rgba(16, 185, 129, 0.16)' : '#ECFDF5'
                : isDarkMode ? 'rgba(151, 87, 250, 0.16)' : '#F3E8FF',
              color: isDone ? '#10B981' : '#9757FA',
              border: `1px solid ${isDone ? 'rgba(16, 185, 129, 0.3)' : 'rgba(151, 87, 250, 0.3)'}`,
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
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: '22px', // Exact V1 vertical gap
        width: '100%',
        maxWidth: 1600,
        margin: '0 auto',
        pb: 4,
      }}
    >
      {/* =========================================================================
          1. DASHBOARD HEADER BAR: Greeting + Sentinel Pill + New Task + Live Clock
          ========================================================================= */}
      <Box
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
            {greetingTime},{' '}
            <Box
              component="span"
              sx={{
                background: 'linear-gradient(135deg, #9757FA 0%, #4D77F9 50%, #1BC9DE 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {currentUser?.username || 'EONX'}
            </Box>
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', fontSize: 15 }}>
            Here is your priority focus and execution plan for today.
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1, flexWrap: 'wrap' }}>
            {/* Focus Protection Status Pill */}
            {sentinelStatus && (
              <Box
                id="aurora-focus-protection-pill"
                onClick={() => setActiveTab('Task Manager')}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.8,
                  height: 38,
                  boxSizing: 'border-box',
                  borderRadius: '10px',
                  background: isDarkMode ? 'rgba(25, 37, 65, 0.7)' : '#FFFFFF',
                  border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(77, 119, 249, 0.2)'}`,
                  cursor: 'pointer',
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: 'text.primary',
                  boxShadow: isDarkMode ? 'none' : '0 2px 6px rgba(77, 119, 249, 0.06)',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    borderColor: '#4D77F9',
                  },
                }}
                title={`Focus Protection: ${sentinelStatus.enforcementMode || 'Standard'} • ${sentinelStatus.totalInterceptedToday || 0} intercepted today`}
              >
                <Box
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    bgcolor: sentinelStatus.status === 'ACTIVE_DEFENSE' ? '#FF4D5E' : '#10B981',
                    boxShadow: 'none',
                  }}
                />
                <span>
                  {sentinelStatus.status === 'ACTIVE_DEFENSE'
                    ? 'Protection: Active Defense'
                    : 'Protection: Standby'}
                </span>
              </Box>
            )}

            {/* New Task Button */}
            <button
              className="aurora-btn-secondary"
              onClick={() => {
                if (goals.length > 0 && setQuickMissionGoalId) {
                  setQuickMissionGoalId(goals[0].id)
                }
                setIsCreatingQuickMission(true)
              }}
              style={{
                height: '38px',
                padding: '0 18px',
                fontSize: '13.5px',
                borderRadius: '10px',
                display: 'inline-flex',
                alignItems: 'center',
                boxSizing: 'border-box',
                gap: '7px',
              }}
              title="Create a new task"
            >
              <Icon name="plus" size={13} />
              <span>New Task</span>
            </button>
          </Box>
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
          tiltVariant="lift"
          glass
          onClick={() => setActiveTab('Goals & Missions')}
          sx={{
            p: '20px 22px',
            height: '100%',
            minHeight: 168,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 1.2,
          }}
          title="View all goals"
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.secondary' }}>
              Active Goals
            </Typography>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                background: 'rgba(255, 77, 94, 0.14)',
                color: '#FF4D5E',
                border: '1px solid rgba(255, 77, 94, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="target" size={17} />
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
            {goals.length}
          </Typography>
          <Typography sx={{ fontSize: 13.5, color: 'text.secondary', fontWeight: 500 }}>
            {completedMissionsCount} {completedMissionsCount === 1 ? 'task' : 'tasks'} completed
          </Typography>
        </AuroraCard>

        {/* Metric 2: Focus Logged */}
        <AuroraCard
          tiltVariant="lift"
          glass
          onClick={() => setActiveTab('Analytics')}
          sx={{
            p: '20px 22px',
            height: '100%',
            minHeight: 168,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 1.2,
          }}
          title="View Focus Analytics"
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.secondary' }}>
              Focus Logged
            </Typography>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                background: 'rgba(16, 185, 129, 0.14)',
                color: '#10B981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
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
            {totalFocusMinutesToday}m
          </Typography>
          <Typography sx={{ fontSize: 13.5, color: 'text.secondary', fontWeight: 500 }}>
            {completedSessionsCount} sessions completed
          </Typography>
        </AuroraCard>

        {/* Metric 3: Tasks in Queue */}
        <AuroraCard
          tiltVariant="lift"
          glass
          data-tutorial="metric-completion"
          onClick={() => {
            const board = document.getElementById('aurora-tasks-board')
            if (board) board.scrollIntoView({ behavior: 'smooth' })
          }}
          sx={{
            p: '20px 22px',
            height: '100%',
            minHeight: 168,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 1.2,
          }}
          title="View Tasks Board"
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.secondary' }}>
              Tasks In Queue
            </Typography>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                background: 'rgba(27, 201, 222, 0.14)',
                color: '#1BC9DE',
                border: '1px solid rgba(27, 201, 222, 0.3)',
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
            {displayInProgress.length + displayPending.length}
          </Typography>
          <Typography sx={{ fontSize: 13.5, color: 'text.secondary', fontWeight: 500 }}>
            {compM.length} finished today
          </Typography>
        </AuroraCard>

        {/* Metric 4: Task Completion Rate */}
        <AuroraCard
          tiltVariant="lift"
          glass
          onClick={() => setActiveTab('Analytics')}
          sx={{
            p: '20px 22px',
            height: '100%',
            minHeight: 168,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 1.2,
          }}
          title="View Execution Analytics"
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.secondary' }}>
              Completion Rate
            </Typography>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                background: 'rgba(151, 87, 250, 0.14)',
                color: '#9757FA',
                border: '1px solid rgba(151, 87, 250, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="analytics" size={17} />
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
            {velocityRate}%
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8, width: '100%' }}>
            <Typography sx={{ fontSize: 13.5, color: 'text.secondary', fontWeight: 500 }}>
              Velocity rate this week
            </Typography>
            <Box
              sx={{
                width: '100%',
                height: 6,
                borderRadius: 999,
                bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(77, 119, 249, 0.1)',
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  height: '100%',
                  width: '100%',
                  transform: `scaleX(${Math.min(1, Math.max(0, velocityRate / 100))})`,
                  transformOrigin: 'left',
                  background: 'linear-gradient(135deg, #9757FA 0%, #4D77F9 100%)',
                  borderRadius: 999,
                  transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            </Box>
          </Box>
        </AuroraCard>
      </Box>

      {/* 2.5 Daily Execution Flow & Consistency Objectives */}
      <DailyObjectivesCard
        missions={missions}
        sessions={sessions}
        currentStreak={analyticsData?.summary?.currentStreak || 0}
        onOpenAchievements={onOpenAchievements}
        onNavigateToTasks={() => onNavigateToTasks ? onNavigateToTasks('ALL') : setActiveTab('Goals & Missions')}
        onNavigateToFocus={() => setActiveTab('Focus Engine')}
      />

      {/* =========================================================================
          3. COCKPIT GRID: Priority Hero Card (1.2fr) + Today's Schedule Card (1fr)
          ========================================================================= */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.2fr) minmax(0, 1fr)' },
          gap: '18px', // Exact V1 cockpit grid gap
          width: '100%',
          alignItems: 'stretch',
        }}
        aria-label="Execution Cockpit"
      >
        {/* Left: Priority Hero Card */}
        <AuroraCard
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
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.8,
                      px: 1.4,
                      py: 0.5,
                      borderRadius: '999px',
                      background: 'rgba(255, 77, 94, 0.16)',
                      color: '#FF4D5E',
                      border: '1px solid rgba(255, 77, 94, 0.35)',
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    <Box
                      sx={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        bgcolor: '#FF4D5E',
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
                        background: 'rgba(245, 158, 11, 0.15)',
                        color: '#F59E0B',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
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
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#EF4444',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
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
                <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', lineHeight: 1.3 }}>
                  {activeSession.name}
                </Typography>
                {activeSession.intention && (
                  <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
                    {activeSession.intention}
                  </Typography>
                )}
              </Box>

              {/* Timer Display */}
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, my: 0.5 }}>
                <Typography
                  sx={{
                    fontSize: 42,
                    fontWeight: 900,
                    fontFamily: 'monospace',
                    letterSpacing: '-1px',
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
              <Box sx={{ width: '100%', height: 7, borderRadius: 999, bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(77,119,249,0.1)', overflow: 'hidden' }}>
                <Box
                  sx={{
                    height: '100%',
                    width: '100%',
                    transform: `scaleX(${Math.max(0, Math.min(1, (1 - timerSeconds / ((activeSession.durationMinutes || 25) * 60))))})`,
                    transformOrigin: 'left',
                    background: 'linear-gradient(135deg, #9757FA 0%, #4D77F9 50%, #1BC9DE 100%)',
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
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.8,
                    px: 1.4,
                    py: 0.5,
                    borderRadius: '999px',
                    background: 'rgba(151, 87, 250, 0.14)',
                    color: '#9757FA',
                    border: '1px solid rgba(151, 87, 250, 0.35)',
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
                          background: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(77, 119, 249, 0.08)',
                          border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(77, 119, 249, 0.16)'}`,
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
                      All Planned Tasks Complete
                    </Typography>
                    <Typography variant="body1" sx={{ fontSize: 15, color: 'text.secondary' }}>
                      You're all caught up! Add a new task or review your goals to maintain momentum.
                    </Typography>
                  </>
                )}
              </Box>

              {/* Action buttons row */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mt: 1 }}>
                {primaryActionTask ? (
                  <button
                    className="aurora-btn-primary"
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
                  onClick={() => {
                    const board = document.getElementById('aurora-tasks-board')
                    if (board) {
                      board.scrollIntoView({ behavior: 'smooth' })
                    } else {
                      setActiveTab('Goals & Missions')
                    }
                  }}
                  title="View all tasks in board"
                >
                  <span>View All Tasks</span>
                </button>
              </Box>
            </Box>
          )}
        </AuroraCard>

        {/* Right: Today's Schedule Card */}
        <AuroraCard
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
                  background: 'rgba(77, 119, 249, 0.16)',
                  color: '#6E90FB',
                  border: '1px solid rgba(77, 119, 249, 0.3)',
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
                  border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(77, 119, 249, 0.2)'}`,
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
                    borderColor: '#4D77F9',
                  },
                }}
              >
                <Icon name="arrow-up-right" size={14} />
              </Box>
            </Tooltip>
          </Box>

          {/* Card Body: Renders sorted sessions with 3-column CSS Grid geometry */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, justifyContent: 'flex-start' }}>
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
                      background: isDarkMode ? 'rgba(25, 37, 65, 0.45)' : 'rgba(77, 119, 249, 0.04)',
                      border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(77, 119, 249, 0.1)'}`,
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
                          ? isDarkMode ? 'rgba(16, 185, 129, 0.16)' : '#ECFDF5'
                          : s.status === 'PAUSED'
                            ? isDarkMode ? 'rgba(245, 158, 11, 0.16)' : '#FFFBEB'
                            : isActive
                              ? isDarkMode ? 'rgba(0, 229, 255, 0.16)' : '#E0F2FE'
                              : isDarkMode ? '#111B31' : '#FFFFFF',
                        border: `1px solid ${isDone
                          ? 'rgba(16, 185, 129, 0.3)'
                          : s.status === 'PAUSED'
                            ? 'rgba(245, 158, 11, 0.35)'
                            : isActive
                              ? 'rgba(0, 229, 255, 0.35)'
                              : isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(77, 119, 249, 0.16)'
                          }`,
                        color: isDone ? '#10B981' : s.status === 'PAUSED' ? '#F59E0B' : isActive ? '#00E5FF' : 'text.secondary',
                        fontSize: 13,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isDone ? '✓' : s.status === 'PAUSED' ? '❚❚' : isActive ? '▶' : idx + 1}
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
                            ? isDarkMode ? 'rgba(16, 185, 129, 0.16)' : '#ECFDF5'
                            : s.status === 'PAUSED'
                              ? isDarkMode ? 'rgba(245, 158, 11, 0.16)' : '#FFFBEB'
                              : isActive
                                ? isDarkMode ? 'rgba(0, 229, 255, 0.16)' : '#E0F2FE'
                                : isDarkMode ? 'rgba(255, 77, 94, 0.14)' : '#FFF0E9',
                          color: isDone ? '#10B981' : s.status === 'PAUSED' ? '#F59E0B' : isActive ? '#00E5FF' : '#FF4D5E',
                          border: `1px solid ${isDone
                            ? 'rgba(16, 185, 129, 0.3)'
                            : s.status === 'PAUSED'
                              ? 'rgba(245, 158, 11, 0.35)'
                              : isActive
                                ? 'rgba(0, 229, 255, 0.3)'
                                : 'rgba(255, 77, 94, 0.28)'
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
                borderTop: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.07)' : 'rgba(77, 119, 249, 0.1)'}`,
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
              <Box
                component="button"
                onClick={() => setActiveTab('Schedule')}
                sx={{
                  background: 'transparent',
                  border: 'none',
                  color: isDarkMode ? '#9757FA' : '#7932E6',
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
            </Box>
          </Box>
        </AuroraCard>

      </Box>

      {/* =========================================================================
          4. FULL-WIDTH TASKS BOARD: 3 Kanban Lanes (In Progress, Ready, Completed)
          ========================================================================= */}
      <Box
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
                background: isDarkMode ? 'rgba(77, 119, 249, 0.16)' : '#EFF6FF',
                color: isDarkMode ? '#6E90FB' : '#1D4ED8',
                border: '1px solid rgba(77, 119, 249, 0.3)',
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
                background: isDarkMode ? 'rgba(16, 185, 129, 0.16)' : '#ECFDF5',
                color: isDarkMode ? '#34D399' : '#047857',
                border: '1px solid rgba(16, 185, 129, 0.3)',
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
                  background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                  px: 1.4,
                  py: 0.5,
                  borderRadius: '8px',
                }}
              >
                <span>Filtering: "{topSearchQuery}"</span>
                <button
                  onClick={() => setTopSearchQuery?.('')}
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 700 }}
                  title="Clear filter"
                >
                  ×
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
            sx={{
              p: '18px 20px',
              minHeight: 410,
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
                borderBottom: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(77, 119, 249, 0.12)'}`,
                flexShrink: 0,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: '#FF4D5E',
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
                  background: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(77, 119, 249, 0.08)',
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
                        border: isDarkMode ? '1px dashed rgba(255, 255, 255, 0.16)' : '1px dashed rgba(77, 119, 249, 0.28)',
                        background: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(77, 119, 249, 0.04)',
                        color: isDarkMode ? '#8EADFD' : '#2563EB',
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          background: isDarkMode ? 'rgba(77, 119, 249, 0.12)' : 'rgba(77, 119, 249, 0.08)',
                          borderColor: '#4D77F9',
                        },
                      }}
                    >
                      View {displayInProgress.length - 3} remaining {displayInProgress.length - 3 === 1 ? 'task' : 'tasks'} →
                    </Box>
                  )}
                </>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 3, my: 'auto', textAlign: 'center', gap: 1, flex: 1 }}>
                  <Box sx={{ width: 36, height: 36, borderRadius: '50%', background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(77, 119, 249, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary', mb: 0.5 }}>
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
            sx={{
              p: '18px 20px',
              minHeight: 410,
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
                borderBottom: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(77, 119, 249, 0.12)'}`,
                flexShrink: 0,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: '#1BC9DE',
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
                  background: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(77, 119, 249, 0.08)',
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
                        border: isDarkMode ? '1px dashed rgba(255, 255, 255, 0.16)' : '1px dashed rgba(77, 119, 249, 0.28)',
                        background: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(77, 119, 249, 0.04)',
                        color: isDarkMode ? '#8EADFD' : '#2563EB',
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          background: isDarkMode ? 'rgba(77, 119, 249, 0.12)' : 'rgba(77, 119, 249, 0.08)',
                          borderColor: '#4D77F9',
                        },
                      }}
                    >
                      View {displayPending.length - 3} remaining {displayPending.length - 3 === 1 ? 'task' : 'tasks'} →
                    </Box>
                  )}
                </>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 3, my: 'auto', textAlign: 'center', gap: 1, flex: 1 }}>
                  <Box sx={{ width: 36, height: 36, borderRadius: '50%', background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(27, 201, 222, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary', mb: 0.5 }}>
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
            data-tutorial="completed-column"
            sx={{
              p: '18px 20px',
              minHeight: 410,
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
                borderBottom: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(77, 119, 249, 0.12)'}`,
                flexShrink: 0,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: '#10B981',
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
                  background: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(77, 119, 249, 0.08)',
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
                        border: isDarkMode ? '1px dashed rgba(255, 255, 255, 0.16)' : '1px dashed rgba(77, 119, 249, 0.28)',
                        background: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(77, 119, 249, 0.04)',
                        color: isDarkMode ? '#8EADFD' : '#2563EB',
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          background: isDarkMode ? 'rgba(77, 119, 249, 0.12)' : 'rgba(77, 119, 249, 0.08)',
                          borderColor: '#4D77F9',
                        },
                      }}
                    >
                      View {compM.length - 3} remaining {compM.length - 3 === 1 ? 'task' : 'tasks'} →
                    </Box>
                  )}
                </>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 3, my: 'auto', textAlign: 'center', gap: 1, flex: 1 }}>
                  <Box sx={{ width: 36, height: 36, borderRadius: '50%', background: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(16, 185, 129, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary', mb: 0.5 }}>
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
      </Box>

      {/* Task Details Modal */}
      {inspectingMission && (
        <Box
          onClick={() => setInspectingMission(null)}
          sx={{
            position: 'fixed',
            inset: 0,
            bgcolor: 'rgba(0, 0, 0, 0.65)',
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
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)',
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

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 2, borderTop: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(77,119,249,0.12)'}` }}>
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
                  style={{ color: '#FF4D5E' }}
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
