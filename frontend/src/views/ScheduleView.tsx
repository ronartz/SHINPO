import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { FocusSession } from '../api/focusSessions'
import type { AppView } from '../types/navigation'
import { Icon } from '../components/common/Icon'
import { trackRender } from '../utils/renderTracker'
import { layoutOverlappingSessions } from '../utils/scheduleLayout'
import { formatScheduleDuration, summarizeSchedule } from '../utils/scheduleSummary'

const formatLocalCalendarDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const localCalendarDate = (date = new Date()): string => formatLocalCalendarDate(date)
const localCalendarDateFromInstant = (instant: string | null | undefined): string | null => instant ? localCalendarDate(new Date(instant)) : null
const sessionDate = (session: FocusSession) => localCalendarDateFromInstant(session.scheduledAt) || localCalendarDateFromInstant(session.startedAt) || localCalendarDateFromInstant(session.createdAt)
const dayStart = (date: Date) => {
  const start = new Date(date)
  start.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  start.setHours(0, 0, 0, 0)
  return start
}
const changeDate = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00`)
  date.setDate(date.getDate() + days)
  return formatLocalCalendarDate(date)
}

export interface ScheduleViewProps {
  sessions: FocusSession[]
  selectedScheduleDate: string
  setSelectedScheduleDate: (date: string) => void
  setActiveTab: (tab: AppView) => void
  handleOpenBookingModal: (defaultDate?: string, presetDuration?: number, presetPlan?: string) => void
  handleStartFromSchedule: (sessionId: number) => void
  handleCancelFromSchedule: (sessionId: number) => void
  handleDeleteSession: (sessionId: number) => void
  handleEditSession?: (session: FocusSession) => void
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  sessions, selectedScheduleDate, setSelectedScheduleDate, setActiveTab,
  handleOpenBookingModal, handleStartFromSchedule, handleCancelFromSchedule,
  handleDeleteSession, handleEditSession,
}) => {
  trackRender('ScheduleView')
  const [scheduleFilter, setScheduleFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED' | 'CANCELLED'>('ALL')
  const [miniMonth, setMiniMonth] = useState(() => new Date(`${selectedScheduleDate}T00:00:00`))
  const calendarScrollRef = useRef<HTMLDivElement>(null)

  const weekDays = useMemo(() => {
    const monday = dayStart(new Date(`${selectedScheduleDate}T00:00:00`))
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + index)
      const dateStr = localCalendarDate(date)
      return { date, dateStr, dayName: date.toLocaleDateString('en-US', { weekday: 'short' }), dayNum: date.getDate(), isToday: dateStr === localCalendarDate() }
    })
  }, [selectedScheduleDate])

  const monthCells = useMemo(() => {
    const first = new Date(miniMonth.getFullYear(), miniMonth.getMonth(), 1)
    const start = new Date(first)
    start.setDate(1 - ((first.getDay() + 6) % 7))
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start)
      date.setDate(start.getDate() + index)
      const dateStr = localCalendarDate(date)
      return { dateStr, day: date.getDate(), inMonth: date.getMonth() === miniMonth.getMonth(), count: sessions.filter(s => sessionDate(s) === dateStr).length }
    })
  }, [miniMonth, sessions])

  const filteredSessions = useMemo(() => sessions.filter(session => {
    if (scheduleFilter === 'PENDING') return session.status === 'SCHEDULED' || session.status === 'ACTIVE' || session.status === 'PAUSED'
    if (scheduleFilter === 'COMPLETED') return session.status === 'COMPLETED'
    if (scheduleFilter === 'CANCELLED') return session.status === 'CANCELLED' || session.status === 'EXPIRED' || session.status === 'FAILED'
    return session.status !== 'CANCELLED' && session.status !== 'EXPIRED' && session.status !== 'FAILED'
  }), [sessions, scheduleFilter])
  const allWeekSessions = sessions.filter(session => weekDays.some(day => sessionDate(session) === day.dateStr))
  const weekSessions = filteredSessions.filter(session => weekDays.some(day => sessionDate(session) === day.dateStr))
  const weekSummary = summarizeSchedule(allWeekSessions)
  const flexibleSessions = weekSessions.filter(session => !session.scheduledAt && !session.startedAt)
  const timedSessions = weekSessions.filter(session => session.scheduledAt || session.startedAt)
  const startHour = 0
  const hours = Array.from({ length: 24 }, (_, index) => index)
  const weekLabel = `${weekDays[0].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekDays[6].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  const monthLabel = miniMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const dayLayouts = new Map(weekDays.map((day) => {
    const sessions = timedSessions.filter((session) => sessionDate(session) === day.dateStr)
    const positions = layoutOverlappingSessions(sessions.map((session) => {
      const date = new Date(session.scheduledAt || session.startedAt!)
      return {
        id: session.id,
        startMinute: date.getHours() * 60 + date.getMinutes(),
        durationMinutes: Math.max(session.durationMinutes, 50 * 60 / 62),
      }
    }))
    const laneCount = Math.max(1, ...[...positions.values()].map((position) => position.laneCount))
    return [day.dateStr, { positions, laneCount }] as const
  }))
  const selectDate = (date: string) => {
    setSelectedScheduleDate(date)
    const next = new Date(`${date}T00:00:00`)
    if (next.getMonth() !== miniMonth.getMonth() || next.getFullYear() !== miniMonth.getFullYear()) setMiniMonth(next)
  }

  useEffect(() => {
    const calendar = calendarScrollRef.current
    if (!calendar) return

    const handleWheel = (event: WheelEvent) => {
      const current = calendar.scrollTop
      const maximum = calendar.scrollHeight - calendar.clientHeight
      const next = Math.max(0, Math.min(maximum, current + event.deltaY))
      let remainder = event.deltaY - (next - current)
      if (Math.abs(remainder) < 1) return

      event.preventDefault()
      calendar.scrollTop = next

      for (let parent = calendar.parentElement; parent; parent = parent.parentElement) {
        const canScroll = ['auto', 'scroll'].includes(getComputedStyle(parent).overflowY)
        if (canScroll && parent.scrollHeight > parent.clientHeight + 1) {
          const before = parent.scrollTop
          parent.scrollTop = Math.max(0, Math.min(parent.scrollHeight - parent.clientHeight, before + remainder))
          remainder -= parent.scrollTop - before
          if (Math.abs(remainder) < 1) return
        }
      }

      window.scrollBy(0, remainder)
    }

    calendar.addEventListener('wheel', handleWheel, { passive: false })
    return () => calendar.removeEventListener('wheel', handleWheel)
  }, [])

  const renderActions = (session: FocusSession) => (
    <div className="schedule-session-actions">
      {session.status === 'SCHEDULED' && <>
        <button type="button" className="schedule-btn-engage" aria-label={`Start ${session.name}`} title="Start session" onClick={() => handleStartFromSchedule(session.id)}><Icon name="play" size={12} /><span>Start</span></button>
        {handleEditSession && <button type="button" className="schedule-btn-edit" aria-label={`Edit ${session.name}`} title="Edit session" onClick={() => handleEditSession(session)}><Icon name="edit" size={12} /></button>}
        <button type="button" className="schedule-btn-cancel" aria-label={`Cancel ${session.name}`} onClick={() => handleCancelFromSchedule(session.id)}>Cancel</button>
      </>}
      {(session.status === 'ACTIVE' || session.status === 'PAUSED') && <button type="button" className="schedule-btn-engage" onClick={() => setActiveTab('Focus Engine')}>Open Focus</button>}
      <button type="button" className="btn-icon-delete" aria-label={`Delete ${session.name}`} title="Delete session" onClick={() => handleDeleteSession(session.id)}><Icon name="trash" size={13} /></button>
    </div>
  )

  const renderSession = (session: FocusSession, compact = false) => {
    const instant = session.scheduledAt || session.startedAt
    const date = instant ? new Date(instant) : null
    const time = date ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Flexible time'
    return <article key={session.id} className={`schedule-session-item status-${session.status}${compact ? ' is-compact' : ''}`}>
      <div className="schedule-session-info">
        <div className="schedule-session-title-row"><span className="schedule-session-title">{session.name}</span><span className={`schedule-status-pill ${session.status}`}>{session.status.toLowerCase()}</span></div>
        <div className="schedule-session-meta"><span><Icon name="clock" size={11} />{time} · {session.durationMinutes} min</span>{session.intention && <span>{session.intention}</span>}</div>
        {session.result?.accomplishment && <p className="schedule-session-outcome">{session.result.accomplishment}</p>}
      </div>
      {renderActions(session)}
    </article>
  }

  return <section className="schedule-container schedule-calendar-layout">
    <aside className="schedule-sidebar">
      <div className="schedule-mini-calendar">
        <div className="schedule-mini-heading">
          <div><span className="schedule-sidebar-eyebrow">YOUR CALENDAR</span><h2>{monthLabel}</h2></div>
          <div className="schedule-mini-nav">
            <button type="button" aria-label="Previous month" onClick={() => setMiniMonth(new Date(miniMonth.getFullYear(), miniMonth.getMonth() - 1, 1))}><Icon name="chevron-left" size={15} /></button>
            <button type="button" aria-label="Next month" onClick={() => setMiniMonth(new Date(miniMonth.getFullYear(), miniMonth.getMonth() + 1, 1))}><Icon name="chevron-right" size={15} /></button>
          </div>
        </div>
        <div className="schedule-month-grid schedule-month-weekdays">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => <span key={`${day}${i}`}>{day}</span>)}</div>
        <div className="schedule-month-grid">
          {monthCells.map(cell => <button type="button" key={cell.dateStr} aria-label={`${cell.dateStr}${cell.count ? `, ${cell.count} sessions` : ''}`} className={`schedule-month-day${cell.inMonth ? '' : ' outside'}${cell.dateStr === selectedScheduleDate ? ' selected' : ''}${cell.dateStr === localCalendarDate() ? ' today' : ''}`} onClick={() => selectDate(cell.dateStr)}>
            {cell.day}{cell.count > 0 && <i />}
          </button>)}
        </div>
        <button type="button" className="schedule-today-button" onClick={() => selectDate(localCalendarDate())}>Jump to today</button>
      </div>

      <div className="schedule-sidebar-section">
        <div className="schedule-sidebar-section-title"><span>MY SCHEDULE</span><span>{weekSessions.length}</span></div>
        {(['ALL', 'PENDING', 'COMPLETED', 'CANCELLED'] as const).map(filter => <button type="button" key={filter} className={`schedule-sidebar-filter${scheduleFilter === filter ? ' active' : ''}`} onClick={() => setScheduleFilter(filter)}>
          <span className={`schedule-filter-dot ${filter.toLowerCase()}`} />{filter === 'ALL' ? 'All sessions' : filter === 'PENDING' ? 'Upcoming & active' : filter === 'COMPLETED' ? 'Completed' : 'Cancelled / ended'}<span className="schedule-filter-count">{filter === 'ALL' ? weekSessions.length : weekSessions.filter(s => filter === 'PENDING' ? s.status === 'SCHEDULED' || s.status === 'ACTIVE' || s.status === 'PAUSED' : filter === 'COMPLETED' ? s.status === 'COMPLETED' : s.status === 'CANCELLED' || s.status === 'EXPIRED' || s.status === 'FAILED').length}</span>
        </button>)}
      </div>

      <div className="schedule-sidebar-tip"><span className="schedule-sidebar-eyebrow">PLAN WITH INTENTION</span><p>Protect a little time for the work that matters most.</p><button type="button" className="schedule-sidebar-book" onClick={() => handleOpenBookingModal(selectedScheduleDate)}><Icon name="plus" size={14} />Book focus time</button></div>
    </aside>

    <div className="schedule-calendar-main">
      <header className="schedule-calendar-toolbar">
        <div className="schedule-toolbar-title"><span className="schedule-sidebar-eyebrow">WEEKLY VIEW</span><h1>{weekLabel}</h1><p>{weekSessions.length} session{weekSessions.length === 1 ? '' : 's'} scheduled this week</p></div>
        <div className="schedule-toolbar-actions"><div className="schedule-week-navigation">
          <button type="button" aria-label="Previous week" onClick={() => selectDate(changeDate(selectedScheduleDate, -7))}><Icon name="chevron-left" size={16} /></button>
          <button type="button" onClick={() => selectDate(localCalendarDate())}>Today</button>
          <button type="button" aria-label="Next week" onClick={() => selectDate(changeDate(selectedScheduleDate, 7))}><Icon name="chevron-right" size={16} /></button>
        </div><button type="button" className="schedule-btn-book" onClick={() => handleOpenBookingModal(selectedScheduleDate)} data-tutorial="schedule-book-btn"><Icon name="plus" size={14} /><span>Book session</span></button></div>
      </header>

      <div className="schedule-week-summary" role="group" aria-label="This week's plan and progress">
        <div><span>Planned focus</span><strong>{formatScheduleDuration(weekSummary.plannedMinutes)}</strong><small>across {weekSummary.plannedCount} session{weekSummary.plannedCount === 1 ? '' : 's'}</small></div>
        <div><span>Focus recorded</span><strong>{formatScheduleDuration(weekSummary.actualSeconds / 60)}</strong><small>actual active time</small></div>
        <div><span>Completed</span><strong>{weekSummary.completed}</strong><small>of {weekSummary.plannedCount} planned</small></div>
        <div><span>Upcoming</span><strong>{weekSummary.upcoming}</strong><small>ready to start</small></div>
      </div>

      {flexibleSessions.length > 0 && <div className="schedule-flexible-row"><span>FLEXIBLE</span><div>{flexibleSessions.map(session => renderSession(session, true))}</div></div>}

      <div className="schedule-calendar-scroll" ref={calendarScrollRef}>
        <div className="schedule-week-grid" style={{
          '--schedule-hours': hours.length,
          '--schedule-grid-height': `${hours.length * 62}px`,
          gridTemplateColumns: `72px ${weekDays.map((day) => `minmax(${Math.max(96, (dayLayouts.get(day.dateStr)?.laneCount ?? 1) * 96)}px, 1fr)`).join(' ')}`,
        } as React.CSSProperties}>
          <div className="schedule-grid-corner">LOCAL TIME</div>
          {weekDays.map(day => <button type="button" key={day.dateStr} className={`schedule-grid-day-heading${day.dateStr === selectedScheduleDate ? ' selected' : ''}${day.isToday ? ' today' : ''}`} onClick={() => selectDate(day.dateStr)}>
            <span>{day.dayName}</span><strong>{day.dayNum}</strong><small>{day.date.toLocaleDateString('en-US', { month: 'short' })}</small>
          </button>)}
          <div className="schedule-time-axis">{hours.map(hour => <div className="schedule-time-label" key={hour}>{new Date(2000, 0, 1, hour).toLocaleTimeString([], { hour: 'numeric' })}</div>)}</div>
          {weekDays.map(day => {
            const daySessions = timedSessions.filter(session => sessionDate(session) === day.dateStr)
            const dayLayout = dayLayouts.get(day.dateStr)!
            return <div className={`schedule-day-column${day.isToday ? ' today' : ''}`} key={day.dateStr}>
              {hours.map(hour => <div className="schedule-hour-cell" key={hour} />)}
              {daySessions.map(session => {
                const instant = session.scheduledAt || session.startedAt
                const date = new Date(instant!)
                const eventTime = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                const startMinutes = (date.getHours() - startHour) * 60 + date.getMinutes()
                const top = Math.max(0, startMinutes / 60 * 62)
                const height = Math.max(50, session.durationMinutes / 60 * 62)
                const layout = dayLayout.positions.get(session.id) ?? { lane: 0, laneCount: 1 }
                const laneWidth = 100 / layout.laneCount
                return <div key={session.id} className={`schedule-grid-event${session.durationMinutes >= 45 ? ' is-roomy' : ' is-compact'} status-${session.status}`} aria-label={`${session.name}, ${session.status.toLowerCase()}, ${eventTime}, ${session.durationMinutes} minutes`} style={{
                  top,
                  height: Math.min(height, hours.length * 62 - top),
                  left: `calc(${layout.lane * laneWidth}% + 4px)`,
                  width: `calc(${laneWidth}% - 8px)`,
                  right: 'auto',
                }}>
                  <div className="schedule-grid-event-accent" />
                  <div className="schedule-grid-event-heading">
                    <span className="schedule-grid-event-title" title={session.name}>{session.name}</span>
                    <time>{eventTime}</time>
                  </div>
                  {renderActions(session)}
                </div>
              })}
            </div>
          })}
        </div>
      </div>
      {weekSessions.length === 0 && <div className="schedule-week-empty"><span className="schedule-empty-icon"><Icon name="schedule" size={22} /></span><div><strong>Your week is open</strong><p>Book a focus block to make room for meaningful progress.</p></div><button type="button" className="schedule-btn-book" onClick={() => handleOpenBookingModal(selectedScheduleDate)}><Icon name="plus" size={13} />Plan a session</button></div>}
      <footer className="schedule-calendar-footer"><span>Showing {weekLabel}</span><span>Times shown in your local timezone</span></footer>
    </div>
  </section>
}
